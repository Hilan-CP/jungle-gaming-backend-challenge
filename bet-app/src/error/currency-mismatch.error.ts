export class CurrencyMismatchError extends Error {
    constructor(expected: string, received: string) {
        super(`Currency mismatch: expected ${expected}, got ${received}`);
    }
}
