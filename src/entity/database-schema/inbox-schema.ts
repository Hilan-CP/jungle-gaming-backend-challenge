import { EntitySchema } from "@mikro-orm/core";
import { InboxMessage } from "../inbox";

export const InboxMessageSchema = new EntitySchema<any>({
    class: InboxMessage as any,
    tableName: "inbox_messages",
    properties: {
        messageId: { fieldName: "message_id", type: "string", primary: true },
        consumerName: { fieldName: "consumer_name", type: "string", primary: true },
        payloadHash: { fieldName: "payload_hash", type: "string" },
        receivedAt: { fieldName: "received_at", type: "datetime", defaultRaw: "now()" },
        _processedAt: { fieldName: "processed_at", type: "datetime", nullable: true }
    },
    indexes: [{ properties: ["receivedAt"] }]
});
