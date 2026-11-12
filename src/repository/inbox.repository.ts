import { Injectable } from "@nestjs/common";
import { EntityManager } from "@mikro-orm/postgresql";
import { InboxMessage, InboxMessageState } from "../entity/inbox";
import { InboxMessageSchema } from "../entity/database-schema/inbox-schema";

@Injectable()
export class InboxRepository {
    constructor(private readonly em: EntityManager) {}

    async save(message: InboxMessageState): Promise<void> {
        this.em.persist(message);
    }

    async update(message: InboxMessageState): Promise<void> {
        const entity = await this.em.findOne(InboxMessageSchema, {
            messageId: message.messageId,
            consumerName: message.consumerName
        });
        if (!entity) throw new Error(`InboxMessage '${message.messageId}' not found`);

        this.em.assign(entity, message);
    }

    async findByMessageIdAndConsumer(messageId: string, consumerName: string): Promise<InboxMessage | null> {
        const state = await this.em.findOne(InboxMessageSchema, { messageId, consumerName });
        if (!state) return null;
        return InboxMessage.rehydrate(state);
    }
}
