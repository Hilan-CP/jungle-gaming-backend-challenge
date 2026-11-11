import { type MoneyProps } from "../entity/money";

export class CreateWalletRequest {
    playerId: string;
    initialBalance: MoneyProps;
}

export class WalletResponse {
    id: string;
    playerId: string;
    currency: string;
    balance: MoneyProps;
    version: number;
    createdAt: Date;
    updatedAt: Date;
}

export class ReconciliationResponse {
    walletId: string;
    storedBalance: MoneyProps;
    calculatedBalance: MoneyProps;
    difference: MoneyProps;
    consistent: boolean;
    checkedEntries: number;
}
