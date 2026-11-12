import { InvalidTransactionStateError } from "../../../src/error/invalid-transaction-state.error";
import { MissingReferenceError } from "../../../src/error/missing-reference.error";
import { LedgerDirection } from "../../../src/entity/ledger";
import { Money } from "../../../src/entity/money";
import {
    WagerTransaction,
    WagerTransactionKind,
    WagerTransactionState,
    WagerTransactionStatus
} from "../../../src/entity/wager-transaction";

const PROCESSED_AT = new Date("2026-02-01T10:00:00.000Z");

interface TransactionOptions {
    kind?: WagerTransactionKind;
    amount?: string;
    currency?: string;
    referenceExternalTransactionId?: string;
    payloadHash?: string;
}

function createTransaction(options: TransactionOptions = {}): WagerTransaction {
    return WagerTransaction.create({
        id: "transaction-1",
        providerId: "provider-1",
        externalTransactionId: "external-1",
        idempotencyKey: "provider-1:external-1",
        payloadHash: options.payloadHash ?? "payload-hash-1",
        walletId: "wallet-1",
        playerId: "player-1",
        roundId: "round-1",
        gameId: "game-1",
        kind: options.kind ?? WagerTransactionKind.Bet,
        money: Money.from({ amount: options.amount ?? "25.00", currency: options.currency ?? "BRL" }),
        referenceExternalTransactionId: options.referenceExternalTransactionId
    });
}

