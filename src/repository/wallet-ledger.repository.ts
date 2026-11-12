import { Injectable } from "@nestjs/common";
import { EntityManager, QueryOrder } from "@mikro-orm/postgresql";
import { WalletLedgerEntry } from "../entity/ledger";
import { WalletLedgerEntrySchema } from "../entity/database-schema/ledger-schema";

@Injectable()
export class WalletLedgerRepository {
    constructor(private readonly em: EntityManager) {}

    async save(entry: WalletLedgerEntry): Promise<void> {
        const entity = entry as any;
        entity.amount = entry.money.toJSON().amount;
        entity.currency = entry.money.currency;
        entity.balanceBeforeAmount = entry.balanceBefore.toJSON().amount;
        entity.balanceBeforeCurrency = entry.balanceBefore.currency;
        entity.balanceAfterAmount = entry.balanceAfter.toJSON().amount;
        entity.balanceAfterCurrency = entry.balanceAfter.currency;
        this.em.persist(entry);
    }

    async findByWalletId(walletId: string): Promise<WalletLedgerEntry[]> {
        return this.em.find(
            WalletLedgerEntrySchema,
            { walletId },
            {
                orderBy: { createdAt: QueryOrder.ASC }
            }
        );
    }
}
