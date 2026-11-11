import { IsNotEmpty, IsObject, IsString, ValidateNested } from "class-validator";
import { type MoneyProps } from "../entity/money";
import { Type } from "class-transformer";

export class MoneyDto {
    @IsString()
    @IsNotEmpty()
    amount: string;

    @IsString()
    @IsNotEmpty()
    currency: string;
}

export class CreateWalletRequest {
    @IsString()
    @IsNotEmpty()
    playerId: string;

    @IsObject()
    @ValidateNested()
    @Type(() => MoneyDto)
    initialBalance: MoneyDto;
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
