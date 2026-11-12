import { Injectable } from "@nestjs/common";
import { EntityManager } from "@mikro-orm/postgresql";
import { WalletSchema } from "../entity/database-schema/wallet-schema";
import { Wallet, WalletState } from "../entity/wallet";

@Injectable()
export class WalletRepository {
    constructor(private readonly em: EntityManager) {}

    async save(wallet: WalletState): Promise<void> {
        this.em.persist(wallet);
    }

    async update(wallet: WalletState): Promise<void> {
        const entity = await this.em.findOne(WalletSchema, { id: wallet.id });
        if (!entity) throw new Error(`Wallet '${wallet.id}' not found`);

        this.em.assign(entity, wallet);
    }

    async findById(id: string): Promise<Wallet | null> {
        const state = await this.em.findOne(WalletSchema, { id });
        if (!state) return null;
        return Wallet.rehydrate(state);
    }

    async findByPlayerId(playerId: string): Promise<Wallet[]> {
        const states = await this.em.find(WalletSchema, { playerId });
        return states.map((state) => Wallet.rehydrate(state));
    }
}
