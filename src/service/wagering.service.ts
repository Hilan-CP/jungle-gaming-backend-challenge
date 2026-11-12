import { BadRequestException, HttpException, HttpStatus, Injectable, NotFoundException } from "@nestjs/common";
import { EntityManager } from "@mikro-orm/postgresql";
import { randomUUID } from "node:crypto";
import { LedgerDirection, LedgerEntryState, WalletLedgerEntry } from "../entity/ledger";
import { Money } from "../entity/money";
import {
    FailureCode,
    WagerTransaction,
    WagerTransactionKind,
    WagerTransactionState,
    WagerTransactionStatus
} from "../entity/wager-transaction";
import { CreateWagerTransactionRequest, WagerTransactionResponse } from "../dto/wagering.dto";
import { InsufficientFundsError } from "../error/insufficient-funds.error";
import { WalletRepository } from "../repository/wallet.repository";
import { WagerTransactionRepository } from "../repository/wager-transaction.repository";
import { WalletLedgerRepository } from "../repository/wallet-ledger.repository";
import { OutboxRepository } from "../repository/outbox.repository";
import { OutboxMessage, OutboxMessageState } from "../entity/outbox";
import { WalletState } from "../entity/wallet";
import { computePayloadHash } from "../util/payload-hash.util";

export { CreateWagerTransactionRequest, WagerTransactionResponse };

interface SerializeTransactionOptions {
    idempotentReplay?: boolean;
    walletBalance?: Money;
}

function serializeTransaction(
    transaction: WagerTransaction,
    options: SerializeTransactionOptions = {}
): WagerTransactionResponse {
    return {
        id: transaction.id,
        providerId: transaction.providerId,
        externalTransactionId: transaction.externalTransactionId,
        idempotencyKey: transaction.idempotencyKey,
        payloadHash: transaction.payloadHash,
        walletId: transaction.walletId,
        playerId: transaction.playerId,
        roundId: transaction.roundId,
        gameId: transaction.gameId,
        kind: transaction.kind,
        money: transaction.money.toJSON(),
        referenceExternalTransactionId: transaction.referenceExternalTransactionId ?? null,
        referenceTransactionId: transaction.referenceTransactionId ?? null,
        status: transaction.status,
        failureCode: transaction.failureCode ?? null,
        createdAt: transaction.createdAt,
        processedAt: transaction.processedAt ?? null,
        idempotentReplay: options.idempotentReplay ?? false,
        walletBalance: options.walletBalance?.toJSON() ?? null
    };
}

function parseTransactionKind(kind: string): WagerTransactionKind {
    switch (kind) {
        case "BET":
            return WagerTransactionKind.Bet;
        case "WIN":
            return WagerTransactionKind.Win;
        case "LOSS":
            return WagerTransactionKind.Loss;
        case "REFUND":
            return WagerTransactionKind.Refund;
        case "ROLLBACK":
            return WagerTransactionKind.Rollback;
        default:
            throw new BadRequestException(`Unsupported transaction kind '${kind}'`);
    }
}

function rejectionMessage(failureCode: FailureCode | undefined): string {
    switch (failureCode) {
        case "INSUFFICIENT_FUNDS":
            return "Insufficient funds in wallet";
        case "REVERSAL_INSUFFICIENT_FUNDS":
            return "Reversal would result in a negative wallet balance";
        case "INVALID_REVERSAL_AMOUNT":
            return "Reversal amount must match the referenced transaction";
        case "INVALID_REFERENCE":
            return "Referenced transaction is not eligible for reversal";
        default:
            return "Transaction rejected";
    }
}

@Injectable()
export class WageringService {
    constructor(
        private readonly walletRepository: WalletRepository,
        private readonly wagerTransactionRepository: WagerTransactionRepository,
        private readonly ledgerRepository: WalletLedgerRepository,
        private readonly outboxRepository: OutboxRepository,
        private readonly em: EntityManager
    ) {}

