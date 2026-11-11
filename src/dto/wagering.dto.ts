import { type MoneyProps } from "../entity/money";
import { type FailureCode } from "../entity/wager-transaction";

export class CreateWagerTransactionRequest {
    providerId: string;
    externalTransactionId: string;
    playerId: string;
    walletId: string;
    roundId: string;
    gameId: string;
    kind: string;
    money: MoneyProps;
    referenceExternalTransactionId?: string;
}

export class WagerTransactionResponse {
    id: string;
    providerId: string;
    externalTransactionId: string;
    idempotencyKey: string;
    payloadHash: string;
    walletId: string;
    playerId: string;
    roundId: string;
    gameId: string;
    kind: string;
    money: MoneyProps;
    referenceExternalTransactionId: string | null;
    referenceTransactionId: string | null;
    status: string;
    failureCode: FailureCode | null;
    createdAt: Date;
    processedAt: Date | null;
}
