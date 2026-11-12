import { Injectable } from "@nestjs/common";
import { EntityManager, QueryOrder } from "@mikro-orm/postgresql";
import { OutboxMessage, OutboxMessageState } from "../entity/outbox";
import { OutboxMessageSchema } from "../entity/database-schema/outbox-schema";

@Injectable()
export class OutboxRepository {
    constructor(private readonly em: EntityManager) {}

    async save(message: OutboxMessageState): Promise<void> {
        this.em.persist(message);
    }

    async update(message: OutboxMessageState): Promise<void> {
        const entity = await this.em.findOne(OutboxMessageSchema, { id: message.id });
        if (!entity) throw new Error(`OutboxMessage '${message.id}' not found`);

        this.em.assign(entity, message);
    }

    async findDueMessages(limit: number, now: Date): Promise<OutboxMessage[]> {
        const states = await this.em.find(
            OutboxMessageSchema,
            {
                publishedAt: null,
                $or: [{ nextAttemptAt: null }, { nextAttemptAt: { $lte: now } }]
            },
            {
                limit,
                orderBy: { occurredAt: QueryOrder.ASC }
            }
        );
        return states.map((state) => OutboxMessage.rehydrate(state));
    }
}