    async processTransaction(
        dto: CreateWagerTransactionRequest,
        idempotencyKeyHeader?: string
    ): Promise<WagerTransactionResponse> {
        let rejectedTransaction: WagerTransactionResponse | undefined;
        let processingError: { error: unknown } | undefined;

        const response = await this.em.transactional(async () => {
            const kind = parseTransactionKind(dto.kind);

            const idempotencyKey = idempotencyKeyHeader || `${dto.providerId}:${dto.externalTransactionId}`;
            const payloadHash = computePayloadHash(dto);

            // Idempotency check by header key
            const existingByKey = await this.wagerTransactionRepository.findByIdempotencyKey(idempotencyKey);
            if (existingByKey) {
                return this.resolveIdempotentReplay(
                    existingByKey,
                    payloadHash,
                    "PAYLOAD_MISMATCH",
                    "A transaction with this Idempotency-Key already exists with a different payload"
                );
            }

            // Idempotency check by (providerId, externalTransactionId)
            const existingByExt = await this.wagerTransactionRepository.findByProviderAndExternalId(
                dto.providerId,
                dto.externalTransactionId
            );
            if (existingByExt) {
                return this.resolveIdempotentReplay(
                    existingByExt,
                    payloadHash,
                    "DUPLICATE_TRANSACTION",
                    "Transaction already exists for provider with a different payload"
                );
            }

            const wallet = await this.walletRepository.findById(dto.walletId);
            if (!wallet) {
                throw new NotFoundException(`Wallet '${dto.walletId}' not found`);
            }

            if (wallet.playerId !== dto.playerId) {
                throw new BadRequestException(
                    `Player '${dto.playerId}' does not match wallet owner '${wallet.playerId}'`
                );
            }

            let money: Money;
            try {
                money = Money.from(dto.money);
            } catch (err: any) {
                throw new BadRequestException(err?.message ?? "Invalid money amount or currency");
            }

            if (wallet.currency !== money.currency) {
                throw new BadRequestException(`Currency mismatch: expected ${wallet.currency}, got ${money.currency}`);
            }

            if (
                (kind === WagerTransactionKind.Refund || kind === WagerTransactionKind.Rollback) &&
                (!dto.referenceExternalTransactionId || dto.referenceExternalTransactionId.trim() === "")
            ) {
                throw new BadRequestException(
                    `Transaction of kind '${kind}' requires 'referenceExternalTransactionId'`
                );
            }

            const transaction = WagerTransaction.create({
                id: randomUUID(),
                providerId: dto.providerId,
                externalTransactionId: dto.externalTransactionId,
                idempotencyKey,
                payloadHash,
                walletId: wallet.id,
                playerId: wallet.playerId,
                roundId: dto.roundId,
                gameId: dto.gameId,
                kind,
                money,
                referenceExternalTransactionId: dto.referenceExternalTransactionId
            });

            const now = new Date();

            const rejectTransaction = async (failureCode: FailureCode): Promise<WagerTransactionResponse> => {
                transaction.reject(failureCode);
                await this.wagerTransactionRepository.save(new WagerTransactionState(transaction));
                const rejectedOutbox = OutboxMessage.enqueue({
                    aggregateId: transaction.walletId,
                    eventType: "wager.rejected",
                    payload: serializeTransaction(transaction, { walletBalance: wallet.balance }),
                    occurredAt: now
                });
                await this.outboxRepository.save(new OutboxMessageState(rejectedOutbox));
                rejectedTransaction = serializeTransaction(transaction, { walletBalance: wallet.balance });
                return rejectedTransaction;
            };

            const markPendingReference = async (): Promise<WagerTransactionResponse> => {
                transaction.markPendingReference();
                await this.wagerTransactionRepository.save(new WagerTransactionState(transaction));
                const pendingOutbox = OutboxMessage.enqueue({
                    aggregateId: transaction.walletId,
                    eventType: "wager.pending_reference",
                    payload: serializeTransaction(transaction, { walletBalance: wallet.balance }),
                    occurredAt: now
                });
                await this.outboxRepository.save(new OutboxMessageState(pendingOutbox));
                return serializeTransaction(transaction, { walletBalance: wallet.balance });
            };

            let referenceTransaction: WagerTransaction | undefined;
            if (transaction.requiresReference()) {
                const referenceExternalTransactionId = dto.referenceExternalTransactionId;
                if (!referenceExternalTransactionId || referenceExternalTransactionId.trim() === "") {
                    throw new BadRequestException(
                        `Transaction of kind '${kind}' requires 'referenceExternalTransactionId'`
                    );
                }

                const foundReference = await this.wagerTransactionRepository.findByProviderAndExternalId(
                    dto.providerId,
                    referenceExternalTransactionId
                );

                if (!foundReference) {
                    return markPendingReference();
                }

                if (
                    foundReference.status === WagerTransactionStatus.Pending ||
                    foundReference.status === WagerTransactionStatus.PendingReference
                ) {
                    return markPendingReference();
                }

                if (foundReference.status !== WagerTransactionStatus.Processed) {
                    return rejectTransaction("INVALID_REFERENCE");
                }

                if (!WagerTransaction.canReverse(kind, foundReference.kind)) {
                    return rejectTransaction("INVALID_REFERENCE");
                }

                const existingReversals = await this.wagerTransactionRepository.findByReferenceTransactionId(
                    foundReference.id
                );
                const alreadyReversed = existingReversals.some(
                    (reversal) =>
                        reversal.status === WagerTransactionStatus.Processed ||
                        reversal.status === WagerTransactionStatus.PendingReference
                );
                if (alreadyReversed) {
                    return rejectTransaction("INVALID_REFERENCE");
                }

                if (!money.equals(foundReference.money)) {
                    return rejectTransaction("INVALID_REVERSAL_AMOUNT");
                }

                referenceTransaction = foundReference;
            }

            if (transaction.affectsBalance()) {
                const direction = transaction.ledgerDirectionFor(referenceTransaction);
                const entryId = randomUUID();
                let entry: WalletLedgerEntry;

                try {
                    if (direction === LedgerDirection.Debit) {
                        entry = wallet.debit(money, transaction.id, entryId, now);
                    } else {
                        entry = wallet.credit(money, transaction.id, entryId, now);
                    }
                } catch (err: any) {
                    if (err instanceof InsufficientFundsError) {
                        const failureCode: FailureCode = transaction.requiresReference()
                            ? "REVERSAL_INSUFFICIENT_FUNDS"
                            : "INSUFFICIENT_FUNDS";
                        return rejectTransaction(failureCode);
                    }
                    transaction.fail("INTERNAL_ERROR");
                    await this.wagerTransactionRepository.save(new WagerTransactionState(transaction));
                    processingError = { error: err };
                    return serializeTransaction(transaction, { walletBalance: wallet.balance });
                }

                transaction.markProcessed(referenceTransaction?.id, now);
                await this.ledgerRepository.save(new LedgerEntryState(entry));
                await this.walletRepository.update(new WalletState(wallet));
            } else {
                transaction.markProcessed(referenceTransaction?.id, now);
            }

            await this.wagerTransactionRepository.save(new WagerTransactionState(transaction));
            const processedOutbox = OutboxMessage.enqueue({
                aggregateId: transaction.walletId,
                eventType: "wager.processed",
                payload: serializeTransaction(transaction, { walletBalance: wallet.balance }),
                occurredAt: now
            });
            await this.outboxRepository.save(new OutboxMessageState(processedOutbox));
            return serializeTransaction(transaction, { walletBalance: wallet.balance });
        });

        if (rejectedTransaction) {
            const failureCode = rejectedTransaction.failureCode ?? undefined;
            throw new HttpException(
                {
                    statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
                    error: failureCode,
                    message: rejectionMessage(failureCode),
                    transaction: rejectedTransaction
                },
                HttpStatus.UNPROCESSABLE_ENTITY
            );
        }

        if (processingError) {
            throw processingError.error;
        }

        return response;
    }

