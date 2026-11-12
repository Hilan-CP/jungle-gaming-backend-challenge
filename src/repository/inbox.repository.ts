import { Injectable } from "@nestjs/common";
import { EntityManager } from "@mikro-orm/postgresql";
import { InboxMessage } from "../entity/inbox";
import { InboxMessageSchema } from "../entity/database-schema/inbox-schema";

@Injectable()
export class InboxRepository {
    constructor(private readonly em: EntityManager) {}

    async save(message: InboxMessage): Promise<void> {
        this.em.persist(message);
    }

    async findByMessageIdAndConsumer(messageId: string, consumerName: string): Promise<InboxMessage | null> {
        return this.em.findOne(InboxMessageSchema, { messageId, consumerName });
    }
}
