import { EntitySchema } from "@mikro-orm/core";
import { WalletState } from "../wallet";

export const WalletSchema = new EntitySchema<WalletState>({
    class: WalletState,
    tableName: "wallets",
    properties: {
        id: { type: "string", primary: true, defaultRaw: "gen_random_uuid()" },
        playerId: { fieldName: "player_id", type: "string" },
        currency: { type: "string" },
        amount: { type: "string" },
        version: { type: "number", version: true },
        createdAt: { fieldName: "created_at", type: "datetime", defaultRaw: "now()" },
        updatedAt: { fieldName: "updated_at", type: "datetime", defaultRaw: "now()", onUpdate: () => "now()" }
    },
    uniques: [{ properties: ["playerId", "currency"] }]
});