    async getTransactionById(transactionId: string): Promise<WagerTransactionResponse> {
        const transaction = await this.wagerTransactionRepository.findById(transactionId);
        if (!transaction) {
            throw new NotFoundException(`Transaction '${transactionId}' not found`);
        }
        return serializeTransaction(transaction);
    }

    async getTransactionByExternalId(
        providerId: string,
        externalTransactionId: string
    ): Promise<WagerTransactionResponse> {
        const transaction = await this.wagerTransactionRepository.findByProviderAndExternalId(
            providerId,
            externalTransactionId
        );
        if (!transaction) {
            throw new NotFoundException(
                `Transaction '${externalTransactionId}' for provider '${providerId}' not found`
            );
        }
        return serializeTransaction(transaction);
    }

    private async resolveIdempotentReplay(
        existing: WagerTransaction,
        payloadHash: string,
        conflictCode: "PAYLOAD_MISMATCH" | "DUPLICATE_TRANSACTION",
        conflictMessage: string
    ): Promise<WagerTransactionResponse> {
        if (!existing.matchesPayload(payloadHash)) {
            throw new HttpException(
                {
                    statusCode: HttpStatus.CONFLICT,
                    error: conflictCode,
                    message: conflictMessage
                },
                HttpStatus.CONFLICT
            );
        }

        const wallet = await this.walletRepository.findById(existing.walletId);
        return serializeTransaction(existing, {
            idempotentReplay: true,
            walletBalance: wallet?.balance
        });
    }
}
