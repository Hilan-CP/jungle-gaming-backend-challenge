import { CurrencyMismatchError } from "../../../src/error/currency-mismatch.error";
import { InsufficientFundsError } from "../../../src/error/insufficient-funds.error";
import { InvalidMoneyAmountError } from "../../../src/error/invalid-money-amount.error";
import { LedgerDirection, WalletLedgerEntry } from "../../../src/entity/ledger";
import { Money } from "../../../src/entity/money";
import { Wallet, WalletState } from "../../../src/entity/wallet";

const TIMESTAMP = new Date("2026-01-15T12:00:00.000Z");

function brl(amount: string): Money {
    return Money.from({ amount, currency: "BRL" });
}

describe("Wallet", () => {
    describe("lifecycle (opening and rehydration)", () => {
        it("opens a new wallet with version 1 and the exact initial balance", () => {
            const wallet = Wallet.open({
                id: "wallet-1",
                playerId: "player-1",
                initialBalance: brl("100.00")
            });

            expect(wallet.id).toBe("wallet-1");
            expect(wallet.playerId).toBe("player-1");
            expect(wallet.currency).toBe("BRL");
            expect(wallet.balance.toJSON()).toEqual({ amount: "100.00", currency: "BRL" });
            expect(wallet.version).toBe(1);
            expect(wallet.createdAt).toEqual(wallet.updatedAt);
        });

        it("rehydrates an existing wallet preserving state and version without re-running creation rules", () => {
            const createdAt = new Date("2025-03-01T10:00:00.000Z");
            const updatedAt = new Date("2025-03-02T11:30:00.000Z");

            const wallet = Wallet.rehydrate({
                id: "wallet-42",
                playerId: "player-42",
                currency: "BRL",
                amount: "50.25",
                version: 7,
                createdAt,
                updatedAt
            });

            expect(wallet.id).toBe("wallet-42");
            expect(wallet.playerId).toBe("player-42");
            expect(wallet.currency).toBe("BRL");
            expect(wallet.balance.toJSON()).toEqual({ amount: "50.25", currency: "BRL" });
            expect(wallet.version).toBe(7);
            expect(wallet.createdAt).toBe(createdAt);
            expect(wallet.updatedAt).toBe(updatedAt);
        });

        it("exposes the wallet state for persistence", () => {
            const wallet = Wallet.rehydrate({
                id: "wallet-7",
                playerId: "player-7",
                currency: "BRL",
                amount: "12.34",
                version: 3,
                createdAt: new Date("2025-01-01T00:00:00.000Z"),
                updatedAt: new Date("2025-01-02T00:00:00.000Z")
            });

            const state = new WalletState(wallet);

            expect(state.id).toBe("wallet-7");
            expect(state.playerId).toBe("player-7");
            expect(state.currency).toBe("BRL");
            expect(state.amount).toBe("12.34");
            expect(state.version).toBe(3);
            expect(state.createdAt).toBe(wallet.createdAt);
            expect(state.updatedAt).toBe(wallet.updatedAt);
        });
    });

    describe("financial movements and invariants", () => {
        it("debits a value when there is enough balance and updates balance and updatedAt", () => {
            const wallet = Wallet.open({
                id: "wallet-1",
                playerId: "player-1",
                initialBalance: brl("100.00")
            });
            const initialUpdatedAt = wallet.updatedAt;

            const entry = wallet.debit(brl("25.00"), "transaction-1", "entry-1", TIMESTAMP);

            expect(entry).toBeInstanceOf(WalletLedgerEntry);
            expect(entry.direction).toBe(LedgerDirection.Debit);
            expect(entry.money.toJSON()).toEqual({ amount: "25.00", currency: "BRL" });
            expect(entry.balanceBefore.toJSON()).toEqual({ amount: "100.00", currency: "BRL" });
            expect(entry.balanceAfter.toJSON()).toEqual({ amount: "75.00", currency: "BRL" });
            expect(entry.isBalanced()).toBe(true);
            expect(wallet.balance.toJSON()).toEqual({ amount: "75.00", currency: "BRL" });
            expect(wallet.updatedAt).toBe(TIMESTAMP);
            expect(wallet.updatedAt).not.toBe(initialUpdatedAt);
        });

        it("throws insufficient funds when debiting more than the current balance and keeps the wallet unchanged", () => {
            const wallet = Wallet.open({
                id: "wallet-1",
                playerId: "player-1",
                initialBalance: brl("10.00")
            });
            const updatedAtBefore = wallet.updatedAt;

            expect(() => wallet.debit(brl("10.01"), "transaction-1", "entry-1", TIMESTAMP)).toThrow(
                InsufficientFundsError
            );

            expect(wallet.balance.toJSON()).toEqual({ amount: "10.00", currency: "BRL" });
            expect(wallet.updatedAt).toBe(updatedAtBefore);
        });

        it("rejects zero and negative debit amounts without changing the wallet", () => {
            const wallet = Wallet.open({
                id: "wallet-1",
                playerId: "player-1",
                initialBalance: brl("10.00")
            });
            const updatedAtBefore = wallet.updatedAt;

            expect(() => wallet.debit(brl("0.00"), "transaction-1", "entry-1", TIMESTAMP)).toThrow(
                InvalidMoneyAmountError
            );
            expect(() => wallet.debit(brl("1.00").negate(), "transaction-1", "entry-2", TIMESTAMP)).toThrow(
                InvalidMoneyAmountError
            );

            expect(wallet.balance.toJSON()).toEqual({ amount: "10.00", currency: "BRL" });
            expect(wallet.updatedAt).toBe(updatedAtBefore);
        });

        it("credits a value and increases the balance correctly", () => {
            const wallet = Wallet.open({
                id: "wallet-1",
                playerId: "player-1",
                initialBalance: brl("10.00")
            });

            const entry = wallet.credit(brl("15.50"), "transaction-2", "entry-2", TIMESTAMP);

            expect(entry.direction).toBe(LedgerDirection.Credit);
            expect(entry.balanceBefore.toJSON()).toEqual({ amount: "10.00", currency: "BRL" });
            expect(entry.balanceAfter.toJSON()).toEqual({ amount: "25.50", currency: "BRL" });
            expect(entry.isBalanced()).toBe(true);
            expect(wallet.balance.toJSON()).toEqual({ amount: "25.50", currency: "BRL" });
            expect(wallet.updatedAt).toBe(TIMESTAMP);
        });

        it("rejects zero and negative credit amounts without changing the wallet", () => {
            const wallet = Wallet.open({
                id: "wallet-1",
                playerId: "player-1",
                initialBalance: brl("10.00")
            });

            expect(() => wallet.credit(brl("0.00"), "transaction-2", "entry-1", TIMESTAMP)).toThrow(
                InvalidMoneyAmountError
            );
            expect(() => wallet.credit(brl("1.00").negate(), "transaction-2", "entry-2", TIMESTAMP)).toThrow(
                InvalidMoneyAmountError
            );

            expect(wallet.balance.toJSON()).toEqual({ amount: "10.00", currency: "BRL" });
        });

        it("throws a currency conflict when debiting with a currency different from the wallet", () => {
            const wallet = Wallet.open({
                id: "wallet-1",
                playerId: "player-1",
                initialBalance: brl("100.00")
            });

            expect(() =>
                wallet.debit(Money.from({ amount: "10.00", currency: "USD" }), "transaction-1", "entry-1", TIMESTAMP)
            ).toThrow(CurrencyMismatchError);

            expect(wallet.balance.toJSON()).toEqual({ amount: "100.00", currency: "BRL" });
        });

        it("throws a currency conflict when crediting with a currency different from the wallet", () => {
            const wallet = Wallet.open({
                id: "wallet-1",
                playerId: "player-1",
                initialBalance: brl("100.00")
            });

            expect(() =>
                wallet.credit(Money.from({ amount: "10.00", currency: "USD" }), "transaction-2", "entry-2", TIMESTAMP)
            ).toThrow(CurrencyMismatchError);

            expect(wallet.balance.toJSON()).toEqual({ amount: "100.00", currency: "BRL" });
        });
    });
});
