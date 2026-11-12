import { Module } from "@nestjs/common";
import { MikroOrmModule } from "@mikro-orm/nestjs";
import mikroOrmConfig from "./mikro-orm.config";
import { WalletController } from "./controller/wallet.controller";
import { WageringController } from "./controller/wagering.controller";
import { HealthController } from "./controller/health.controller";
import { WalletService } from "./service/wallet.service";
import { WageringService } from "./service/wagering.service";
import { WalletRepository } from "./repository/wallet.repository";
import { WagerTransactionRepository } from "./repository/wager-transaction.repository";
import { WalletLedgerRepository } from "./repository/wallet-ledger.repository";
import { InboxRepository } from "./repository/inbox.repository";
import { OutboxRepository } from "./repository/outbox.repository";
import { SqsClientProvider } from "./infra/sqs/sqs.client";
import { SqsPublisherService } from "./infra/sqs/sqs-publisher.service";
import { OutboxPublisherWorker } from "./worker/outbox-publisher.worker";
import { SqsConsumerWorker } from "./worker/sqs-consumer.worker";

@Module({
    imports: [MikroOrmModule.forRoot(mikroOrmConfig)],
    controllers: [WalletController, WageringController, HealthController],
    providers: [
        WalletRepository,
        WagerTransactionRepository,
        WalletLedgerRepository,
        InboxRepository,
        OutboxRepository,
        SqsClientProvider,
        SqsPublisherService,
        OutboxPublisherWorker,
        SqsConsumerWorker,
        WalletService,
        WageringService
    ]
})
export class AppModule {}
