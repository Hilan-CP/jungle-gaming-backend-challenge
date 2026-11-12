import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { EntityManager } from "@mikro-orm/postgresql";
import { randomUUID } from "node:crypto";
import { Wallet, WalletState } from "../entity/wallet";
import { LedgerDirection, LedgerEntryState, WalletLedgerEntry } from "../entity/ledger";
import { Money } from "../entity/money";
import { WagerTransaction, WagerTransactionKind, WagerTransactionState } from "../entity/wager-transaction";
import { OutboxMessage, OutboxMessageState } from "../entity/outbox";
import { CreateWalletRequest, ReconciliationResponse, WalletResponse } from "../dto/wallet.dto";
import { WalletRepository } from "../repository/wallet.repository";
import { WalletLedgerRepository } from "../repository/wallet-ledger.repository";
import { WagerTransactionRepository } from "../repository/wager-transaction.repository";
import { OutboxRepository } from "../repository/outbox.repository";
import { computePayloadHash } from "../util/payload-hash.util";

export { CreateWalletRequest, ReconciliationResponse, WalletResponse };

function serializeWallet(wallet: Wallet): WalletResponse {
    return {
        id: wallet.id,
        playerId: wallet.playerId,
        currency: wallet.currency,
        balance: wallet.balance.toJSON(),
        version: wallet.version,
        createdAt: wallet.createdAt,
        updatedAt: wallet.updatedAt
    };
}

@Injectable()
export class WalletService {
    constructor(
        private readonly walletRepository: WalletRepository,
        private readonly ledgerRepository: WalletLedgerRepository,
        private readonly wagerTransactionRepository: WagerTransactionRepository,
        private readonly outboxRepository: OutboxRepository,
        private readonly em: EntityManager
    ) {}

    async createWallet(request: CreateWalletRequest): Promise<WalletResponse> {
        let initialMoney: Money;
        try {
            initialMoney = Money.from(request.initialBalance);
        } catch (err: any) {
            throw new BadRequestException(err?.message ?? "Invalid money amount or currency");
        }

        return this.em.transactional(async () => {
            const walletId = randomUUID();
            const wallet = Wallet.open({
                id: walletId,
                playerId: request.playerId,
                initialBalance: initialMoney
            });

            await this.walletRepository.save(new WalletState(wallet));

            const openingTransactionId = randomUUID();
            const payloadHash = computePayloadHash({
                providerId: "system",
                externalTransactionId: `opening-${wallet.id}`,
                playerId: wallet.playerId,
                walletId: wallet.id,
                roundId: "opening",
                gameId: "opening",
                kind: WagerTransactionKind.Opening,
                money: initialMoney.toJSON()
            });
            const openingTransaction = WagerTransaction.create({
                id: openingTransactionId,
                providerId: "system",
                externalTransactionId: `opening-${wallet.id}`,
                idempotencyKey: `system:opening-${wallet.id}`,
                payloadHash,
                walletId: wallet.id,
                playerId: wallet.playerId,
                roundId: "opening",
                gameId: "opening",
                kind: WagerTransactionKind.Opening,
                money: initialMoney
            });
            openingTransaction.markProcessed(undefined, wallet.createdAt);
            await this.wagerTransactionRepository.save(new WagerTransactionState(openingTransaction));

            const openingEntry = WalletLedgerEntry.create({
                id: randomUUID(),
                walletId: wallet.id,
                transactionId: openingTransactionId,
                direction: LedgerDirection.Credit,
                money: initialMoney,
                balanceBefore: Money.zero(initialMoney.currency),
                balanceAfter: initialMoney
            });
            await this.ledgerRepository.save(new LedgerEntryState(openingEntry));

            const walletCreatedOutbox = OutboxMessage.enqueue({
                aggregateId: wallet.id,
                eventType: "wallet.created",
                payload: {
                    walletId: wallet.id,
                    playerId: wallet.playerId,
                    currency: wallet.currency,
                    initialBalance: initialMoney.toJSON()
                },
                occurredAt: wallet.createdAt
            });
            await this.outboxRepository.save(new OutboxMessageState(walletCreatedOutbox));

            return serializeWallet(wallet);
        });
    }

    async getWallet(walletId: string): Promise<WalletResponse> {
        const wallet = await this.walletRepository.findById(walletId);
        if (!wallet) {
            throw new NotFoundException(`Wallet '${walletId}' not found`);
        }
        return serializeWallet(wallet);
    }

    async reconcileWallet(walletId: string): Promise<ReconciliationResponse> {
        const wallet = await this.walletRepository.findById(walletId);
        if (!wallet) {
            throw new NotFoundException(`Wallet '${walletId}' not found`);
        }

        const entries = await this.ledgerRepository.findByWalletId(walletId);
        let calculated = Money.zero(wallet.currency);

        for (const entry of entries) {
            if (entry.direction === LedgerDirection.Credit) {
                calculated = calculated.add(entry.money);
            } else {
                calculated = calculated.subtract(entry.money);
            }
        }

        const storedBalance = wallet.balance;
        const difference = storedBalance.subtract(calculated);
        const consistent = storedBalance.equals(calculated);

        return {
            walletId: wallet.id,
            storedBalance: storedBalance.toJSON(),
            calculatedBalance: calculated.toJSON(),
            difference: {
                amount: difference.isNegative() ? difference.negate().toJSON().amount : difference.toJSON().amount,
                currency: wallet.currency
            },
            consistent,
            checkedEntries: entries.length
        };
    }
}
