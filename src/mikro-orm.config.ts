import { defineConfig, PostgreSqlDriver } from "@mikro-orm/postgresql";
import { Migrator } from "@mikro-orm/migrations";
import { WalletLedgerEntrySchema } from "./entity/database-schema/ledger-schema";
import { WalletSchema } from "./entity/database-schema/wallet-schema";
import { WagerTransactionSchema } from "./entity/database-schema/wager-transaction-schema";
import { InboxMessageSchema } from "./entity/database-schema/inbox-schema";
import { OutboxMessageSchema } from "./entity/database-schema/outbox-schema";

export default defineConfig({
    driver: PostgreSqlDriver,
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT) || 5432,
    user: process.env.DB_USER || "postgres",
    password: process.env.DB_PASSWORD || "postgres",
    dbName: process.env.DB_NAME || "wager_db",
    entities: [WalletLedgerEntrySchema, WalletSchema, WagerTransactionSchema, InboxMessageSchema, OutboxMessageSchema],
    extensions: [Migrator],
    migrations: {
        path: "./src/migrations",
        pathTs: "./src/migrations",
        emit: "ts"
    },
    debug: process.env.NODE_ENV !== "production"
});
