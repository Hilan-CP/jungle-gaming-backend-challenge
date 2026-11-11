import { ApiProperty } from "@nestjs/swagger";

export class HealthResponse {
    @ApiProperty({ description: "Status de integridade do serviço", example: "UP" })
    status: string;
}

export class HealthReadyResponse {
    @ApiProperty({ description: "Status de conexão com o banco de dados", example: "UP" })
    databaseStatus: string;

    @ApiProperty({ description: "Status de conexão com a fila SQS", example: "UP" })
    sqsStatus: string;
}
