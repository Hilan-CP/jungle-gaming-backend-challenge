import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsIn, IsNotEmpty, IsObject, IsOptional, IsString, ValidateNested } from "class-validator";
import { type MoneyProps } from "../entity/money";
import { type FailureCode } from "../entity/wager-transaction";
import { MoneyDto } from "./wallet.dto";

export class CreateWagerTransactionRequest {
    @ApiProperty({ description: "Identificador do provedor do jogo", example: "evolution" })
    @IsString()
    @IsNotEmpty()
    providerId: string;

    @ApiProperty({ description: "Identificador externo da transação pelo provedor", example: "ext-tx-1001" })
    @IsString()
    @IsNotEmpty()
    externalTransactionId: string;

    @ApiProperty({ description: "Identificador do jogador", example: "player-123" })
    @IsString()
    @IsNotEmpty()
    playerId: string;

    @ApiProperty({
        description: "Identificador único da carteira (UUID)",
        example: "483760e7-c306-47d4-918c-3adf0ffa0aa4"
    })
    @IsString()
    @IsNotEmpty()
    walletId: string;

    @ApiProperty({ description: "Identificador da rodada", example: "round-42" })
    @IsString()
    @IsNotEmpty()
    roundId: string;

    @ApiProperty({ description: "Identificador do jogo", example: "roulette-vip" })
    @IsString()
    @IsNotEmpty()
    gameId: string;

    @ApiProperty({
        description: "Tipo de transação de aposta",
        enum: ["BET", "WIN", "LOSS", "REFUND", "ROLLBACK"],
        example: "BET"
    })
    @IsString()
    @IsNotEmpty()
    @IsIn(["BET", "WIN", "LOSS", "REFUND", "ROLLBACK"])
    kind: string;

    @ApiProperty({ description: "Valor e moeda da transação", type: () => MoneyDto })
    @IsObject()
    @ValidateNested()
    @Type(() => MoneyDto)
    money: MoneyDto;

    @ApiPropertyOptional({
        description: "Identificador externo da transação referenciada (obrigatório para REFUND e ROLLBACK)",
        example: "ext-tx-1001"
    })
    @IsOptional()
    @IsString()
    @IsNotEmpty()
    referenceExternalTransactionId?: string;
}

export class WagerTransactionResponse {
    @ApiProperty({
        description: "Identificador único interno da transação",
        example: "0e7b82e7-f25a-494f-b42a-1f38609aa909"
    })
    id: string;

    @ApiProperty({ description: "Identificador do provedor", example: "evolution" })
    providerId: string;

    @ApiProperty({ description: "Identificador externo no provedor", example: "ext-tx-1001" })
    externalTransactionId: string;

    @ApiProperty({ description: "Chave de idempotência da transação", example: "evolution:ext-tx-1001" })
    idempotencyKey: string;

    @ApiProperty({
        description: "Hash SHA-256 do payload canônico para proteção contra concorrência e divergência",
        example: "2a2641ddd6d6..."
    })
    payloadHash: string;

    @ApiProperty({ description: "Identificador da carteira", example: "483760e7-c306-47d4-918c-3adf0ffa0aa4" })
    walletId: string;

    @ApiProperty({ description: "Identificador do jogador", example: "player-123" })
    playerId: string;

    @ApiProperty({ description: "Identificador da rodada", example: "round-42" })
    roundId: string;

    @ApiProperty({ description: "Identificador do jogo", example: "roulette-vip" })
    gameId: string;

    @ApiProperty({ description: "Tipo de transação", example: "BET" })
    kind: string;

    @ApiProperty({ description: "Valor e moeda da transação", type: () => MoneyDto })
    money: MoneyProps;

    @ApiProperty({ description: "ID externo da transação referenciada", nullable: true, example: null })
    referenceExternalTransactionId: string | null;

    @ApiProperty({ description: "ID interno da transação referenciada", nullable: true, example: null })
    referenceTransactionId: string | null;

    @ApiProperty({ description: "Status de processamento da transação", example: "PROCESSED" })
    status: string;

    @ApiProperty({ description: "Código de falha se houver", nullable: true, example: null })
    failureCode: FailureCode | null;

    @ApiProperty({ description: "Data de criação da transação", example: "2026-11-11T14:38:00.774Z" })
    createdAt: Date;

    @ApiProperty({
        description: "Data em que a transação foi processada",
        nullable: true,
        example: "2026-11-11T14:38:00.774Z"
    })
    processedAt: Date | null;

    @ApiProperty({ description: "Indica que a resposta veio de um replay idempotente", example: false })
    idempotentReplay: boolean;

    @ApiProperty({
        description: "Saldo da carteira após o processamento (ou saldo original no replay idempotente)",
        type: () => MoneyDto,
        nullable: true
    })
    walletBalance: MoneyProps | null;
}
