import { CurrencyMismatchError } from "../error/currency-mismatch.error";
import { InsufficientFundsError } from "../error/insufficient-funds.error";
import { InvalidMoneyAmountError } from "../error/invalid-money-amount.error";
import { LedgerDirection, WalletLedgerEntry } from "./ledger";
import { Money } from "./money";

export class WalletState {
    public id: string;
    public playerId: string;
    public currency: string;
    public amount: string;
    public version: number;
    public createdAt: Date;
    public updatedAt: Date;

    public constructor(wallet: Wallet) {
        this.id = wallet.id;
        this.playerId = wallet.playerId;
        this.currency = wallet.currency;
        this.amount = wallet.balance.toJSON().amount;
        this.version = wallet.version;
        this.createdAt = wallet.createdAt;
        this.updatedAt = wallet.updatedAt;
    }
}

export class Wallet {
    private constructor(
        public readonly id: string,
        public readonly playerId: string,
        public readonly currency: string,
        private _balance: Money,
        private _version: number,
        public readonly createdAt: Date,
        private _updatedAt: Date
    ) {}

    static open(props: { id: string; playerId: string; initialBalance: Money }): Wallet {
        const now = new Date();
        return new Wallet(props.id, props.playerId, props.initialBalance.currency, props.initialBalance, 0, now, now);
    }

    static rehydrate(state: WalletState): Wallet {
        return new Wallet(
            state.id,
            state.playerId,
            state.currency,
            Money.from({ amount: state.amount, currency: state.currency }),
            state.version,
            state.createdAt,
            state.updatedAt
        );
    }

    get balance(): Money {
        return this._balance;
    }
    get version(): number {
        return this._version;
    }
    get updatedAt(): Date {
        return this._updatedAt;
    }

    debit(money: Money, transactionId: string, entryId: string, timestamp: Date): WalletLedgerEntry {
        this.assertSameCurrency(money);

        if (money.isLessThan(Money.zero(this.currency)) || money.isZero()) {
            throw new InvalidMoneyAmountError("Debit amount must be greater than 0");
        }

        if (this._balance.isLessThan(money)) {
            throw new InsufficientFundsError();
        }

        const balanceBefore = this._balance;
        const balanceAfter = this._balance.subtract(money);

        const entry = WalletLedgerEntry.create({
            id: entryId,
            walletId: this.id,
            transactionId,
            direction: LedgerDirection.Debit,
            money,
            balanceBefore,
            balanceAfter
        });

        this._balance = balanceAfter;
        this._updatedAt = timestamp;

        return entry;
    }

    credit(money: Money, transactionId: string, entryId: string, at: Date): WalletLedgerEntry {
        this.assertSameCurrency(money);

        if (money.isLessThan(Money.zero(this.currency)) || money.isZero()) {
            throw new InvalidMoneyAmountError("Credit amount must be greater than 0");
        }

        const balanceBefore = this._balance;
        const balanceAfter = this._balance.add(money);

        const entry = WalletLedgerEntry.create({
            id: entryId,
            walletId: this.id,
            transactionId,
            direction: LedgerDirection.Credit,
            money,
            balanceBefore,
            balanceAfter
        });

        this._balance = balanceAfter;
        this._updatedAt = at;

        return entry;
    }

    private assertSameCurrency(money: Money): void {
        if (this.currency !== money.currency) {
            throw new CurrencyMismatchError(this.currency, money.currency);
        }
    }
}
