import { Migration } from "@mikro-orm/migrations";

export class Migration20261111010927 extends Migration {
    override name = "Migration20261111010927";

    override up(): void | Promise<void> {
        this.addSql(
            `create table "wager_transactions" ("id" varchar(255) not null, "provider_id" varchar(255) not null, "external_transaction_id" varchar(255) not null, "idempotency_key" varchar(255) not null, "payload_hash" varchar(255) not null, "wallet_id" varchar(255) not null, "player_id" varchar(255) not null, "round_id" varchar(255) not null, "game_id" varchar(255) not null, "kind" "wager_transaction_kind" not null, "amount" varchar(255) not null, "currency" varchar(255) not null, "reference_external_transaction_id" varchar(255) null, "created_at" timestamptz not null, "status" "wager_transaction_status" not null, "reference_transaction_id" varchar(255) null, "failure_code" varchar(255) null, "processed_at" timestamptz null, primary key ("id"));`
        );
        this.addSql(`create index "wager_transactions_wallet_id_index" on "wager_transactions" ("wallet_id");`);
        this.addSql(`create index "wager_transactions_round_id_index" on "wager_transactions" ("round_id");`);
        this.addSql(
            `alter table "wager_transactions" add constraint "wager_transactions_provider_id_external_transaction_id_unique" unique ("provider_id", "external_transaction_id");`
        );
        this.addSql(
            `alter table "wager_transactions" add constraint "wager_transactions_idempotency_key_unique" unique ("idempotency_key");`
        );

        this.addSql(
            `create table "wallets" ("id" varchar(255) not null default gen_random_uuid(), "player_id" varchar(255) not null, "currency" varchar(255) not null, "balance_amount" varchar(255) not null, "balance_currency" varchar(255) not null, "version" int not null default 1, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), primary key ("id"));`
        );
        this.addSql(
            `alter table "wallets" add constraint "wallets_player_id_currency_unique" unique ("player_id", "currency");`
        );

        this.addSql(
            `create table "wallet_ledger_entries" ("id" varchar(255) not null, "wallet_id" varchar(255) not null, "transaction_id" varchar(255) not null, "direction" "ledger_direction" not null, "amount" varchar(255) not null, "currency" varchar(255) not null, "balance_before_amount" varchar(255) not null, "balance_before_currency" varchar(255) not null, "balance_after_amount" varchar(255) not null, "balance_after_currency" varchar(255) not null, "created_at" timestamptz not null, primary key ("id"));`
        );
        this.addSql(`create index "wallet_ledger_entries_wallet_id_index" on "wallet_ledger_entries" ("wallet_id");`);
        this.addSql(
            `create index "wallet_ledger_entries_transaction_id_index" on "wallet_ledger_entries" ("transaction_id");`
        );
    }

    override down(): void | Promise<void> {
        this.addSql(`drop table if exists "wager_transactions" cascade;`);
        this.addSql(`drop table if exists "wallets" cascade;`);
        this.addSql(`drop table if exists "wallet_ledger_entries" cascade;`);
    }
}
