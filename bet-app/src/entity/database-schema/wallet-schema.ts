import { EntitySchema, Type, type Platform } from "@mikro-orm/core";
import { Money } from "../money";
import { Wallet } from "../wallet";

export class BalanceColumnType extends Type<Money, any> {
    override convertToDatabaseValue(balance: Money, platform?: Platform): any {
        return {
            balance_amount: balance.toJSON().amount,
            balance_currency: balance.toJSON().currency,
        };
    }

    override convertToJSValue(value: any, platform?: Platform, entity?: any): Money {
        return Money.from({
            amount: entity?.balance_amount ?? value?.balance_amount ?? value?.amount ?? value,
            currency: entity?.balance_currency ?? value?.balance_currency ?? value?.currency,
        });
    }
}

export const WalletSchema = new EntitySchema<any>({
    class: Wallet as any,
    tableName: 'wallets',
    properties: {
        id: { type: 'string', primary: true },
        playerId: { fieldName: 'player_id', type: 'string' },
        currency: { type: 'string' },

        balance: {
            name: 'balance',
            type: BalanceColumnType,
            persist: false,
            getter: true,
            serializer: (wallet: Wallet) => wallet.balance.toJSON(),
        },
        balanceAmount: { fieldName: 'balance_amount', type: 'string', persist: true },
        balanceCurrency: { fieldName: 'balance_currency', type: 'string', persist: true },

        version: { type: 'number', version: true },
        createdAt: { fieldName: 'created_at', type: 'datetime' },
        updatedAt: { fieldName: 'updated_at', type: 'datetime' },
    },
});
