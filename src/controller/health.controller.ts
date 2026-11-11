import { Controller, Get } from "@nestjs/common";
import { HealthResponse } from "../dto/health.dto";

@Controller("health")
export class HealthController {
    @Get("live")
    getLive(): HealthResponse {
        return { status: "UP" };
    }

    @Get("ready")
    getReady(): HealthResponse {
        return { status: "UP" };
    }
}
