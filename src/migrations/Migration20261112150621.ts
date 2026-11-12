import { Migration } from "@mikro-orm/migrations";

export class Migration20261112150621 extends Migration {
    override name = "Migration20261112150621";

    override up(): void | Promise<void> {
        this.addSql(
            `alter table "wallet_ledger_entries" drop column "balance_after_amount", drop column "balance_after_currency", drop column "balance_before_amount", drop column "balance_before_currency";`
        );
        this.addSql(
            `alter table "wallet_ledger_entries" add "balance_before" varchar(255) not null, add "balance_after" varchar(255) not null;`
        );
        this.addSql(`alter table "wallet_ledger_entries" alter column "created_at" set default now();`);
        this.addSql(`alter table "wallet_ledger_entries" alter column "id" set default gen_random_uuid();`);

        this.addSql(`alter table "wager_transactions" alter column "created_at" set default now();`);
        this.addSql(`alter table "wager_transactions" alter column "id" set default gen_random_uuid();`);
        this.addSql(`alter table "wager_transactions" alter column "processed_at" set default now();`);

        this.addSql(`alter table "wallets" drop column "balance_amount", drop column "balance_currency";`);
        this.addSql(`alter table "wallets" add "amount" varchar(255) not null;`);
    }

    override down(): void | Promise<void> {
        this.addSql(`alter table "wager_transactions" alter column "id" drop default;`);
        this.addSql(`alter table "wager_transactions" alter column "created_at" drop default;`);
        this.addSql(`alter table "wager_transactions" alter column "processed_at" drop default;`);

        this.addSql(`alter table "wallet_ledger_entries" drop column "balance_before", drop column "balance_after";`);
        this.addSql(
            `alter table "wallet_ledger_entries" add "balance_after_amount" varchar(255) not null, add "balance_after_currency" varchar(255) not null, add "balance_before_amount" varchar(255) not null, add "balance_before_currency" varchar(255) not null;`
        );
        this.addSql(`alter table "wallet_ledger_entries" alter column "id" drop default;`);
        this.addSql(`alter table "wallet_ledger_entries" alter column "created_at" drop default;`);

        this.addSql(`alter table "wallets" add "balance_currency" varchar(255) not null;`);
        this.addSql(`alter table "wallets" rename column "amount" to "balance_amount";`);
    }
}
