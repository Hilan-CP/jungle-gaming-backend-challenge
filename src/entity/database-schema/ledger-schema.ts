import { EntitySchema, Type, type Platform } from "@mikro-orm/core";
import { LedgerDirection, WalletLedgerEntry } from "../ledger";
import { Money } from "../money";

export class LedgerMoneyCustomType extends Type<Money, any> {
    override convertToDatabaseValue(money: Money, platform?: Platform): any {
        return money?.toJSON ? money.toJSON().amount : money;
    }

    override convertToJSValue(value: any, platform?: Platform, entity?: any): Money {
        return Money.from({
            amount: value?.amount ?? value,
            currency: entity?.currency ?? value?.currency,
        });
    }
}

export const WalletLedgerEntrySchema = new EntitySchema<any>({
    class: WalletLedgerEntry as any,
    tableName: 'wallet_ledger_entries',
    properties: {
        id: { type: 'string', primary: true },
        walletId: { fieldName: 'wallet_id', type: 'string' },
        transactionId: { fieldName: 'transaction_id', type: 'string' },
        direction: {
            enum: true,
            items: () => LedgerDirection,
            nativeEnumName: 'ledger_direction',
        },

        money: {
            name: 'money',
            type: LedgerMoneyCustomType,
            persist: false,
            getter: true,
            serializer: (entry: WalletLedgerEntry) => entry.money.toJSON(),
        },
        amount: { fieldName: 'amount', type: 'string', persist: true },
        currency: { fieldName: 'currency', type: 'string', persist: true },

        balanceBefore: {
            name: 'balanceBefore',
            type: LedgerMoneyCustomType,
            persist: false,
            getter: true,
            serializer: (entry: WalletLedgerEntry) => entry.balanceBefore.toJSON(),
        },
        balanceBeforeAmount: { fieldName: 'balance_before_amount', type: 'string', persist: true },
        balanceBeforeCurrency: { fieldName: 'balance_before_currency', type: 'string', persist: true },

        balanceAfter: {
            name: 'balanceAfter',
            type: LedgerMoneyCustomType,
            persist: false,
            getter: true,
            serializer: (entry: WalletLedgerEntry) => entry.balanceAfter.toJSON(),
        },
        balanceAfterAmount: { fieldName: 'balance_after_amount', type: 'string', persist: true },
        balanceAfterCurrency: { fieldName: 'balance_after_currency', type: 'string', persist: true },

        createdAt: { fieldName: 'created_at', type: 'datetime' },
    },
    indexes: [
        { properties: ['walletId'] },
        { properties: ['transactionId'] },
    ],
});
