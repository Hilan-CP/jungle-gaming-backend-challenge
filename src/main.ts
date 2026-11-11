import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { ValidationPipe, VersioningType } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";

async function bootstrap() {
    const app = await NestFactory.create(AppModule);
    app.setGlobalPrefix("api");
    app.enableVersioning({
        type: VersioningType.URI,
        defaultVersion: "1"
    });
    app.useGlobalPipes(
        new ValidationPipe({
            transform: true,
            whitelist: true
        })
    );

    const swaggerConfig = new DocumentBuilder()
        .setTitle("Jungle Gaming Wagering API")
        .setDescription("Documentação da API de Carteiras, Ledger e Transações de Apostas")
        .setVersion("1.0")
        .addApiKey(
            {
                type: "apiKey",
                name: "idempotency-key",
                in: "header",
                description: "Chave de idempotência para garantir unicidade em transações"
            },
            "idempotency-key"
        )
        .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup("api/docs", app, document);

    await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
