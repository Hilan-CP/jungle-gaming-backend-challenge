import { InvalidTransactionStateError } from "../error/invalid-transaction-state.error";
import { MissingReferenceError } from "../error/missing-reference.error";
import { LedgerDirection } from "./ledger";
import { Money } from "./money";

export enum WagerTransactionKind {
    Opening = "OPENING",
    Bet = "BET",
    Win = "WIN",
    Loss = "LOSS",
    Refund = "REFUND",
    Rollback = "ROLLBACK"
}

export enum WagerTransactionStatus {
    Pending = "PENDING",
    PendingReference = "PENDING_REFERENCE",
    Processed = "PROCESSED",
    Rejected = "REJECTED",
    Failed = "FAILED"
}

export type FailureCode =
    | "INSUFFICIENT_FUNDS"
    | "REVERSAL_INSUFFICIENT_FUNDS"
    | "INVALID_REVERSAL_AMOUNT"
    | "DUPLICATE_TRANSACTION"
    | "INVALID_REFERENCE"
    | "PAYLOAD_MISMATCH"
    | "PROVIDER_ERROR"
    | "INTERNAL_ERROR";

interface CreateWagerTransactionProps {
    id: string;
    providerId: string;
    externalTransactionId: string;
    idempotencyKey: string;
    payloadHash: string;
    walletId: string;
    playerId: string;
    roundId: string;
    gameId: string;
    kind: WagerTransactionKind;
    money: Money;
    referenceExternalTransactionId?: string;
}

export class WagerTransactionState {
    public id: string;
    public providerId: string;
    public externalTransactionId: string;
    public idempotencyKey: string;
    public payloadHash: string;
    public walletId: string;
    public playerId: string;
    public roundId: string;
    public gameId: string;
    public kind: WagerTransactionKind;
    public amount: string;
    public currency: string;
    public createdAt: Date;
    public status: WagerTransactionStatus;
    public referenceExternalTransactionId?: string;
    public referenceTransactionId?: string;
    public failureCode?: FailureCode;
    public processedAt?: Date;

    public constructor(wagerTransaction: WagerTransaction) {
        this.id = wagerTransaction.id;
        this.providerId = wagerTransaction.providerId;
        this.externalTransactionId = wagerTransaction.externalTransactionId;
        this.idempotencyKey = wagerTransaction.idempotencyKey;
        this.payloadHash = wagerTransaction.payloadHash;
        this.walletId = wagerTransaction.walletId;
        this.playerId = wagerTransaction.playerId;
        this.roundId = wagerTransaction.roundId;
        this.gameId = wagerTransaction.gameId;
        this.kind = wagerTransaction.kind;
        this.amount = wagerTransaction.money.toJSON().amount;
        this.currency = wagerTransaction.money.currency;
        this.createdAt = wagerTransaction.createdAt;
        this.status = wagerTransaction.status;
        this.referenceExternalTransactionId = wagerTransaction.referenceExternalTransactionId;
        this.referenceTransactionId = wagerTransaction.referenceTransactionId;
        this.failureCode = wagerTransaction.failureCode;
        this.processedAt = wagerTransaction.processedAt;
    }
}

const TERMINAL_STATUSES = new Set<WagerTransactionStatus>([
    WagerTransactionStatus.Processed,
    WagerTransactionStatus.Rejected,
    WagerTransactionStatus.Failed
]);

export class WagerTransaction {
    private constructor(
        public readonly id: string,
        public readonly providerId: string,
        public readonly externalTransactionId: string,
        public readonly idempotencyKey: string,
        public readonly payloadHash: string,
        public readonly walletId: string,
        public readonly playerId: string,
        public readonly roundId: string,
        public readonly gameId: string,
        public readonly kind: WagerTransactionKind,
        public readonly money: Money,
        public readonly referenceExternalTransactionId: string | undefined,
        public readonly createdAt: Date,
        private _status: WagerTransactionStatus,
        private _referenceTransactionId?: string,
        private _failureCode?: FailureCode,
        private _processedAt?: Date
    ) {}

