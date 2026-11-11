import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post } from "@nestjs/common";
import {
    ApiBadRequestResponse,
    ApiCreatedResponse,
    ApiNotFoundResponse,
    ApiOkResponse,
    ApiOperation,
    ApiParam,
    ApiTags
} from "@nestjs/swagger";
import { CreateWalletRequest, ReconciliationResponse, WalletResponse } from "../dto/wallet.dto";
import { WalletService } from "../service/wallet.service";

@ApiTags("Wallets")
@Controller("wallets")
export class WalletController {
    constructor(private readonly walletService: WalletService) {}

    @Post()
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({ summary: "Criar uma nova carteira para um jogador" })
    @ApiCreatedResponse({ description: "Carteira criada com sucesso", type: WalletResponse })
    @ApiBadRequestResponse({ description: "Dados de requisição inválidos" })
    async createWallet(@Body() body: CreateWalletRequest): Promise<WalletResponse> {
        return this.walletService.createWallet(body);
    }

    @Get(":walletId")
    @ApiOperation({ summary: "Consultar carteira pelo ID" })
    @ApiParam({
        name: "walletId",
        description: "Identificador único da carteira (UUID)",
        example: "483760e7-c306-47d4-918c-3adf0ffa0aa4"
    })
    @ApiOkResponse({ description: "Carteira encontrada", type: WalletResponse })
    @ApiNotFoundResponse({ description: "Carteira não encontrada" })
    async getWallet(@Param("walletId") walletId: string): Promise<WalletResponse> {
        return this.walletService.getWallet(walletId);
    }

    @Post(":walletId/reconciliation")
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: "Reconciliar saldo da carteira com lançamentos do ledger" })
    @ApiParam({
        name: "walletId",
        description: "Identificador único da carteira (UUID)",
        example: "483760e7-c306-47d4-918c-3adf0ffa0aa4"
    })
    @ApiOkResponse({ description: "Resultado da reconciliação", type: ReconciliationResponse })
    @ApiNotFoundResponse({ description: "Carteira não encontrada" })
    async reconcileWallet(@Param("walletId") walletId: string): Promise<ReconciliationResponse> {
        return this.walletService.reconcileWallet(walletId);
    }
}
