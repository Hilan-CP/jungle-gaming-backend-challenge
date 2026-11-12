import { Injectable } from "@nestjs/common";
import { EntityManager } from "@mikro-orm/postgresql";
import { Wallet } from "../entity/wallet";
import { WalletSchema } from "../entity/database-schema/wallet-schema";

@Injectable()
export class WalletRepository {
    constructor(private readonly em: EntityManager) {}

    async save(wallet: Wallet): Promise<void> {
        const entity = wallet as any;
        entity.balanceAmount = wallet.balance.toJSON().amount;
        entity.balanceCurrency = wallet.currency;
        this.em.persist(wallet);
    }

    async findById(id: string): Promise<Wallet | null> {
        return this.em.findOne(WalletSchema, { id });
    }

    async findByPlayerId(playerId: string): Promise<Wallet[]> {
        return this.em.find(WalletSchema, { playerId });
    }
}
