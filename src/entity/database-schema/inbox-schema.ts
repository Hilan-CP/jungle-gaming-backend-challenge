import { EntitySchema } from "@mikro-orm/core";
import { InboxMessageState } from "../inbox";

export const InboxMessageSchema = new EntitySchema<InboxMessageState>({
    class: InboxMessageState,
    tableName: "inbox_messages",
    properties: {
        messageId: { fieldName: "message_id", type: "string", primary: true },
        consumerName: { fieldName: "consumer_name", type: "string", primary: true },
        payloadHash: { fieldName: "payload_hash", type: "string" },
        receivedAt: { fieldName: "received_at", type: "datetime", defaultRaw: "now()" },
        processedAt: { fieldName: "processed_at", type: "datetime", nullable: true }
    },
    indexes: [{ properties: ["receivedAt"] }]
});
