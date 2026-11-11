import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post } from "@nestjs/common";
import { CreateWalletRequest, ReconciliationResponse, WalletResponse } from "../dto/wallet.dto";
import { WalletService } from "../service/wallet.service";

@Controller("wallets")
export class WalletController {
    constructor(private readonly walletService: WalletService) {}

    @Post()
    @HttpCode(HttpStatus.CREATED)
    async createWallet(@Body() body: CreateWalletRequest): Promise<WalletResponse> {
        return this.walletService.createWallet(body);
    }

    @Get(":walletId")
    async getWallet(@Param("walletId") walletId: string): Promise<WalletResponse> {
        return this.walletService.getWallet(walletId);
    }

    @Post(":walletId/reconciliation")
    @HttpCode(HttpStatus.OK)
    async reconcileWallet(@Param("walletId") walletId: string): Promise<ReconciliationResponse> {
        return this.walletService.reconcileWallet(walletId);
    }
}
