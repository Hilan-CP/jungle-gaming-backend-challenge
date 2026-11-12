import { Injectable } from "@nestjs/common";
import { EntityManager } from "@mikro-orm/postgresql";
import { WagerTransactionSchema } from "../entity/database-schema/wager-transaction-schema";
import { WagerTransaction, WagerTransactionState } from "../entity/wager-transaction";

@Injectable()
export class WagerTransactionRepository {
    constructor(private readonly em: EntityManager) {}

    async save(transaction: WagerTransactionState): Promise<void> {
        this.em.persist(transaction);
    }

    async update(transaction: WagerTransactionState): Promise<void> {
        const entity = await this.em.findOne(WagerTransactionSchema, { id: transaction.id });
        if (!entity) throw new Error(`WagerTransaction '${transaction.id}' not found`);

        this.em.assign(entity, transaction);
    }

    async findById(id: string): Promise<WagerTransaction | null> {
        const state = await this.em.findOne(WagerTransactionSchema, { id });
        if (!state) return null;
        return WagerTransaction.rehydrate(state);
    }

    async findByProviderAndExternalId(
        providerId: string,
        externalTransactionId: string
    ): Promise<WagerTransaction | null> {
        const state = await this.em.findOne(WagerTransactionSchema, { providerId, externalTransactionId });
        if (!state) return null;
        return WagerTransaction.rehydrate(state);
    }

    async findByIdempotencyKey(idempotencyKey: string): Promise<WagerTransaction | null> {
        const state = await this.em.findOne(WagerTransactionSchema, { idempotencyKey });
        if (!state) return null;
        return WagerTransaction.rehydrate(state);
    }

    async findByReferenceTransactionId(referenceTransactionId: string): Promise<WagerTransaction[]> {
        const states = await this.em.find(WagerTransactionSchema, { referenceTransactionId });
        return states.map((state) => WagerTransaction.rehydrate(state));
    }
}
