import { type WagerTransactionKind } from "../entity/wager-transaction.js";

export class MissingReferenceError extends Error {
    constructor(kind: WagerTransactionKind) {
        super(`Transaction of kind "${kind}" requires a referenceExternalTransactionId`);
    }
}
