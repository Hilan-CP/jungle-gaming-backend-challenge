import { CurrencyMismatchError } from "../../../src/error/currency-mismatch.error";
import { InvalidMoneyAmountError } from "../../../src/error/invalid-money-amount.error";
import { Money } from "../../../src/entity/money";

describe("Money", () => {
    describe("input validation and precision", () => {
        it("creates a valid instance from a decimal string with two decimal places", () => {
            const money = Money.from({ amount: "25.00", currency: "BRL" });

            expect(money.toJSON()).toEqual({ amount: "25.00", currency: "BRL" });
            expect(money.currency).toBe("BRL");
        });

        it("creates a valid instance from a decimal string with one decimal place", () => {
            const money = Money.from({ amount: "100.5", currency: "BRL" });

            expect(money.toJSON()).toEqual({ amount: "100.50", currency: "BRL" });
        });

        const invalidAmounts = [
            { description: "an empty string", amount: "" },
            { description: "NaN", amount: "NaN" },
            { description: "Infinity", amount: "Infinity" },
            { description: "negative Infinity", amount: "-Infinity" },
            { description: "scientific notation", amount: "1e5" },
            { description: "more than two decimal places", amount: "10.999" },
            { description: "a negative amount", amount: "-10.00" },
            { description: "a hexadecimal value", amount: "0x10" },
            { description: "a non-numeric value", amount: "ten" },
            { description: "a value with surrounding whitespace", amount: " 10.00 " }
        ];

        for (const { description, amount } of invalidAmounts) {
            it(`rejects ${description}`, () => {
                expect(() => Money.from({ amount, currency: "BRL" })).toThrow(InvalidMoneyAmountError);
            });
        }
    });

    describe("arithmetic and immutability", () => {
        it("adds two Money instances of the same currency without mutating the originals", () => {
            const left = Money.from({ amount: "25.00", currency: "BRL" });
            const right = Money.from({ amount: "10.50", currency: "BRL" });

            const result = left.add(right);

            expect(result).not.toBe(left);
            expect(result).not.toBe(right);
            expect(result.toJSON()).toEqual({ amount: "35.50", currency: "BRL" });
            expect(left.toJSON()).toEqual({ amount: "25.00", currency: "BRL" });
            expect(right.toJSON()).toEqual({ amount: "10.50", currency: "BRL" });
        });

        it("subtracts two Money instances of the same currency without mutating the originals", () => {
            const left = Money.from({ amount: "25.00", currency: "BRL" });
            const right = Money.from({ amount: "10.50", currency: "BRL" });

            const result = left.subtract(right);

            expect(result).not.toBe(left);
            expect(result.toJSON()).toEqual({ amount: "14.50", currency: "BRL" });
            expect(left.toJSON()).toEqual({ amount: "25.00", currency: "BRL" });
            expect(right.toJSON()).toEqual({ amount: "10.50", currency: "BRL" });
        });

        it("negates a monetary value", () => {
            const money = Money.from({ amount: "25.00", currency: "BRL" });

            const negated = money.negate();

            expect(negated.toJSON()).toEqual({ amount: "-25.00", currency: "BRL" });
            expect(negated.isNegative()).toBe(true);
            expect(money.isPositive()).toBe(true);
        });

        it("throws a domain error when adding different currencies", () => {
            const brl = Money.from({ amount: "25.00", currency: "BRL" });
            const usd = Money.from({ amount: "10.00", currency: "USD" });

            expect(() => brl.add(usd)).toThrow(CurrencyMismatchError);
        });

        it("throws a domain error when subtracting different currencies", () => {
            const brl = Money.from({ amount: "25.00", currency: "BRL" });
            const usd = Money.from({ amount: "10.00", currency: "USD" });

            expect(() => brl.subtract(usd)).toThrow(CurrencyMismatchError);
        });

        it("throws a domain error when comparing different currencies with isLessThan", () => {
            const brl = Money.from({ amount: "25.00", currency: "BRL" });
            const usd = Money.from({ amount: "10.00", currency: "USD" });

            expect(() => brl.isLessThan(usd)).toThrow(CurrencyMismatchError);
        });
    });

    describe("comparisons and serialization", () => {
        it("reports zero, positive and negative values correctly", () => {
            const zero = Money.zero("BRL");
            const positive = Money.from({ amount: "0.01", currency: "BRL" });
            const negative = positive.negate();

            expect(zero.isZero()).toBe(true);
            expect(zero.isPositive()).toBe(false);
            expect(zero.isNegative()).toBe(false);

            expect(positive.isZero()).toBe(false);
            expect(positive.isPositive()).toBe(true);
            expect(positive.isNegative()).toBe(false);

            expect(negative.isZero()).toBe(false);
            expect(negative.isPositive()).toBe(false);
            expect(negative.isNegative()).toBe(true);
        });

        it("compares amounts with isLessThan", () => {
            const smaller = Money.from({ amount: "10.00", currency: "BRL" });
            const larger = Money.from({ amount: "10.01", currency: "BRL" });

            expect(smaller.isLessThan(larger)).toBe(true);
            expect(larger.isLessThan(smaller)).toBe(false);
            expect(smaller.isLessThan(smaller)).toBe(false);
        });

        it("compares amount and currency with equals", () => {
            const money = Money.from({ amount: "25.00", currency: "BRL" });

            expect(money.equals(Money.from({ amount: "25.00", currency: "BRL" }))).toBe(true);
            expect(money.equals(Money.from({ amount: "25.01", currency: "BRL" }))).toBe(false);
            expect(money.equals(Money.from({ amount: "25.00", currency: "USD" }))).toBe(false);
        });

        it("serializes exactly through toJSON", () => {
            const money = Money.from({ amount: "25.00", currency: "BRL" });

            expect(money.toJSON()).toEqual({ amount: "25.00", currency: "BRL" });
            expect(JSON.parse(JSON.stringify(money))).toEqual({ amount: "25.00", currency: "BRL" });
        });

        it("serializes exactly through toString", () => {
            expect(Money.from({ amount: "25.00", currency: "BRL" }).toString()).toBe("25.00 BRL");
            expect(Money.from({ amount: "100.5", currency: "USD" }).toString()).toBe("100.50 USD");
        });
    });
});
