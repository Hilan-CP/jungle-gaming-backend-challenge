import { UnbalancedLedgerEntryError } from "../../../src/error/unbalanced-ledger-entry.error";
import { LedgerDirection, LedgerEntryState, WalletLedgerEntry } from "../../../src/entity/ledger";
import { Money } from "../../../src/entity/money";

function brl(amount: string): Money {
    return Money.from({ amount, currency: "BRL" });
}

describe("WalletLedgerEntry", () => {
    describe("accounting consistency", () => {
        it("creates a DEBIT entry where balanceBefore - money equals balanceAfter", () => {
            const entry = WalletLedgerEntry.create({
                id: "entry-1",
                walletId: "wallet-1",
                transactionId: "transaction-1",
                direction: LedgerDirection.Debit,
                money: brl("25.00"),
                balanceBefore: brl("100.00"),
                balanceAfter: brl("75.00")
            });

            expect(entry.id).toBe("entry-1");
            expect(entry.walletId).toBe("wallet-1");
            expect(entry.transactionId).toBe("transaction-1");
            expect(entry.direction).toBe(LedgerDirection.Debit);
            expect(entry.money.toJSON()).toEqual({ amount: "25.00", currency: "BRL" });
            expect(entry.balanceBefore.toJSON()).toEqual({ amount: "100.00", currency: "BRL" });
            expect(entry.balanceAfter.toJSON()).toEqual({ amount: "75.00", currency: "BRL" });
            expect(entry.isBalanced()).toBe(true);
            expect(entry.createdAt).toBeInstanceOf(Date);
        });

        it("creates a CREDIT entry where balanceBefore + money equals balanceAfter", () => {
            const entry = WalletLedgerEntry.create({
                id: "entry-2",
                walletId: "wallet-1",
                transactionId: "transaction-2",
                direction: LedgerDirection.Credit,
                money: brl("25.00"),
                balanceBefore: brl("100.00"),
                balanceAfter: brl("125.00")
            });

            expect(entry.isBalanced()).toBe(true);
            expect(entry.balanceAfter.toJSON()).toEqual({ amount: "125.00", currency: "BRL" });
        });

        it("rejects an unbalanced DEBIT entry in the factory", () => {
            expect(() =>
                WalletLedgerEntry.create({
                    id: "entry-1",
                    walletId: "wallet-1",
                    transactionId: "transaction-1",
                    direction: LedgerDirection.Debit,
                    money: brl("25.00"),
                    balanceBefore: brl("100.00"),
                    balanceAfter: brl("80.00")
                })
            ).toThrow(UnbalancedLedgerEntryError);
        });

        it("rejects an unbalanced CREDIT entry in the factory", () => {
            expect(() =>
                WalletLedgerEntry.create({
                    id: "entry-1",
                    walletId: "wallet-1",
                    transactionId: "transaction-1",
                    direction: LedgerDirection.Credit,
                    money: brl("25.00"),
                    balanceBefore: brl("100.00"),
                    balanceAfter: brl("120.00")
                })
            ).toThrow(UnbalancedLedgerEntryError);
        });

        it("rehydrates a persisted ledger entry and exposes its state", () => {
            const createdAt = new Date("2026-03-01T08:00:00.000Z");
            const entry = WalletLedgerEntry.rehydrate({
                id: "entry-3",
                walletId: "wallet-1",
                transactionId: "transaction-3",
                direction: LedgerDirection.Credit,
                amount: "10.50",
                currency: "BRL",
                balanceBefore: "20.00",
                balanceAfter: "30.50",
                createdAt
            });

            expect(entry.isBalanced()).toBe(true);
            expect(entry.createdAt).toBe(createdAt);
            expect(entry.money.toJSON()).toEqual({ amount: "10.50", currency: "BRL" });

            const state = new LedgerEntryState(entry);
            expect(state.amount).toBe("10.50");
            expect(state.currency).toBe("BRL");
            expect(state.balanceBefore).toBe("20.00");
            expect(state.balanceAfter).toBe("30.50");
            expect(state.direction).toBe(LedgerDirection.Credit);
        });
    });
});
