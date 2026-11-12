import { EntitySchema } from "@mikro-orm/core";
import { LedgerDirection, LedgerEntryState } from "../ledger";

export const WalletLedgerEntrySchema = new EntitySchema<LedgerEntryState>({
    class: LedgerEntryState,
    tableName: "wallet_ledger_entries",
    properties: {
        id: { type: "string", primary: true, defaultRaw: "gen_random_uuid()" },
        walletId: { fieldName: "wallet_id", type: "string" },
        transactionId: { fieldName: "transaction_id", type: "string" },
        direction: {
            enum: true,
            items: () => LedgerDirection,
            nativeEnumName: "ledger_direction"
        },
        amount: { fieldName: "amount", type: "string" },
        currency: { fieldName: "currency", type: "string" },
        balanceBefore: { fieldName: "balance_before", type: "string" },
        balanceAfter: { fieldName: "balance_after", type: "string" },
        createdAt: { fieldName: "created_at", type: "datetime", defaultRaw: "now()" }
    },
    indexes: [{ properties: ["walletId"] }, { properties: ["transactionId"] }]
});
