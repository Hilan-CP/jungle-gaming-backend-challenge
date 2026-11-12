import { BadRequestException, HttpException, HttpStatus, Injectable, NotFoundException } from "@nestjs/common";
import { EntityManager } from "@mikro-orm/postgresql";
import { randomUUID } from "node:crypto";
import { LedgerDirection, WalletLedgerEntry } from "../entity/ledger";
import { Money } from "../entity/money";
import { WagerTransaction, WagerTransactionKind } from "../entity/wager-transaction";
import { CreateWagerTransactionRequest, WagerTransactionResponse } from "../dto/wagering.dto";
import { InsufficientFundsError } from "../error/insufficient-funds.error";
import { WalletRepository } from "../repository/wallet.repository";
import { WagerTransactionRepository } from "../repository/wager-transaction.repository";
import { WalletLedgerRepository } from "../repository/wallet-ledger.repository";
import { OutboxRepository } from "../repository/outbox.repository";
import { OutboxMessage } from "../entity/outbox";
import { computePayloadHash } from "../util/payload-hash.util";

export { CreateWagerTransactionRequest, WagerTransactionResponse };

function serializeTransaction(transaction: WagerTransaction): WagerTransactionResponse {
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
        processedAt: transaction.processedAt ?? null
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
                if (existingByKey.matchesPayload(payloadHash)) {
                    return serializeTransaction(existingByKey);
                }
                throw new HttpException(
                    {
                        statusCode: HttpStatus.CONFLICT,
                        error: "PAYLOAD_MISMATCH",
                        message: "A transaction with this Idempotency-Key already exists with a different payload"
                    },
                    HttpStatus.CONFLICT
                );
            }

            // Idempotency check by (providerId, externalTransactionId)
            const existingByExt = await this.wagerTransactionRepository.findByProviderAndExternalId(
                dto.providerId,
                dto.externalTransactionId
            );
            if (existingByExt) {
                if (existingByExt.matchesPayload(payloadHash)) {
                    return serializeTransaction(existingByExt);
                }
                throw new HttpException(
                    {
                        statusCode: HttpStatus.CONFLICT,
                        error: "DUPLICATE_TRANSACTION",
                        message: "Transaction already exists for provider with a different payload"
                    },
                    HttpStatus.CONFLICT
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

            let referenceTransaction: WagerTransaction | undefined;
            if (kind === WagerTransactionKind.Refund || kind === WagerTransactionKind.Rollback) {
                if (!dto.referenceExternalTransactionId || dto.referenceExternalTransactionId.trim() === "") {
                    throw new BadRequestException(
                        `Transaction of kind '${kind}' requires 'referenceExternalTransactionId'`
                    );
                }
                const foundReference = await this.wagerTransactionRepository.findByProviderAndExternalId(
                    dto.providerId,
                    dto.referenceExternalTransactionId
                );
                if (!foundReference) {
                    throw new HttpException(
                        {
                            statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
                            error: "INVALID_REFERENCE",
                            message: `Referenced external transaction '${dto.referenceExternalTransactionId}' not found for provider '${dto.providerId}'`
                        },
                        HttpStatus.UNPROCESSABLE_ENTITY
                    );
                }
                referenceTransaction = foundReference;
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
                        transaction.reject("INSUFFICIENT_FUNDS");
                        await this.wagerTransactionRepository.save(transaction);
                        const rejectedOutbox = OutboxMessage.enqueue({
                            aggregateId: transaction.walletId,
                            eventType: "wager.rejected",
                            payload: serializeTransaction(transaction),
                            occurredAt: now
                        });
                        await this.outboxRepository.save(rejectedOutbox);
                        rejectedTransaction = serializeTransaction(transaction);
                        return rejectedTransaction;
                    }
                    transaction.fail("INTERNAL_ERROR");
                    await this.wagerTransactionRepository.save(transaction);
                    processingError = { error: err };
                    return serializeTransaction(transaction);
                }

                transaction.markProcessed(referenceTransaction?.id, now);
                await this.ledgerRepository.save(entry);
                await this.walletRepository.save(wallet);
            } else {
                transaction.markProcessed(referenceTransaction?.id, now);
            }

            await this.wagerTransactionRepository.save(transaction);
            const processedOutbox = OutboxMessage.enqueue({
                aggregateId: transaction.walletId,
                eventType: "wager.processed",
                payload: serializeTransaction(transaction),
                occurredAt: now
            });
            await this.outboxRepository.save(processedOutbox);
            return serializeTransaction(transaction);
        });

        if (rejectedTransaction) {
            throw new HttpException(
                {
                    statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
                    error: "INSUFFICIENT_FUNDS",
                    message: "Insufficient funds in wallet",
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
}
