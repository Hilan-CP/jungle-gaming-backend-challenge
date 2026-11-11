import { IsIn, IsNotEmpty, IsObject, IsOptional, IsString, ValidateNested } from "class-validator";
import { type MoneyProps } from "../entity/money";
import { type FailureCode } from "../entity/wager-transaction";
import { Type } from "class-transformer";
import { MoneyDto } from "./wallet.dto";

export class CreateWagerTransactionRequest {
    @IsString()
    @IsNotEmpty()
    providerId: string;

    @IsString()
    @IsNotEmpty()
    externalTransactionId: string;

    @IsString()
    @IsNotEmpty()
    playerId: string;

    @IsString()
    @IsNotEmpty()
    walletId: string;

    @IsString()
    @IsNotEmpty()
    roundId: string;

    @IsString()
    @IsNotEmpty()
    gameId: string;

    @IsString()
    @IsNotEmpty()
    @IsIn(["BET", "WIN", "LOSS", "REFUND", "ROLLBACK"])
    kind: string;

    @IsObject()
    @ValidateNested()
    @Type(() => MoneyDto)
    money: MoneyDto;

    @IsOptional()
    @IsString()
    @IsNotEmpty()
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
