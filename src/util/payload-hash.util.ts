import { createHash } from "node:crypto";
import canonicalize from "canonicalize";

/**
 * Serializa qualquer valor em uma string JSON canônica conforme RFC 8785 (JSON Canonicalization Scheme - JCS)
 * utilizando a biblioteca padrão canonicalize.
 */
export function canonicalJsonStringify(value: unknown): string {
    return canonicalize(value) ?? "";
}

export interface WagerPayloadInput {
    providerId: string;
    externalTransactionId: string;
    playerId: string;
    walletId: string;
    roundId: string;
    gameId: string;
    kind: string;
    money?: { amount: string; currency: string } | null;
    amount?: string;
    currency?: string;
    referenceExternalTransactionId?: string | null;
}

/**
 * Normaliza o payload extraindo exclusivamente os campos de negócio,
 * sem headers HTTP, chaves de idempotência ou quaisquer metadados de transporte.
 */
export function toCanonicalPayload(input: WagerPayloadInput): Record<string, unknown> {
    const amount = input.money ? input.money.amount : input.amount;
    const currency = input.money ? input.money.currency : input.currency;
    const kind = input.kind.toUpperCase();

    return {
        amount,
        currency,
        externalTransactionId: input.externalTransactionId,
        gameId: input.gameId,
        kind,
        playerId: input.playerId,
        providerId: input.providerId,
        referenceExternalTransactionId: input.referenceExternalTransactionId ?? null,
        roundId: input.roundId,
        walletId: input.walletId
    };
}

/**
 * Calcula o hash SHA-256 do JSON canônico de uma transação.
 * Garante determinismo e ausência de headers ou metadados de transporte.
 */
export function computePayloadHash(payload: WagerPayloadInput): string {
    const canonicalPayload = toCanonicalPayload(payload);
    const canonicalJson = canonicalJsonStringify(canonicalPayload);
    return createHash("sha256").update(canonicalJson).digest("hex");
}

export function computeRawPayloadHash(value: unknown): string {
    const canonicalJson = canonicalJsonStringify(value);
    return createHash("sha256").update(canonicalJson).digest("hex");
}
