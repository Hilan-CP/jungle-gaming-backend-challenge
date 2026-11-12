import { UnbalancedLedgerEntryError } from "../error/unbalanced-ledger-entry.error";
import { Money } from "./money";

export enum LedgerDirection {
    Debit = "DEBIT",
    Credit = "CREDIT"
}

export interface CreateLedgerEntryProps {
    id: string;
    walletId: string;
    transactionId: string;
    direction: LedgerDirection;
    money: Money;
    balanceBefore: Money;
    balanceAfter: Money;
}

export class LedgerEntryState {
    public id: string;
    public walletId: string;
    public transactionId: string;
    public direction: LedgerDirection;
    public amount: string;
    public currency: string;
    public balanceBefore: string;
    public balanceAfter: string;
    public createdAt: Date;

    public constructor(ledgerEntry: WalletLedgerEntry) {
        this.id = ledgerEntry.id;
        this.walletId = ledgerEntry.walletId;
        this.transactionId = ledgerEntry.transactionId;
        this.direction = ledgerEntry.direction;
        this.amount = ledgerEntry.money.toJSON().amount;
        this.currency = ledgerEntry.money.currency;
        this.balanceBefore = ledgerEntry.balanceBefore.toJSON().amount;
        this.balanceAfter = ledgerEntry.balanceAfter.toJSON().amount;
        this.createdAt = ledgerEntry.createdAt;
    }
}

export class WalletLedgerEntry {
    private constructor(
        public readonly id: string,
        public readonly walletId: string,
        public readonly transactionId: string,
        public readonly direction: LedgerDirection,
        public readonly money: Money,
        public readonly balanceBefore: Money,
        public readonly balanceAfter: Money,
        public readonly createdAt: Date
    ) {}

    static create(props: CreateLedgerEntryProps): WalletLedgerEntry {
        const entry = new WalletLedgerEntry(
            props.id,
            props.walletId,
            props.transactionId,
            props.direction,
            props.money,
            props.balanceBefore,
            props.balanceAfter,
            new Date()
        );
        if (!entry.isBalanced()) {
            throw new UnbalancedLedgerEntryError();
        }
        return entry;
    }

    static rehydrate(state: LedgerEntryState): WalletLedgerEntry {
        return new WalletLedgerEntry(
            state.id,
            state.walletId,
            state.transactionId,
            state.direction,
            Money.from({ amount: state.amount, currency: state.currency }),
            Money.from({ amount: state.balanceBefore, currency: state.currency }),
            Money.from({ amount: state.balanceAfter, currency: state.currency }),
            state.createdAt
        );
    }

    isBalanced(): boolean {
        const expected =
            this.direction === LedgerDirection.Credit
                ? this.balanceBefore.add(this.money)
                : this.balanceBefore.subtract(this.money);
        return expected.equals(this.balanceAfter);
    }
}
