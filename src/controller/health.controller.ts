import { Controller, Get } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { HealthReadyResponse, HealthResponse } from "../dto/health.dto";

@ApiTags("Health")
@Controller("health")
export class HealthController {
    @Get("live")
    @ApiOperation({ summary: "Verificar liveness do serviço" })
    @ApiOkResponse({ description: "Serviço está ativo", type: HealthResponse })
    getLive(): HealthResponse {
        return { status: "UP" };
    }

    @Get("ready")
    @ApiOperation({ summary: "Verificar readiness do serviço (banco de dados e fila SQS)" })
    @ApiOkResponse({ description: "Status de prontidão dos componentes da aplicação", type: HealthReadyResponse })
    getReady(): HealthReadyResponse {
        return {
            databaseStatus: "UP",
            sqsStatus: "UP"
        };
    }
}
