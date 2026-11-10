import Decimal from "decimal.js";
import { CurrencyMismatchError } from "../error/currency-mismatch.error.js";
import { InvalidMoneyAmountError } from "../error/invalid-money-amount.error.js";

Decimal.set({ precision: 2, rounding: Decimal.ROUND_HALF_UP });

export interface MoneyProps {
    amount: string;
    currency: string;
}

export class Money {
    private constructor(
        private readonly value: Decimal,
        public readonly currency: string
    ) { }

    static from(props: MoneyProps): Money {
        let dec: Decimal;
        try {
            dec = new Decimal(props.amount);
        } catch {
            throw new InvalidMoneyAmountError(props.amount);
        }
        return new Money(dec, props.currency);
    }

    static zero(currency: string): Money {
        return new Money(new Decimal(0), currency);
    }

    add(other: Money): Money {
        this.assertSameCurrency(other);
        return new Money(this.value.plus(other.value), this.currency);
    }

    subtract(other: Money): Money {
        this.assertSameCurrency(other);
        return new Money(this.value.minus(other.value), this.currency);
    }

    negate(): Money {
        return new Money(this.value.negated(), this.currency);
    }

    isZero(): boolean {
        return this.value.isZero();
    }

    isPositive(): boolean {
        return this.value.isPositive() && !this.value.isZero();
    }

    isNegative(): boolean {
        return this.value.isNegative();
    }

    isLessThan(other: Money): boolean {
        this.assertSameCurrency(other);
        return this.value.lessThan(other.value);
    }

    equals(other: Money): boolean {
        if (this.currency !== other.currency) return false;
        return this.value.equals(other.value);
    }

    toJSON(): MoneyProps {
        return { amount: this.value.toFixed(), currency: this.currency };
    }

    toString(): string {
        return `${this.value.toFixed()} ${this.currency}`;
    }

    private assertSameCurrency(other: Money): void {
        if (this.currency !== other.currency) {
            throw new CurrencyMismatchError(this.currency, other.currency);
        }
    }
}
