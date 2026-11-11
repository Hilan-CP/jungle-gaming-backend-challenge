import { Module } from "@nestjs/common";
import { MikroOrmModule } from "@mikro-orm/nestjs";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import mikroOrmConfig from "./mikro-orm.config";
import { WalletController } from "./controller/wallet.controller";
import { WageringController } from "./controller/wagering.controller";
import { HealthController } from "./controller/health.controller";
import { WalletService } from "./service/wallet.service";
import { WageringService } from "./service/wagering.service";
import { WalletRepository } from "./repository/wallet.repository";
import { WagerTransactionRepository } from "./repository/wager-transaction.repository";
import { WalletLedgerRepository } from "./repository/wallet-ledger.repository";

@Module({
    imports: [MikroOrmModule.forRoot(mikroOrmConfig)],
    controllers: [AppController, WalletController, WageringController, HealthController],
    providers: [
        AppService,
        WalletRepository,
        WagerTransactionRepository,
        WalletLedgerRepository,
        WalletService,
        WageringService
    ]
})
export class AppModule {}
