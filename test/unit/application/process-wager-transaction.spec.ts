import { BadRequestException, HttpException, HttpStatus, NotFoundException } from "@nestjs/common";
import type { EntityManager } from "@mikro-orm/postgresql";
import type { CreateWagerTransactionRequest } from "../../../src/dto/wagering.dto";
import { LedgerDirection, type LedgerEntryState } from "../../../src/entity/ledger";
import { Money } from "../../../src/entity/money";
import type { OutboxMessageState } from "../../../src/entity/outbox";
import { Wallet } from "../../../src/entity/wallet";
import {
    WagerTransaction,
    WagerTransactionKind,
    type WagerTransactionState,
    WagerTransactionStatus
} from "../../../src/entity/wager-transaction";
import type { OutboxRepository } from "../../../src/repository/outbox.repository";
import type { WagerTransactionRepository } from "../../../src/repository/wager-transaction.repository";
import type { WalletLedgerRepository } from "../../../src/repository/wallet-ledger.repository";
import type { WalletRepository } from "../../../src/repository/wallet.repository";
import { WageringService } from "../../../src/service/wagering.service";
import { computePayloadHash } from "../../../src/util/payload-hash.util";

const WALLET_ID = "wallet-1";
const PLAYER_ID = "player-1";
const PROVIDER_ID = "provider-1";
const PROCESSED_AT = new Date("2026-01-15T12:00:00.000Z");

interface TransactionOptions {
    id?: string;
    kind?: WagerTransactionKind;
    externalTransactionId?: string;
    amount?: string;
    currency?: string;
    referenceExternalTransactionId?: string;
    referenceTransactionId?: string;
    payloadHash?: string;
    processed?: boolean;
    processedAt?: Date;
}

function buildTransaction(options: TransactionOptions = {}): WagerTransaction {
    const transaction = WagerTransaction.create({
        id: options.id ?? "transaction-reference",
        providerId: PROVIDER_ID,
        externalTransactionId: options.externalTransactionId ?? "external-reference",
        idempotencyKey: `${PROVIDER_ID}:${options.externalTransactionId ?? "external-reference"}`,
        payloadHash: options.payloadHash ?? "payload-hash-reference",
        walletId: WALLET_ID,
        playerId: PLAYER_ID,
        roundId: "round-reference",
        gameId: "game-reference",
        kind: options.kind ?? WagerTransactionKind.Bet,
        money: Money.from({ amount: options.amount ?? "25.00", currency: options.currency ?? "BRL" }),
        referenceExternalTransactionId: options.referenceExternalTransactionId
    });

    if (options.processed) {
        transaction.markProcessed(options.referenceTransactionId, options.processedAt ?? PROCESSED_AT);
    }

    return transaction;
}

function makeDto(overrides: Partial<CreateWagerTransactionRequest> = {}): CreateWagerTransactionRequest {
    return {
        providerId: PROVIDER_ID,
        externalTransactionId: "external-new",
        playerId: PLAYER_ID,
        walletId: WALLET_ID,
        roundId: "round-1",
        gameId: "game-1",
        kind: "BET",
        money: { amount: "25.00", currency: "BRL" },
        ...overrides
    };
}

function createMocks() {
    const walletRepository = {
        save: jest.fn().mockResolvedValue(undefined),
        update: jest.fn().mockResolvedValue(undefined),
        findById: jest.fn(),
        findByPlayerId: jest.fn()
    };
    const wagerTransactionRepository = {
        save: jest.fn().mockResolvedValue(undefined),
        update: jest.fn().mockResolvedValue(undefined),
        findById: jest.fn(),
        findByProviderAndExternalId: jest.fn().mockResolvedValue(null),
        findByIdempotencyKey: jest.fn().mockResolvedValue(null),
        findByReferenceTransactionId: jest.fn().mockResolvedValue([])
    };
    const ledgerRepository = {
        save: jest.fn().mockResolvedValue(undefined),
        findByWalletId: jest.fn()
    };
    const outboxRepository = {
        save: jest.fn().mockResolvedValue(undefined),
        update: jest.fn().mockResolvedValue(undefined),
        findDueMessages: jest.fn()
    };
    const em = {
        transactional: jest.fn(async (callback: () => Promise<unknown>) => callback())
    };

    return { walletRepository, wagerTransactionRepository, ledgerRepository, outboxRepository, em };
}

