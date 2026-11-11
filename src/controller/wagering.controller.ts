import { Body, Controller, Get, Headers, HttpCode, HttpStatus, Param, Post } from "@nestjs/common";
import {
    ApiBadRequestResponse,
    ApiConflictResponse,
    ApiHeader,
    ApiNotFoundResponse,
    ApiOkResponse,
    ApiOperation,
    ApiParam,
    ApiTags,
    ApiUnprocessableEntityResponse
} from "@nestjs/swagger";
import { CreateWagerTransactionRequest, WagerTransactionResponse } from "../dto/wagering.dto";
import { WageringService } from "../service/wagering.service";

@ApiTags("Wagering")
@Controller()
export class WageringController {
    constructor(private readonly wageringService: WageringService) {}

    @Post("wagering/transactions")
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: "Processar transação de aposta (BET, WIN, LOSS, REFUND, ROLLBACK) com controle de idempotência"
    })
    @ApiHeader({
        name: "idempotency-key",
        required: false,
        description: "Chave de idempotência para evitar duplicidade de operações"
    })
    @ApiOkResponse({ description: "Transação processada com sucesso", type: WagerTransactionResponse })
    @ApiBadRequestResponse({ description: "Dados inválidos ou divergência de moeda" })
    @ApiConflictResponse({ description: "Conflito de idempotência com payload divergente" })
    @ApiUnprocessableEntityResponse({ description: "Saldo insuficiente ou transação de referência não encontrada" })
    async processTransaction(
        @Body() body: CreateWagerTransactionRequest,
        @Headers("idempotency-key") idempotencyKey?: string
    ): Promise<WagerTransactionResponse> {
        return this.wageringService.processTransaction(body, idempotencyKey);
    }

    @Get("wagering/transactions/:transactionId")
    @ApiOperation({ summary: "Consultar transação pelo ID interno" })
    @ApiParam({
        name: "transactionId",
        description: "Identificador único interno da transação",
        example: "0e7b82e7-f25a-494f-b42a-1f38609aa909"
    })
    @ApiOkResponse({ description: "Transação encontrada", type: WagerTransactionResponse })
    @ApiNotFoundResponse({ description: "Transação não encontrada" })
    async getTransactionById(@Param("transactionId") transactionId: string): Promise<WagerTransactionResponse> {
        return this.wageringService.getTransactionById(transactionId);
    }

    @Get("providers/:providerId/wagering/transactions/:externalTransactionId")
    @ApiOperation({ summary: "Consultar transação pelo provedor e ID externo" })
    @ApiParam({ name: "providerId", description: "Identificador do provedor", example: "evolution" })
    @ApiParam({
        name: "externalTransactionId",
        description: "Identificador externo da transação",
        example: "ext-tx-1001"
    })
    @ApiOkResponse({ description: "Transação encontrada", type: WagerTransactionResponse })
    @ApiNotFoundResponse({ description: "Transação não encontrada" })
    async getTransactionByExternalId(
        @Param("providerId") providerId: string,
        @Param("externalTransactionId") externalTransactionId: string
    ): Promise<WagerTransactionResponse> {
        return this.wageringService.getTransactionByExternalId(providerId, externalTransactionId);
    }
}
