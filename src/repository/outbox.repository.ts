import { Injectable } from "@nestjs/common";
import { EntityManager, QueryOrder } from "@mikro-orm/postgresql";
import { OutboxMessage } from "../entity/outbox";
import { OutboxMessageSchema } from "../entity/database-schema/outbox-schema";

@Injectable()
export class OutboxRepository {
    constructor(private readonly em: EntityManager) {}

    async save(message: OutboxMessage): Promise<void> {
        this.em.persist(message);
    }

    async findDueMessages(limit: number, now: Date): Promise<OutboxMessage[]> {
        return this.em.find(
            OutboxMessageSchema,
            {
                _publishedAt: null,
                $or: [{ _nextAttemptAt: null }, { _nextAttemptAt: { $lte: now } }]
            },
            {
                limit,
                orderBy: { occurredAt: QueryOrder.ASC }
            }
        );
    }
}