async function captureHttpError(action: Promise<unknown>): Promise<HttpException> {
    try {
        await action;
    } catch (error) {
        if (error instanceof HttpException) {
            return error;
        }
        throw error;
    }

    throw new Error("Expected the operation to throw an HttpException");
}

describe("WageringService.processTransaction", () => {
    let mocks: ReturnType<typeof createMocks>;
    let service: WageringService;
    let wallet: Wallet;

    function setWallet(amount: string, currency = "BRL"): Wallet {
        wallet = Wallet.open({
            id: WALLET_ID,
            playerId: PLAYER_ID,
            initialBalance: Money.from({ amount, currency })
        });
        mocks.walletRepository.findById.mockResolvedValue(wallet);
        return wallet;
    }

    function setReference(reference: WagerTransaction | null): void {
        mocks.wagerTransactionRepository.findByProviderAndExternalId.mockImplementation(
            async (_providerId: string, externalTransactionId: string) =>
                reference && externalTransactionId === reference.externalTransactionId ? reference : null
        );
    }

    function savedLedgerStates(): LedgerEntryState[] {
        return mocks.ledgerRepository.save.mock.calls.map(([state]) => state as LedgerEntryState);
    }

    function savedTransactionStates(): WagerTransactionState[] {
        return mocks.wagerTransactionRepository.save.mock.calls.map(([state]) => state as WagerTransactionState);
    }

    function outboxEvents(): string[] {
        return mocks.outboxRepository.save.mock.calls.map(([state]) => (state as OutboxMessageState).eventType);
    }

    beforeEach(() => {
        mocks = createMocks();
        service = new WageringService(
            mocks.walletRepository as unknown as WalletRepository,
            mocks.wagerTransactionRepository as unknown as WagerTransactionRepository,
            mocks.ledgerRepository as unknown as WalletLedgerRepository,
            mocks.outboxRepository as unknown as OutboxRepository,
            mocks.em as unknown as EntityManager
        );
        setWallet("100.00");
    });

    describe("basic flows (BET, WIN, LOSS)", () => {
        it("BET debits the balance and creates one DEBIT ledger entry", async () => {
            const result = await service.processTransaction(makeDto());

            expect(result.status).toBe(WagerTransactionStatus.Processed);
            expect(result.kind).toBe(WagerTransactionKind.Bet);
            expect(result.idempotentReplay).toBe(false);
            expect(result.walletBalance).toEqual({ amount: "75.00", currency: "BRL" });
            expect(wallet.balance.toJSON()).toEqual({ amount: "75.00", currency: "BRL" });

            const ledgerStates = savedLedgerStates();
            expect(ledgerStates).toHaveLength(1);
            expect(ledgerStates[0].direction).toBe(LedgerDirection.Debit);
            expect(ledgerStates[0].amount).toBe("25.00");
            expect(ledgerStates[0].balanceBefore).toBe("100.00");
            expect(ledgerStates[0].balanceAfter).toBe("75.00");
            expect(ledgerStates[0].transactionId).toBe(result.id);

            expect(mocks.walletRepository.update).toHaveBeenCalledTimes(1);
            expect(mocks.wagerTransactionRepository.save).toHaveBeenCalledTimes(1);
            expect(savedTransactionStates()[0].status).toBe(WagerTransactionStatus.Processed);
            expect(outboxEvents()).toEqual(["wager.processed"]);
        });

        it("BET rejects the transaction without changing the balance or creating ledger entries when funds are insufficient", async () => {
            setWallet("10.00");

            const error = await captureHttpError(service.processTransaction(makeDto()));
            const body = error.getResponse() as {
                error: string;
                transaction: { status: string; failureCode: string };
            };

            expect(error.getStatus()).toBe(HttpStatus.UNPROCESSABLE_ENTITY);
            expect(body.error).toBe("INSUFFICIENT_FUNDS");
            expect(body.transaction.status).toBe(WagerTransactionStatus.Rejected);
            expect(body.transaction.failureCode).toBe("INSUFFICIENT_FUNDS");
            expect(wallet.balance.toJSON()).toEqual({ amount: "10.00", currency: "BRL" });
            expect(savedLedgerStates()).toHaveLength(0);
            expect(mocks.walletRepository.update).not.toHaveBeenCalled();
            expect(outboxEvents()).toEqual(["wager.rejected"]);
        });

        it("WIN credits the balance and creates one CREDIT ledger entry", async () => {
            setWallet("50.00");

            const result = await service.processTransaction(
                makeDto({ kind: "WIN", externalTransactionId: "external-win" })
            );

            expect(result.status).toBe(WagerTransactionStatus.Processed);
            expect(result.walletBalance).toEqual({ amount: "75.00", currency: "BRL" });
            expect(wallet.balance.toJSON()).toEqual({ amount: "75.00", currency: "BRL" });

            const ledgerStates = savedLedgerStates();
            expect(ledgerStates).toHaveLength(1);
            expect(ledgerStates[0].direction).toBe(LedgerDirection.Credit);
            expect(ledgerStates[0].amount).toBe("25.00");
            expect(ledgerStates[0].balanceBefore).toBe("50.00");
            expect(ledgerStates[0].balanceAfter).toBe("75.00");
        });

        it("LOSS marks the transaction as PROCESSED without changing the balance or creating ledger entries", async () => {
            const result = await service.processTransaction(
                makeDto({ kind: "LOSS", externalTransactionId: "external-loss" })
            );

            expect(result.status).toBe(WagerTransactionStatus.Processed);
            expect(result.walletBalance).toEqual({ amount: "100.00", currency: "BRL" });
            expect(wallet.balance.toJSON()).toEqual({ amount: "100.00", currency: "BRL" });
            expect(savedLedgerStates()).toHaveLength(0);
            expect(mocks.walletRepository.update).not.toHaveBeenCalled();
            expect(outboxEvents()).toEqual(["wager.processed"]);
        });
    });

    describe("reversal flows (REFUND and ROLLBACK)", () => {
        it("REFUND reverses a previously PROCESSED BET and creates one CREDIT ledger entry", async () => {
            const bet = buildTransaction({
                id: "transaction-bet",
                kind: WagerTransactionKind.Bet,
                externalTransactionId: "external-bet",
                amount: "25.00",
                processed: true
            });
            setReference(bet);

            const result = await service.processTransaction(
                makeDto({
                    kind: "REFUND",
                    externalTransactionId: "external-refund",
                    referenceExternalTransactionId: "external-bet"
                })
            );

            expect(result.status).toBe(WagerTransactionStatus.Processed);
            expect(result.referenceTransactionId).toBe("transaction-bet");
            expect(wallet.balance.toJSON()).toEqual({ amount: "125.00", currency: "BRL" });

            const ledgerStates = savedLedgerStates();
            expect(ledgerStates).toHaveLength(1);
            expect(ledgerStates[0].direction).toBe(LedgerDirection.Credit);
            expect(ledgerStates[0].balanceBefore).toBe("100.00");
            expect(ledgerStates[0].balanceAfter).toBe("125.00");
        });

        it("REFUND rejects a reference that is not a BET", async () => {
            const win = buildTransaction({
                kind: WagerTransactionKind.Win,
                externalTransactionId: "external-win",
                amount: "25.00",
                processed: true
            });
            setReference(win);

            const error = await captureHttpError(
                service.processTransaction(
                    makeDto({
                        kind: "REFUND",
                        externalTransactionId: "external-refund",
                        referenceExternalTransactionId: "external-win"
                    })
                )
            );
            const body = error.getResponse() as { error: string };

            expect(error.getStatus()).toBe(HttpStatus.UNPROCESSABLE_ENTITY);
            expect(body.error).toBe("INVALID_REFERENCE");
            expect(wallet.balance.toJSON()).toEqual({ amount: "100.00", currency: "BRL" });
            expect(savedLedgerStates()).toHaveLength(0);
            expect(mocks.walletRepository.update).not.toHaveBeenCalled();
        });

        it("REFUND rejects a BET that was already reversed", async () => {
            const bet = buildTransaction({
                kind: WagerTransactionKind.Bet,
                externalTransactionId: "external-bet",
                amount: "25.00",
                processed: true
            });
            const firstRefund = buildTransaction({
                id: "transaction-first-refund",
                kind: WagerTransactionKind.Refund,
                externalTransactionId: "external-first-refund",
                referenceExternalTransactionId: "external-bet",
                referenceTransactionId: bet.id,
                amount: "25.00",
                processed: true
            });
            setReference(bet);
            mocks.wagerTransactionRepository.findByReferenceTransactionId.mockResolvedValue([firstRefund]);

            const error = await captureHttpError(
                service.processTransaction(
                    makeDto({
                        kind: "REFUND",
                        externalTransactionId: "external-second-refund",
                        referenceExternalTransactionId: "external-bet"
                    })
                )
            );
            const body = error.getResponse() as { error: string };

            expect(body.error).toBe("INVALID_REFERENCE");
            expect(savedLedgerStates()).toHaveLength(0);
            expect(mocks.walletRepository.update).not.toHaveBeenCalled();
        });

        it.each([
            [WagerTransactionKind.Bet, LedgerDirection.Credit],
            [WagerTransactionKind.Win, LedgerDirection.Debit],
            [WagerTransactionKind.Refund, LedgerDirection.Debit]
        ])("ROLLBACK reverses a PROCESSED %s with the opposite ledger direction", async (kind, direction) => {
            const reference = buildTransaction({
                kind,
                externalTransactionId: "external-reference",
                referenceExternalTransactionId:
                    kind === WagerTransactionKind.Refund ? "external-original-bet" : undefined,
                amount: "25.00",
                processed: true
            });
            setReference(reference);

            const result = await service.processTransaction(
                makeDto({
                    kind: "ROLLBACK",
                    externalTransactionId: "external-rollback",
                    referenceExternalTransactionId: "external-reference"
                })
            );

            expect(result.status).toBe(WagerTransactionStatus.Processed);
            expect(result.referenceTransactionId).toBe(reference.id);
            expect(savedLedgerStates()).toHaveLength(1);
            expect(savedLedgerStates()[0].direction).toBe(direction);
            expect(wallet.balance.toJSON()).toEqual({
                amount: direction === LedgerDirection.Credit ? "125.00" : "75.00",
                currency: "BRL"
            });
        });

        it("rejects a reversal whose amount differs from the original transaction", async () => {
            const bet = buildTransaction({
                kind: WagerTransactionKind.Bet,
                externalTransactionId: "external-bet",
                amount: "25.00",
                processed: true
            });
            setReference(bet);

            const error = await captureHttpError(
                service.processTransaction(
                    makeDto({
                        kind: "ROLLBACK",
                        externalTransactionId: "external-rollback",
                        referenceExternalTransactionId: "external-bet",
                        money: { amount: "10.00", currency: "BRL" }
                    })
                )
            );
            const body = error.getResponse() as { error: string };

            expect(body.error).toBe("INVALID_REVERSAL_AMOUNT");
            expect(savedLedgerStates()).toHaveLength(0);
            expect(mocks.walletRepository.update).not.toHaveBeenCalled();
        });

        it("rejects a reversal that would make the wallet balance negative with a specific failure code", async () => {
            const win = buildTransaction({
                kind: WagerTransactionKind.Win,
                externalTransactionId: "external-win",
                amount: "150.00",
                processed: true
            });
            setReference(win);
            setWallet("100.00");

            const error = await captureHttpError(
                service.processTransaction(
                    makeDto({
                        kind: "ROLLBACK",
                        externalTransactionId: "external-rollback",
                        referenceExternalTransactionId: "external-win",
                        money: { amount: "150.00", currency: "BRL" }
                    })
                )
            );
            const body = error.getResponse() as { error: string; transaction: { failureCode: string } };

            expect(error.getStatus()).toBe(HttpStatus.UNPROCESSABLE_ENTITY);
            expect(body.error).toBe("REVERSAL_INSUFFICIENT_FUNDS");
            expect(body.error).not.toBe("INSUFFICIENT_FUNDS");
            expect(body.transaction.failureCode).toBe("REVERSAL_INSUFFICIENT_FUNDS");
            expect(wallet.balance.toJSON()).toEqual({ amount: "100.00", currency: "BRL" });
            expect(savedLedgerStates()).toHaveLength(0);
            expect(mocks.walletRepository.update).not.toHaveBeenCalled();
        });

        it("marks the transaction as PENDING_REFERENCE when the referenced transaction does not exist yet", async () => {
            setReference(null);

            const result = await service.processTransaction(
                makeDto({
                    kind: "REFUND",
                    externalTransactionId: "external-refund",
                    referenceExternalTransactionId: "external-missing"
                })
            );

            expect(result.status).toBe(WagerTransactionStatus.PendingReference);
            expect(result.idempotentReplay).toBe(false);
            expect(wallet.balance.toJSON()).toEqual({ amount: "100.00", currency: "BRL" });
            expect(savedLedgerStates()).toHaveLength(0);
            expect(mocks.walletRepository.update).not.toHaveBeenCalled();
            expect(outboxEvents()).toEqual(["wager.pending_reference"]);
        });

        it("marks the transaction as PENDING_REFERENCE when the referenced transaction is not processed yet", async () => {
            const pendingBet = buildTransaction({
                kind: WagerTransactionKind.Bet,
                externalTransactionId: "external-bet",
                amount: "25.00",
                processed: false
            });
            setReference(pendingBet);

            const result = await service.processTransaction(
                makeDto({
                    kind: "REFUND",
                    externalTransactionId: "external-refund",
                    referenceExternalTransactionId: "external-bet"
                })
            );

            expect(result.status).toBe(WagerTransactionStatus.PendingReference);
            expect(savedLedgerStates()).toHaveLength(0);
            expect(mocks.walletRepository.update).not.toHaveBeenCalled();
        });
    });

    describe("idempotency and payload conflicts", () => {
        it("returns the original state and balance with idempotentReplay for the same Idempotency-Key and identical payload", async () => {
            const dto = makeDto();
            const existing = buildTransaction({
                id: "transaction-existing",
                kind: WagerTransactionKind.Bet,
                externalTransactionId: dto.externalTransactionId,
                amount: "25.00",
                payloadHash: computePayloadHash(dto),
                processed: true
            });
            mocks.wagerTransactionRepository.findByIdempotencyKey.mockResolvedValue(existing);

            const result = await service.processTransaction(dto, "idempotency-key-1");

            expect(result.id).toBe("transaction-existing");
            expect(result.status).toBe(WagerTransactionStatus.Processed);
            expect(result.idempotentReplay).toBe(true);
            expect(result.walletBalance).toEqual({ amount: "100.00", currency: "BRL" });
            expect(savedLedgerStates()).toHaveLength(0);
            expect(mocks.walletRepository.update).not.toHaveBeenCalled();
            expect(mocks.wagerTransactionRepository.save).not.toHaveBeenCalled();
            expect(mocks.outboxRepository.save).not.toHaveBeenCalled();
        });

        it("throws a conflict, not a replay, when the same Idempotency-Key has a different payload hash", async () => {
            const dto = makeDto();
            const existing = buildTransaction({
                id: "transaction-existing",
                kind: WagerTransactionKind.Bet,
                externalTransactionId: dto.externalTransactionId,
                payloadHash: "different-payload-hash",
                processed: true
            });
            mocks.wagerTransactionRepository.findByIdempotencyKey.mockResolvedValue(existing);

            const error = await captureHttpError(service.processTransaction(dto, "idempotency-key-1"));
            const body = error.getResponse() as { error: string };

            expect(error.getStatus()).toBe(HttpStatus.CONFLICT);
            expect(body.error).toBe("PAYLOAD_MISMATCH");
            expect(savedLedgerStates()).toHaveLength(0);
            expect(mocks.walletRepository.update).not.toHaveBeenCalled();
            expect(mocks.wagerTransactionRepository.save).not.toHaveBeenCalled();
            expect(mocks.outboxRepository.save).not.toHaveBeenCalled();
        });

        it("throws a conflict when the provider/external id already exists with a different payload hash", async () => {
            const dto = makeDto();
            const existing = buildTransaction({
                externalTransactionId: dto.externalTransactionId,
                payloadHash: "different-payload-hash",
                processed: true
            });
            mocks.wagerTransactionRepository.findByProviderAndExternalId.mockResolvedValue(existing);

            const error = await captureHttpError(service.processTransaction(dto));
            const body = error.getResponse() as { error: string };

            expect(error.getStatus()).toBe(HttpStatus.CONFLICT);
            expect(body.error).toBe("DUPLICATE_TRANSACTION");
            expect(savedLedgerStates()).toHaveLength(0);
            expect(mocks.walletRepository.update).not.toHaveBeenCalled();
        });
    });

    describe("request validation", () => {
        it("throws when the wallet does not exist", async () => {
            mocks.walletRepository.findById.mockResolvedValue(null);

            await expect(service.processTransaction(makeDto())).rejects.toBeInstanceOf(NotFoundException);
        });

        it("throws when the player does not own the wallet", async () => {
            await expect(service.processTransaction(makeDto({ playerId: "another-player" }))).rejects.toBeInstanceOf(
                BadRequestException
            );
        });

        it("throws when the money amount is invalid", async () => {
            await expect(
                service.processTransaction(makeDto({ money: { amount: "10.999", currency: "BRL" } }))
            ).rejects.toBeInstanceOf(BadRequestException);
        });

        it("throws when the transaction currency differs from the wallet currency", async () => {
            await expect(
                service.processTransaction(makeDto({ money: { amount: "10.00", currency: "USD" } }))
            ).rejects.toBeInstanceOf(BadRequestException);
        });

        it("throws when a reversal has no referenceExternalTransactionId", async () => {
            await expect(
                service.processTransaction(makeDto({ kind: "REFUND", externalTransactionId: "external-refund" }))
            ).rejects.toBeInstanceOf(BadRequestException);
        });

        it("throws when the transaction kind is unsupported", async () => {
            await expect(service.processTransaction(makeDto({ kind: "UNKNOWN" }))).rejects.toBeInstanceOf(
                BadRequestException
            );
        });
    });

    describe("transaction queries", () => {
        it("returns a transaction by internal id", async () => {
            const transaction = buildTransaction({
                id: "transaction-1",
                externalTransactionId: "external-1",
                processed: true
            });
            mocks.wagerTransactionRepository.findById.mockResolvedValue(transaction);

            const result = await service.getTransactionById("transaction-1");

            expect(result.id).toBe("transaction-1");
            expect(result.status).toBe(WagerTransactionStatus.Processed);
        });

        it("throws when a transaction is not found by internal id", async () => {
            mocks.wagerTransactionRepository.findById.mockResolvedValue(null);

            await expect(service.getTransactionById("missing")).rejects.toBeInstanceOf(NotFoundException);
        });

        it("returns a transaction by provider and external id", async () => {
            const transaction = buildTransaction({
                id: "transaction-1",
                externalTransactionId: "external-1",
                processed: true
            });
            mocks.wagerTransactionRepository.findByProviderAndExternalId.mockResolvedValue(transaction);

            const result = await service.getTransactionByExternalId(PROVIDER_ID, "external-1");

            expect(result.externalTransactionId).toBe("external-1");
        });

        it("throws when a transaction is not found by provider and external id", async () => {
            mocks.wagerTransactionRepository.findByProviderAndExternalId.mockResolvedValue(null);

            await expect(service.getTransactionByExternalId(PROVIDER_ID, "missing")).rejects.toBeInstanceOf(
                NotFoundException
            );
        });
    });
});
