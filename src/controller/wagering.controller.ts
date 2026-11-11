import { Body, Controller, Get, Headers, HttpCode, HttpStatus, Param, Post } from "@nestjs/common";
import { CreateWagerTransactionRequest, WagerTransactionResponse } from "../dto/wagering.dto";
import { WageringService } from "../service/wagering.service";

@Controller()
export class WageringController {
    constructor(private readonly wageringService: WageringService) {}

    @Post("wagering/transactions")
    @HttpCode(HttpStatus.OK)
    async processTransaction(
        @Body() body: CreateWagerTransactionRequest,
        @Headers("idempotency-key") idempotencyKey?: string
    ): Promise<WagerTransactionResponse> {
        return this.wageringService.processTransaction(body, idempotencyKey);
    }

    @Get("wagering/transactions/:transactionId")
    async getTransactionById(@Param("transactionId") transactionId: string): Promise<WagerTransactionResponse> {
        return this.wageringService.getTransactionById(transactionId);
    }

    @Get("providers/:providerId/wagering/transactions/:externalTransactionId")
    async getTransactionByExternalId(
        @Param("providerId") providerId: string,
        @Param("externalTransactionId") externalTransactionId: string
    ): Promise<WagerTransactionResponse> {
        return this.wageringService.getTransactionByExternalId(providerId, externalTransactionId);
    }
}