describe("WagerTransaction", () => {
    describe("instantiation and reference rules", () => {
        it("creates every new transaction with PENDING status", () => {
            const transaction = createTransaction();

            expect(transaction.status).toBe(WagerTransactionStatus.Pending);
            expect(transaction.referenceTransactionId).toBeUndefined();
            expect(transaction.failureCode).toBeUndefined();
            expect(transaction.processedAt).toBeUndefined();
            expect(transaction.createdAt).toBeInstanceOf(Date);
        });

        for (const kind of [WagerTransactionKind.Refund, WagerTransactionKind.Rollback]) {
            it(`requires referenceExternalTransactionId for ${kind}`, () => {
                expect(() => createTransaction({ kind })).toThrow(MissingReferenceError);
            });

            it(`accepts a reference for ${kind}`, () => {
                const transaction = createTransaction({
                    kind,
                    referenceExternalTransactionId: "external-bet"
                });

                expect(transaction.status).toBe(WagerTransactionStatus.Pending);
                expect(transaction.referenceExternalTransactionId).toBe("external-bet");
            });
        }

        for (const kind of [WagerTransactionKind.Bet, WagerTransactionKind.Win, WagerTransactionKind.Loss]) {
            it(`allows creation without a reference for ${kind}`, () => {
                const transaction = createTransaction({ kind });

                expect(transaction.status).toBe(WagerTransactionStatus.Pending);
                expect(transaction.referenceExternalTransactionId).toBeUndefined();
            });
        }

        it("rehydrates a transaction preserving its state and version-independent data", () => {
            const processedAt = new Date("2026-02-02T11:00:00.000Z");
            const transaction = WagerTransaction.rehydrate({
                id: "transaction-99",
                providerId: "provider-1",
                externalTransactionId: "external-99",
                idempotencyKey: "provider-1:external-99",
                payloadHash: "payload-hash-99",
                walletId: "wallet-1",
                playerId: "player-1",
                roundId: "round-99",
                gameId: "game-99",
                kind: WagerTransactionKind.Refund,
                amount: "12.34",
                currency: "BRL",
                createdAt: new Date("2026-01-01T00:00:00.000Z"),
                status: WagerTransactionStatus.Processed,
                referenceExternalTransactionId: "external-bet",
                referenceTransactionId: "transaction-bet",
                failureCode: undefined,
                processedAt
            });

            expect(transaction.id).toBe("transaction-99");
            expect(transaction.kind).toBe(WagerTransactionKind.Refund);
            expect(transaction.money.toJSON()).toEqual({ amount: "12.34", currency: "BRL" });
            expect(transaction.status).toBe(WagerTransactionStatus.Processed);
            expect(transaction.referenceTransactionId).toBe("transaction-bet");
            expect(transaction.processedAt).toBe(processedAt);

            const state = new WagerTransactionState(transaction);
            expect(state.amount).toBe("12.34");
            expect(state.currency).toBe("BRL");
            expect(state.status).toBe(WagerTransactionStatus.Processed);
        });
    });

    describe("state machine and terminal states", () => {
        it("transitions from PENDING to PROCESSED recording processedAt and referenceTransactionId", () => {
            const transaction = createTransaction();

            transaction.markProcessed("reference-transaction-1", PROCESSED_AT);

            expect(transaction.status).toBe(WagerTransactionStatus.Processed);
            expect(transaction.processedAt).toBe(PROCESSED_AT);
            expect(transaction.referenceTransactionId).toBe("reference-transaction-1");
            expect(transaction.isTerminal()).toBe(true);
        });

        it("transitions from PENDING to PENDING_REFERENCE", () => {
            const transaction = createTransaction({
                kind: WagerTransactionKind.Refund,
                referenceExternalTransactionId: "external-bet"
            });

            transaction.markPendingReference();

            expect(transaction.status).toBe(WagerTransactionStatus.PendingReference);
            expect(transaction.isTerminal()).toBe(false);
        });

        it("transitions to REJECTED with a valid failureCode", () => {
            const transaction = createTransaction();

            transaction.reject("INVALID_REFERENCE");

            expect(transaction.status).toBe(WagerTransactionStatus.Rejected);
            expect(transaction.failureCode).toBe("INVALID_REFERENCE");
            expect(transaction.isTerminal()).toBe(true);
        });

        it("transitions to FAILED with a valid failureCode", () => {
            const transaction = createTransaction();

            transaction.fail("PROVIDER_ERROR");

            expect(transaction.status).toBe(WagerTransactionStatus.Failed);
            expect(transaction.failureCode).toBe("PROVIDER_ERROR");
            expect(transaction.isTerminal()).toBe(true);
        });

        it("throws InvalidTransactionStateError when transitioning a PROCESSED transaction", () => {
            const transaction = createTransaction();
            transaction.markProcessed(undefined, PROCESSED_AT);

            expect(() => transaction.markProcessed("another-reference", PROCESSED_AT)).toThrow(
                InvalidTransactionStateError
            );
            expect(() => transaction.markPendingReference()).toThrow(InvalidTransactionStateError);
            expect(() => transaction.reject("INVALID_REFERENCE")).toThrow(InvalidTransactionStateError);
            expect(() => transaction.fail("INTERNAL_ERROR")).toThrow(InvalidTransactionStateError);
        });

        it("throws InvalidTransactionStateError when transitioning a REJECTED transaction", () => {
            const transaction = createTransaction();
            transaction.reject("INSUFFICIENT_FUNDS");

            expect(() => transaction.markProcessed(undefined, PROCESSED_AT)).toThrow(InvalidTransactionStateError);
            expect(() => transaction.markPendingReference()).toThrow(InvalidTransactionStateError);
        });

        it("throws InvalidTransactionStateError when transitioning a FAILED transaction", () => {
            const transaction = createTransaction();
            transaction.fail("INTERNAL_ERROR");

            expect(() => transaction.markProcessed(undefined, PROCESSED_AT)).toThrow(InvalidTransactionStateError);
            expect(() => transaction.reject("INVALID_REFERENCE")).toThrow(InvalidTransactionStateError);
        });
    });

    describe("domain queries", () => {
        it("reports whether the transaction affects the balance", () => {
            expect(createTransaction({ kind: WagerTransactionKind.Loss }).affectsBalance()).toBe(false);

            for (const kind of [
                WagerTransactionKind.Opening,
                WagerTransactionKind.Bet,
                WagerTransactionKind.Win,
                WagerTransactionKind.Refund,
                WagerTransactionKind.Rollback
            ]) {
                const reference =
                    kind === WagerTransactionKind.Refund || kind === WagerTransactionKind.Rollback
                        ? "external-bet"
                        : undefined;
                expect(createTransaction({ kind, referenceExternalTransactionId: reference }).affectsBalance()).toBe(
                    true
                );
            }
        });

        it("reports whether a reference is required", () => {
            expect(
                createTransaction({
                    kind: WagerTransactionKind.Refund,
                    referenceExternalTransactionId: "ref"
                }).requiresReference()
            ).toBe(true);
            expect(
                createTransaction({
                    kind: WagerTransactionKind.Rollback,
                    referenceExternalTransactionId: "ref"
                }).requiresReference()
            ).toBe(true);

            for (const kind of [
                WagerTransactionKind.Opening,
                WagerTransactionKind.Bet,
                WagerTransactionKind.Win,
                WagerTransactionKind.Loss
            ]) {
                expect(createTransaction({ kind }).requiresReference()).toBe(false);
            }
        });

        it("matches the payload by canonical hash", () => {
            const transaction = createTransaction({ payloadHash: "canonical-hash" });

            expect(transaction.matchesPayload("canonical-hash")).toBe(true);
            expect(transaction.matchesPayload("different-hash")).toBe(false);
        });

        it("reports whether a transaction kind can reverse another kind", () => {
            expect(WagerTransaction.canReverse(WagerTransactionKind.Refund, WagerTransactionKind.Bet)).toBe(true);
            expect(WagerTransaction.canReverse(WagerTransactionKind.Refund, WagerTransactionKind.Win)).toBe(false);
            expect(WagerTransaction.canReverse(WagerTransactionKind.Refund, WagerTransactionKind.Refund)).toBe(false);
            expect(WagerTransaction.canReverse(WagerTransactionKind.Refund, WagerTransactionKind.Loss)).toBe(false);

            expect(WagerTransaction.canReverse(WagerTransactionKind.Rollback, WagerTransactionKind.Bet)).toBe(true);
            expect(WagerTransaction.canReverse(WagerTransactionKind.Rollback, WagerTransactionKind.Win)).toBe(true);
            expect(WagerTransaction.canReverse(WagerTransactionKind.Rollback, WagerTransactionKind.Refund)).toBe(true);
            expect(WagerTransaction.canReverse(WagerTransactionKind.Rollback, WagerTransactionKind.Loss)).toBe(false);
            expect(WagerTransaction.canReverse(WagerTransactionKind.Rollback, WagerTransactionKind.Rollback)).toBe(
                false
            );

            expect(WagerTransaction.canReverse(WagerTransactionKind.Bet, WagerTransactionKind.Bet)).toBe(false);
            expect(WagerTransaction.canReverse(WagerTransactionKind.Win, WagerTransactionKind.Bet)).toBe(false);
        });

        it("resolves the ledger direction for each transaction kind", () => {
            expect(createTransaction({ kind: WagerTransactionKind.Opening }).ledgerDirectionFor()).toBe(
                LedgerDirection.Credit
            );
            expect(createTransaction({ kind: WagerTransactionKind.Win }).ledgerDirectionFor()).toBe(
                LedgerDirection.Credit
            );
            expect(
                createTransaction({
                    kind: WagerTransactionKind.Refund,
                    referenceExternalTransactionId: "external-bet"
                }).ledgerDirectionFor()
            ).toBe(LedgerDirection.Credit);
            expect(createTransaction({ kind: WagerTransactionKind.Bet }).ledgerDirectionFor()).toBe(
                LedgerDirection.Debit
            );
            expect(createTransaction({ kind: WagerTransactionKind.Loss }).ledgerDirectionFor()).toBe(
                LedgerDirection.Debit
            );
        });

        it("applies the inverse direction for ROLLBACK", () => {
            const refund = createTransaction({
                kind: WagerTransactionKind.Refund,
                referenceExternalTransactionId: "external-bet"
            });
            expect(refund.ledgerDirectionFor()).toBe(LedgerDirection.Credit);
            expect(refund.ledgerDirectionFor(createTransaction({ kind: WagerTransactionKind.Bet }))).toBe(
                LedgerDirection.Credit
            );

            expect(
                createTransaction({
                    kind: WagerTransactionKind.Rollback,
                    referenceExternalTransactionId: "external-bet"
                }).ledgerDirectionFor(createTransaction({ kind: WagerTransactionKind.Win }))
            ).toBe(LedgerDirection.Debit);

            expect(
                createTransaction({
                    kind: WagerTransactionKind.Rollback,
                    referenceExternalTransactionId: "external-bet"
                }).ledgerDirectionFor()
            ).toBe(LedgerDirection.Credit);
        });
    });
});
