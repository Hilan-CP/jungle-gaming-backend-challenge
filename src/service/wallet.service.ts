import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { Wallet } from "../entity/wallet";
import { LedgerDirection, WalletLedgerEntry } from "../entity/ledger";
import { Money } from "../entity/money";
import { WagerTransaction, WagerTransactionKind } from "../entity/wager-transaction";
import { CreateWalletRequest, ReconciliationResponse, WalletResponse } from "../dto/wallet.dto";
import { WalletRepository } from "../repository/wallet.repository";
import { WalletLedgerRepository } from "../repository/wallet-ledger.repository";
import { WagerTransactionRepository } from "../repository/wager-transaction.repository";

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
        private readonly wagerTransactionRepository: WagerTransactionRepository
    ) {}

    async createWallet(request: CreateWalletRequest): Promise<WalletResponse> {
        if (!request?.playerId || typeof request.playerId !== "string") {
            throw new BadRequestException("Field 'playerId' is required and must be a string");
        }
        if (!request?.initialBalance || typeof request.initialBalance !== "object") {
            throw new BadRequestException("Field 'initialBalance' is required and must be an object");
        }
        if (!request.initialBalance.amount || !request.initialBalance.currency) {
            throw new BadRequestException("Fields 'initialBalance.amount' and 'initialBalance.currency' are required");
        }

        let initialMoney: Money;
        try {
            initialMoney = Money.from(request.initialBalance);
        } catch (err: any) {
            throw new BadRequestException(err?.message ?? "Invalid money amount or currency");
        }

        const walletId = randomUUID();
        const wallet = Wallet.open({
            id: walletId,
            playerId: request.playerId,
            initialBalance: initialMoney
        });

        if (initialMoney.isPositive()) {
            const openingTxId = randomUUID();
            const openingTx = WagerTransaction.create({
                id: openingTxId,
                providerId: "system",
                externalTransactionId: `opening-${wallet.id}`,
                idempotencyKey: `system:opening-${wallet.id}`,
                payloadHash: "opening",
                walletId: wallet.id,
                playerId: wallet.playerId,
                roundId: "opening",
                gameId: "opening",
                kind: WagerTransactionKind.Opening,
                money: initialMoney
            });
            openingTx.markProcessed(undefined, wallet.createdAt);
            await this.wagerTransactionRepository.save(openingTx);

            const openingEntry = WalletLedgerEntry.create({
                id: randomUUID(),
                walletId: wallet.id,
                transactionId: openingTxId,
                direction: LedgerDirection.Credit,
                money: initialMoney,
                balanceBefore: Money.zero(initialMoney.currency),
                balanceAfter: initialMoney
            });
            await this.ledgerRepository.save(openingEntry);
        }

        await this.walletRepository.save(wallet);
        return serializeWallet(wallet);
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
