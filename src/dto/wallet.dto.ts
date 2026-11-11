import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsNotEmpty, IsObject, IsString, ValidateNested } from "class-validator";
import { type MoneyProps } from "../entity/money";

export class MoneyDto implements MoneyProps {
    @ApiProperty({ description: "Valor monetário formatado com até duas casas decimais", example: "100.00" })
    @IsString()
    @IsNotEmpty()
    amount: string;

    @ApiProperty({ description: "Código da moeda (ISO 4217)", example: "USD" })
    @IsString()
    @IsNotEmpty()
    currency: string;
}

export class CreateWalletRequest {
    @ApiProperty({ description: "Identificador único do jogador", example: "player-123" })
    @IsString()
    @IsNotEmpty()
    playerId: string;

    @ApiProperty({ description: "Saldo inicial da carteira", type: () => MoneyDto })
    @IsObject()
    @ValidateNested()
    @Type(() => MoneyDto)
    initialBalance: MoneyDto;
}

export class WalletResponse {
    @ApiProperty({
        description: "Identificador único da carteira (UUID)",
        example: "483760e7-c306-47d4-918c-3adf0ffa0aa4"
    })
    id: string;

    @ApiProperty({ description: "Identificador do jogador proprietário", example: "player-123" })
    playerId: string;

    @ApiProperty({ description: "Moeda da carteira", example: "USD" })
    currency: string;

    @ApiProperty({ description: "Saldo atual da carteira", type: () => MoneyDto })
    balance: MoneyProps;

    @ApiProperty({ description: "Versão da carteira para controle de concorrência", example: 0 })
    version: number;

    @ApiProperty({ description: "Data de criação da carteira", example: "2026-11-11T14:37:50.756Z" })
    createdAt: Date;

    @ApiProperty({ description: "Data da última atualização", example: "2026-11-11T14:37:50.756Z" })
    updatedAt: Date;
}

export class ReconciliationResponse {
    @ApiProperty({ description: "Identificador da carteira", example: "483760e7-c306-47d4-918c-3adf0ffa0aa4" })
    walletId: string;

    @ApiProperty({ description: "Saldo persistido na carteira", type: () => MoneyDto })
    storedBalance: MoneyProps;

    @ApiProperty({ description: "Saldo calculado a partir dos lançamentos no ledger", type: () => MoneyDto })
    calculatedBalance: MoneyProps;

    @ApiProperty({ description: "Diferença entre o saldo armazenado e o saldo calculado", type: () => MoneyDto })
    difference: MoneyProps;

    @ApiProperty({ description: "Indica se o saldo armazenado é consistente com os lançamentos", example: true })
    consistent: boolean;

    @ApiProperty({ description: "Quantidade de lançamentos contábeis verificados", example: 5 })
    checkedEntries: number;
}
