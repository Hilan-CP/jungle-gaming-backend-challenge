import { Injectable } from "@nestjs/common";
import { EntityManager } from "@mikro-orm/postgresql";
import { WagerTransaction } from "../entity/wager-transaction";
import { WagerTransactionSchema } from "../entity/database-schema/wager-transaction-schema";

@Injectable()
export class WagerTransactionRepository {
    constructor(private readonly em: EntityManager) {}

    async save(transaction: WagerTransaction): Promise<void> {
        const entity = transaction as any;
        entity.amount = transaction.money.toJSON().amount;
        entity.currency = transaction.money.currency;
        await this.em.persist(transaction).flush();
    }

    async findById(id: string): Promise<WagerTransaction | null> {
        return this.em.findOne(WagerTransactionSchema, { id });
    }

    async findByProviderAndExternalId(
        providerId: string,
        externalTransactionId: string
    ): Promise<WagerTransaction | null> {
        return this.em.findOne(WagerTransactionSchema, { providerId, externalTransactionId });
    }

    async findByIdempotencyKey(idempotencyKey: string): Promise<WagerTransaction | null> {
        return this.em.findOne(WagerTransactionSchema, { idempotencyKey });
    }
}
