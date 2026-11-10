import { type WagerTransactionStatus } from "../entity/wager-transaction.js";

export class InvalidTransactionStateError extends Error {
    constructor(currentStatus: WagerTransactionStatus, attemptedTransition: string) {
        super(`Cannot perform "${attemptedTransition}" on a transaction with status "${currentStatus}"`);
    }
}
