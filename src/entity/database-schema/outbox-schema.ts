import { EntitySchema } from "@mikro-orm/core";
import { OutboxMessage } from "../outbox";

export const OutboxMessageSchema = new EntitySchema<any>({
    class: OutboxMessage as any,
    tableName: "outbox_messages",
    properties: {
        id: { type: "string", primary: true, defaultRaw: "gen_random_uuid()" },
        aggregateId: { fieldName: "aggregate_id", type: "string" },
        eventType: { fieldName: "event_type", type: "string" },
        payload: { type: "json" },
        occurredAt: { fieldName: "occurred_at", type: "datetime", defaultRaw: "now()" },
        _attempts: { fieldName: "attempts", type: "number", default: 0 },
        _nextAttemptAt: { fieldName: "next_attempt_at", type: "datetime", nullable: true },
        _publishedAt: { fieldName: "published_at", type: "datetime", nullable: true }
    },
    indexes: [
        { properties: ["aggregateId"] },
        {
            name: "outbox_messages_published_at_next_attempt_at_index",
            properties: ["_publishedAt", "_nextAttemptAt"]
        },
        { properties: ["occurredAt"] }
    ]
});
