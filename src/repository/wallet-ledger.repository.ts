import { Injectable } from "@nestjs/common";
import { EntityManager, QueryOrder } from "@mikro-orm/postgresql";
import { LedgerEntryState, WalletLedgerEntry } from "../entity/ledger";
import { WalletLedgerEntrySchema } from "../entity/database-schema/ledger-schema";

@Injectable()
export class WalletLedgerRepository {
    constructor(private readonly em: EntityManager) {}

    async save(entry: LedgerEntryState): Promise<WalletLedgerEntry> {
        await this.em.persist(entry).flush();
        return WalletLedgerEntry.rehydrate(entry);
    }

    async findByWalletId(walletId: string): Promise<WalletLedgerEntry[]> {
        const states = await this.em.find(
            WalletLedgerEntrySchema,
            { walletId },
            {
                orderBy: { createdAt: QueryOrder.ASC }
            }
        );
        if (!states) return [];
        return states.map((state) => WalletLedgerEntry.rehydrate(state));
    }
}
