import { EntitySchema } from "@mikro-orm/core";
import { WagerTransactionKind, WagerTransactionState, WagerTransactionStatus } from "../wager-transaction";

export const WagerTransactionSchema = new EntitySchema<WagerTransactionState>({
    class: WagerTransactionState,
    tableName: "wager_transactions",
    properties: {
        id: { type: "string", primary: true, defaultRaw: "gen_random_uuid()" },
        providerId: { fieldName: "provider_id", type: "string" },
        externalTransactionId: { fieldName: "external_transaction_id", type: "string" },
        idempotencyKey: { fieldName: "idempotency_key", type: "string" },
        payloadHash: { fieldName: "payload_hash", type: "string" },
        walletId: { fieldName: "wallet_id", type: "string" },
        playerId: { fieldName: "player_id", type: "string" },
        roundId: { fieldName: "round_id", type: "string" },
        gameId: { fieldName: "game_id", type: "string" },
        kind: {
            enum: true,
            items: () => WagerTransactionKind,
            nativeEnumName: "wager_transaction_kind"
        },
        amount: { fieldName: "amount", type: "string" },
        currency: { fieldName: "currency", type: "string" },
        referenceExternalTransactionId: {
            fieldName: "reference_external_transaction_id",
            type: "string",
            nullable: true
        },
        createdAt: { fieldName: "created_at", type: "datetime", defaultRaw: "now()" },
        status: {
            enum: true,
            items: () => WagerTransactionStatus,
            nativeEnumName: "wager_transaction_status"
        },
        referenceTransactionId: {
            fieldName: "reference_transaction_id",
            type: "string",
            nullable: true
        },
        failureCode: {
            fieldName: "failure_code",
            type: "string",
            nullable: true
        },
        processedAt: {
            fieldName: "processed_at",
            type: "datetime",
            nullable: true
        }
    },
    uniques: [{ properties: ["providerId", "externalTransactionId"] }, { properties: ["idempotencyKey"] }],
    indexes: [{ properties: ["walletId"] }, { properties: ["roundId"] }]
});
