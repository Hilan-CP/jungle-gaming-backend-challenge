export class UnbalancedLedgerEntryError extends Error {
    constructor() {
        super("Ledger entry is not balanced: balanceBefore ± money ≠ balanceAfter");
    }
}
