import { randomUUID } from "node:crypto";

export interface IntegrationEvent<T = unknown> {
    readonly id?: string;
    readonly aggregateId: string;
    readonly eventType: string;
    readonly payload: Readonly<Record<string, unknown>> | T;
    readonly occurredAt?: Date;
}

export class OutboxMessageState {
    public id: string;
    public aggregateId: string;
    public eventType: string;
    public payload: Readonly<Record<string, unknown>>;
    public occurredAt: Date;
    public attempts: number;
    public nextAttemptAt?: Date;
    public publishedAt?: Date;

    public constructor(message: OutboxMessage) {
        this.id = message.id;
        this.aggregateId = message.aggregateId;
        this.eventType = message.eventType;
        this.payload = message.payload;
        this.occurredAt = message.occurredAt;
        this.attempts = message.attempts;
        this.nextAttemptAt = message.nextAttemptAt;
        this.publishedAt = message.publishedAt;
    }
}

export class OutboxMessage {
    private constructor(
        public readonly id: string,
        public readonly aggregateId: string,
        public readonly eventType: string,
        public readonly payload: Readonly<Record<string, unknown>>,
        public readonly occurredAt: Date,
        private _attempts: number,
        private _nextAttemptAt?: Date,
        private _publishedAt?: Date
    ) {}

    static enqueue(event: IntegrationEvent<unknown>): OutboxMessage {
        const payloadRecord =
            typeof event.payload === "object" && event.payload !== null
                ? (event.payload as Readonly<Record<string, unknown>>)
                : ({ value: event.payload } as Readonly<Record<string, unknown>>);

        return new OutboxMessage(
            event.id ?? randomUUID(),
            event.aggregateId,
            event.eventType,
            payloadRecord,
            event.occurredAt ?? new Date(),
            0,
            undefined,
            undefined
        );
    }

    static rehydrate(state: OutboxMessageState): OutboxMessage {
        return new OutboxMessage(
            state.id,
            state.aggregateId,
            state.eventType,
            state.payload,
            state.occurredAt,
            state.attempts,
            state.nextAttemptAt,
            state.publishedAt
        );
    }

    get attempts(): number {
        return this._attempts;
    }
    get nextAttemptAt(): Date | undefined {
        return this._nextAttemptAt;
    }
    get publishedAt(): Date | undefined {
        return this._publishedAt;
    }

    isPending(): boolean {
        return this._publishedAt === undefined;
    }

    isDue(now: Date): boolean {
        if (!this.isPending()) {
            return false;
        }
        if (this._nextAttemptAt === undefined) {
            return true;
        }
        return this._nextAttemptAt.getTime() <= now.getTime();
    }

    markPublished(at: Date): void {
        this._publishedAt = at;
    }

    /** incrementa attempts e calcula o próximo nextAttemptAt (backoff) */
    scheduleRetry(now: Date): void {
        this._attempts += 1;
        // Backoff exponencial com teto de 300 segundos (5 minutos)
        const backoffSeconds = Math.min(Math.pow(2, this._attempts - 1), 300);
        this._nextAttemptAt = new Date(now.getTime() + backoffSeconds * 1000);
    }
}
