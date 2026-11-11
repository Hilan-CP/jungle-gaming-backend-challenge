import { Controller, Get, HttpCode, HttpStatus } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { EntityManager } from "@mikro-orm/postgresql";
import { SQSClient, ListQueuesCommand } from "@aws-sdk/client-sqs";
import { HealthReadyResponse, HealthResponse } from "../dto/health.dto";

@ApiTags("Health")
@Controller("health")
export class HealthController {
    private readonly sqsClient: SQSClient;

    constructor(private readonly em: EntityManager) {
        this.sqsClient = new SQSClient({
            endpoint: process.env.AWS_ENDPOINT_URL || "http://localhost:4566",
            region: process.env.AWS_DEFAULT_REGION || "us-east-1",
            credentials: {
                accessKeyId: process.env.AWS_ACCESS_KEY_ID || "test",
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "test"
            }
        });
    }

    @Get("live")
    @ApiOperation({ summary: "Verificar se a aplicação está ativa" })
    @ApiOkResponse({ description: "Serviço está ativo", type: HealthResponse })
    getLive(): HealthResponse {
        return { status: "UP" };
    }

    @Get("ready")
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: "Verificar se os componentes da aplicação estão ativos (banco de dados e fila SQS)" })
    @ApiOkResponse({ description: "Status de prontidão dos componentes da aplicação", type: HealthReadyResponse })
    async getReady(): Promise<HealthReadyResponse> {
        let databaseStatus = "DOWN";
        let sqsStatus = "DOWN";
        try {
            await this.em.getConnection().execute("SELECT 1");
            databaseStatus = "UP";
        } catch {
            databaseStatus = "DOWN";
        }
        try {
            await this.sqsClient.send(new ListQueuesCommand({}));
            sqsStatus = "UP";
        } catch {
            sqsStatus = "DOWN";
        }
        return {
            databaseStatus,
            sqsStatus
        };
    }
}
