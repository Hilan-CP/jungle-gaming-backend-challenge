import { Migration } from "@mikro-orm/migrations";

export class Migration20261112170838_AddInboxOutboxMessages extends Migration {
    override name = "Migration20261112170838_AddInboxOutboxMessages";

    override up(): void | Promise<void> {
        this.addSql(
            `create table "inbox_messages" ("message_id" varchar(255) not null, "consumer_name" varchar(255) not null, "payload_hash" varchar(255) not null, "received_at" timestamptz not null default now(), "processed_at" timestamptz null, primary key ("message_id", "consumer_name"));`
        );
        this.addSql(`create index "inbox_messages_received_at_index" on "inbox_messages" ("received_at");`);

        this.addSql(
            `create table "outbox_messages" ("id" varchar(255) not null default gen_random_uuid(), "aggregate_id" varchar(255) not null, "event_type" varchar(255) not null, "payload" jsonb not null, "occurred_at" timestamptz not null default now(), "attempts" int not null default 0, "next_attempt_at" timestamptz null, "published_at" timestamptz null, primary key ("id"));`
        );
        this.addSql(`create index "outbox_messages_aggregate_id_index" on "outbox_messages" ("aggregate_id");`);
        this.addSql(
            `create index "outbox_messages_published_at_next_attempt_at_index" on "outbox_messages" ("published_at", "next_attempt_at");`
        );
        this.addSql(`create index "outbox_messages_occurred_at_index" on "outbox_messages" ("occurred_at");`);

        this.addSql(`alter table "wager_transactions" alter column "created_at" set default now();`);
        this.addSql(`alter table "wager_transactions" alter column "id" set default gen_random_uuid();`);
        this.addSql(`alter table "wager_transactions" alter column "processed_at" set default now();`);

        this.addSql(`alter table "wallet_ledger_entries" alter column "created_at" set default now();`);
        this.addSql(`alter table "wallet_ledger_entries" alter column "id" set default gen_random_uuid();`);
    }

    override down(): void | Promise<void> {
        this.addSql(`drop table if exists "inbox_messages" cascade;`);
        this.addSql(`drop table if exists "outbox_messages" cascade;`);

        this.addSql(`alter table "wager_transactions" alter column "id" drop default;`);
        this.addSql(`alter table "wager_transactions" alter column "created_at" drop default;`);
        this.addSql(`alter table "wager_transactions" alter column "processed_at" drop default;`);

        this.addSql(`alter table "wallet_ledger_entries" alter column "id" drop default;`);
        this.addSql(`alter table "wallet_ledger_entries" alter column "created_at" drop default;`);
    }
}
