import { EntitySchema, Type, type Platform } from "@mikro-orm/core";
import { Money } from "../money";
import { WagerTransaction, WagerTransactionKind, WagerTransactionStatus } from "../wager-transaction";

export class TransactionMoneyCustomType extends Type<Money, any> {
    override convertToDatabaseValue(money: Money, platform?: Platform): any {
        return money?.toJSON ? money.toJSON().amount : money;
    }

    override convertToJSValue(value: any, platform?: Platform, entity?: any): Money {
        return Money.from({
            amount: value?.amount ?? value,
            currency: entity?.currency ?? value?.currency
        });
    }
}

export const WagerTransactionSchema = new EntitySchema<any>({
    class: WagerTransaction as any,
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

        money: {
            name: "money",
            type: TransactionMoneyCustomType,
            persist: false,
            getter: true,
            serializer: (tx: WagerTransaction) => tx.money.toJSON()
        },
        amount: { fieldName: "amount", type: "string", persist: true },
        currency: { fieldName: "currency", type: "string", persist: true },

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
            nullable: true,
            defaultRaw: "now()",
            onUpdate: () => "now()"
        }
    },
    uniques: [{ properties: ["providerId", "externalTransactionId"] }, { properties: ["idempotencyKey"] }],
    indexes: [{ properties: ["walletId"] }, { properties: ["roundId"] }]
});
