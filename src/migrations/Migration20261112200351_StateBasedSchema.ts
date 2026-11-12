import { Migration } from "@mikro-orm/migrations";

export class Migration20261112200351_StateBasedSchema extends Migration {
    override name = "Migration20261112200351_StateBasedSchema";

    override up(): void | Promise<void> {
        // Ledger: consolida os pares *_amount/*_currency em colunas únicas,
        // preservando os dados existentes antes de remover as colunas antigas.
        this.addSql(`alter table "wallet_ledger_entries" add "balance_before" varchar(255);`);
        this.addSql(`alter table "wallet_ledger_entries" add "balance_after" varchar(255);`);
        this.addSql(
            `update "wallet_ledger_entries" set "balance_before" = "balance_before_amount", "balance_after" = "balance_after_amount";`
        );
        this.addSql(
            `alter table "wallet_ledger_entries" alter column "balance_before" set not null, alter column "balance_after" set not null;`
        );
        this.addSql(
            `alter table "wallet_ledger_entries" drop column "balance_after_amount", drop column "balance_after_currency", drop column "balance_before_amount", drop column "balance_before_currency";`
        );

        this.addSql(`alter table "wager_transactions" alter column "processed_at" drop default;`);

        // Wallet: consolida balance_amount/balance_currency em amount (currency já existe).
        this.addSql(`alter table "wallets" add "amount" varchar(255);`);
        this.addSql(`update "wallets" set "amount" = "balance_amount";`);
        this.addSql(`alter table "wallets" alter column "amount" set not null;`);
        this.addSql(`alter table "wallets" drop column "balance_amount", drop column "balance_currency";`);
    }

    override down(): void | Promise<void> {
        this.addSql(`alter table "wager_transactions" alter column "processed_at" set default now();`);

        // Ledger: recria os pares *_amount/*_currency a partir das colunas consolidadas.
        this.addSql(
            `alter table "wallet_ledger_entries" add "balance_before_amount" varchar(255), add "balance_before_currency" varchar(255), add "balance_after_amount" varchar(255), add "balance_after_currency" varchar(255);`
        );
        this.addSql(
            `update "wallet_ledger_entries" set "balance_before_amount" = "balance_before", "balance_before_currency" = "currency", "balance_after_amount" = "balance_after", "balance_after_currency" = "currency";`
        );
        this.addSql(
            `alter table "wallet_ledger_entries" alter column "balance_before_amount" set not null, alter column "balance_before_currency" set not null, alter column "balance_after_amount" set not null, alter column "balance_after_currency" set not null;`
        );
        this.addSql(`alter table "wallet_ledger_entries" drop column "balance_before", drop column "balance_after";`);

        // Wallet: volta de amount para balance_amount/balance_currency.
        this.addSql(`alter table "wallets" rename column "amount" to "balance_amount";`);
        this.addSql(`alter table "wallets" add "balance_currency" varchar(255);`);
        this.addSql(`update "wallets" set "balance_currency" = "currency";`);
        this.addSql(`alter table "wallets" alter column "balance_currency" set not null;`);
    }
}
