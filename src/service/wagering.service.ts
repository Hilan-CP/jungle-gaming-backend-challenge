import { BadRequestException, HttpException, HttpStatus, Injectable, NotFoundException } from "@nestjs/common";
import { createHash, randomUUID } from "node:crypto";
import { LedgerDirection, WalletLedgerEntry } from "../entity/ledger";
import { Money } from "../entity/money";
import { WagerTransaction, WagerTransactionKind } from "../entity/wager-transaction";
import { CreateWagerTransactionRequest, WagerTransactionResponse } from "../dto/wagering.dto";
import { InsufficientFundsError } from "../error/insufficient-funds.error";
import { WalletRepository } from "../repository/wallet.repository";
import { WagerTransactionRepository } from "../repository/wager-transaction.repository";
import { WalletLedgerRepository } from "../repository/wallet-ledger.repository";

export { CreateWagerTransactionRequest, WagerTransactionResponse };

function serializeTransaction(tx: WagerTransaction): WagerTransactionResponse {
    return {
        id: tx.id,
        providerId: tx.providerId,
        externalTransactionId: tx.externalTransactionId,
        idempotencyKey: tx.idempotencyKey,
        payloadHash: tx.payloadHash,
        walletId: tx.walletId,
        playerId: tx.playerId,
        roundId: tx.roundId,
        gameId: tx.gameId,
        kind: tx.kind,
        money: tx.money.toJSON(),
        referenceExternalTransactionId: tx.referenceExternalTransactionId ?? null,
        referenceTransactionId: tx.referenceTransactionId ?? null,
        status: tx.status,
        failureCode: tx.failureCode ?? null,
        createdAt: tx.createdAt,
        processedAt: tx.processedAt ?? null
    };
}

function computePayloadHash(dto: CreateWagerTransactionRequest): string {
    const canonical = {
        providerId: dto.providerId,
        externalTransactionId: dto.externalTransactionId,
        playerId: dto.playerId,
        walletId: dto.walletId,
        roundId: dto.roundId,
        gameId: dto.gameId,
        kind: dto.kind?.toUpperCase(),
        amount: dto.money?.amount,
        currency: dto.money?.currency,
        referenceExternalTransactionId: dto.referenceExternalTransactionId ?? null
    };
    return createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
}

@Injectable()
export class WageringService {
    constructor(
        private readonly walletRepository: WalletRepository,
        private readonly wagerTransactionRepository: WagerTransactionRepository,
        private readonly ledgerRepository: WalletLedgerRepository
    ) {}

    async processTransaction(
        dto: CreateWagerTransactionRequest,
        idempotencyKeyHeader?: string
    ): Promise<WagerTransactionResponse> {
        if (!dto?.providerId || typeof dto.providerId !== "string") {
            throw new BadRequestException("Field 'providerId' is required and must be a string");
        }
        if (!dto?.externalTransactionId || typeof dto.externalTransactionId !== "string") {
            throw new BadRequestException("Field 'externalTransactionId' is required and must be a string");
        }
        if (!dto?.playerId || typeof dto.playerId !== "string") {
            throw new BadRequestException("Field 'playerId' is required and must be a string");
        }
        if (!dto?.walletId || typeof dto.walletId !== "string") {
            throw new BadRequestException("Field 'walletId' is required and must be a string");
        }
        if (!dto?.roundId || typeof dto.roundId !== "string") {
            throw new BadRequestException("Field 'roundId' is required and must be a string");
        }
        if (!dto?.gameId || typeof dto.gameId !== "string") {
            throw new BadRequestException("Field 'gameId' is required and must be a string");
        }
        if (!dto?.kind || typeof dto.kind !== "string") {
            throw new BadRequestException("Field 'kind' is required");
        }
        if (!dto?.money || typeof dto.money !== "object" || !dto.money.amount || !dto.money.currency) {
            throw new BadRequestException("Field 'money' with 'amount' and 'currency' is required");
        }

        const kindUpper = dto.kind.toUpperCase();
        let kind: WagerTransactionKind;
        switch (kindUpper) {
            case "BET":
                kind = WagerTransactionKind.Bet;
                break;
            case "WIN":
                kind = WagerTransactionKind.Win;
                break;
            case "LOSS":
                kind = WagerTransactionKind.Loss;
                break;
            case "REFUND":
                kind = WagerTransactionKind.Refund;
                break;
            case "ROLLBACK":
                kind = WagerTransactionKind.Rollback;
                break;
            default:
                throw new BadRequestException(`Unsupported transaction kind '${dto.kind}'`);
        }

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
            throw new BadRequestException(`Player '${dto.playerId}' does not match wallet owner '${wallet.playerId}'`);
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

        let refTx: WagerTransaction | undefined;
        if (kind === WagerTransactionKind.Refund || kind === WagerTransactionKind.Rollback) {
            if (!dto.referenceExternalTransactionId) {
                throw new BadRequestException(
                    `Transaction of kind '${kind}' requires 'referenceExternalTransactionId'`
                );
            }
            const foundRef = await this.wagerTransactionRepository.findByProviderAndExternalId(
                dto.providerId,
                dto.referenceExternalTransactionId
            );
            if (!foundRef) {
                throw new HttpException(
                    {
                        statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
                        error: "INVALID_REFERENCE",
                        message: `Referenced external transaction '${dto.referenceExternalTransactionId}' not found for provider '${dto.providerId}'`
                    },
                    HttpStatus.UNPROCESSABLE_ENTITY
                );
            }
            refTx = foundRef;
        }

        const tx = WagerTransaction.create({
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
        if (tx.affectsBalance()) {
            const direction = tx.ledgerDirectionFor(refTx);
            const entryId = randomUUID();
            let entry: WalletLedgerEntry;

            try {
                if (direction === LedgerDirection.Debit) {
                    entry = wallet.debit(money, tx.id, entryId, now);
                } else {
                    entry = wallet.credit(money, tx.id, entryId, now);
                }
            } catch (err: any) {
                if (err instanceof InsufficientFundsError) {
                    tx.reject("INSUFFICIENT_FUNDS");
                    await this.wagerTransactionRepository.save(tx);
                    throw new HttpException(
                        {
                            statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
                            error: "INSUFFICIENT_FUNDS",
                            message: "Insufficient funds in wallet",
                            transaction: serializeTransaction(tx)
                        },
                        HttpStatus.UNPROCESSABLE_ENTITY
                    );
                }
                tx.fail("INTERNAL_ERROR");
                await this.wagerTransactionRepository.save(tx);
                throw err;
            }

            tx.markProcessed(refTx?.id, now);
            await this.ledgerRepository.save(entry);
            await this.walletRepository.save(wallet);
        } else {
            tx.markProcessed(refTx?.id, now);
        }

        await this.wagerTransactionRepository.save(tx);
        return serializeTransaction(tx);
    }

    async getTransactionById(transactionId: string): Promise<WagerTransactionResponse> {
        const tx = await this.wagerTransactionRepository.findById(transactionId);
        if (!tx) {
            throw new NotFoundException(`Transaction '${transactionId}' not found`);
        }
        return serializeTransaction(tx);
    }

    async getTransactionByExternalId(
        providerId: string,
        externalTransactionId: string
    ): Promise<WagerTransactionResponse> {
        const tx = await this.wagerTransactionRepository.findByProviderAndExternalId(providerId, externalTransactionId);
        if (!tx) {
            throw new NotFoundException(
                `Transaction '${externalTransactionId}' for provider '${providerId}' not found`
            );
        }
        return serializeTransaction(tx);
    }
}