    static create(props: CreateWagerTransactionProps): WagerTransaction {
        const transaction = new WagerTransaction(
            props.id,
            props.providerId,
            props.externalTransactionId,
            props.idempotencyKey,
            props.payloadHash,
            props.walletId,
            props.playerId,
            props.roundId,
            props.gameId,
            props.kind,
            props.money,
            props.referenceExternalTransactionId,
            new Date(),
            WagerTransactionStatus.Pending
        );

        if (transaction.requiresReference() && !props.referenceExternalTransactionId) {
            throw new MissingReferenceError(props.kind);
        }

        return transaction;
    }

    static rehydrate(state: WagerTransactionState): WagerTransaction {
        return new WagerTransaction(
            state.id,
            state.providerId,
            state.externalTransactionId,
            state.idempotencyKey,
            state.payloadHash,
            state.walletId,
            state.playerId,
            state.roundId,
            state.gameId,
            state.kind,
            Money.from({ amount: state.amount, currency: state.currency }),
            state.referenceExternalTransactionId,
            state.createdAt,
            state.status,
            state.referenceTransactionId,
            state.failureCode,
            state.processedAt
        );
    }

    get status(): WagerTransactionStatus {
        return this._status;
    }
    get referenceTransactionId(): string | undefined {
        return this._referenceTransactionId;
    }
    get failureCode(): FailureCode | undefined {
        return this._failureCode;
    }
    get processedAt(): Date | undefined {
        return this._processedAt;
    }

    markProcessed(referenceTransactionId: string | undefined, at: Date): void {
        this.assertNonTerminal(WagerTransactionStatus.Processed);
        this._referenceTransactionId = referenceTransactionId;
        this._processedAt = at;
        this._status = WagerTransactionStatus.Processed;
    }

    markPendingReference(): void {
        this.assertNonTerminal(WagerTransactionStatus.PendingReference);
        this._status = WagerTransactionStatus.PendingReference;
    }

    reject(code: FailureCode): void {
        this.assertNonTerminal(WagerTransactionStatus.Rejected);
        this._failureCode = code;
        this._status = WagerTransactionStatus.Rejected;
    }

    fail(code: FailureCode): void {
        this.assertNonTerminal(WagerTransactionStatus.Failed);
        this._failureCode = code;
        this._status = WagerTransactionStatus.Failed;
    }

    isTerminal(): boolean {
        return TERMINAL_STATUSES.has(this._status);
    }

    static canReverse(kind: WagerTransactionKind, referenceKind: WagerTransactionKind): boolean {
        if (kind === WagerTransactionKind.Refund) {
            return referenceKind === WagerTransactionKind.Bet;
        }
        if (kind === WagerTransactionKind.Rollback) {
            return (
                referenceKind === WagerTransactionKind.Bet ||
                referenceKind === WagerTransactionKind.Win ||
                referenceKind === WagerTransactionKind.Refund
            );
        }
        return false;
    }

    affectsBalance(): boolean {
        return this.kind !== WagerTransactionKind.Loss;
    }

    requiresReference(): boolean {
        return this.kind === WagerTransactionKind.Refund || this.kind === WagerTransactionKind.Rollback;
    }

    matchesPayload(payloadHash: string): boolean {
        return this.payloadHash === payloadHash;
    }

    ledgerDirectionFor(reference?: WagerTransaction): LedgerDirection {
        switch (this.kind) {
            case WagerTransactionKind.Opening:
            case WagerTransactionKind.Win:
            case WagerTransactionKind.Refund:
                return LedgerDirection.Credit;

            case WagerTransactionKind.Bet:
            case WagerTransactionKind.Loss:
                return LedgerDirection.Debit;

            case WagerTransactionKind.Rollback: {
                if (reference) {
                    const refDir = reference.ledgerDirectionFor();
                    return refDir === LedgerDirection.Debit ? LedgerDirection.Credit : LedgerDirection.Debit;
                }
                return LedgerDirection.Credit;
            }
        }
    }

    private assertNonTerminal(transition: string): void {
        if (this.isTerminal()) {
            throw new InvalidTransactionStateError(this._status, transition);
        }
    }
}
