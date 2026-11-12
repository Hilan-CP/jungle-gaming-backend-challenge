export interface ReceiveInboxProps {
    readonly messageId: string;
    readonly consumerName: string;
    readonly payloadHash: string;
    readonly receivedAt?: Date;
}

export class InboxMessageState {
    public messageId: string;
    public consumerName: string;
    public payloadHash: string;
    public receivedAt: Date;
    public processedAt?: Date;

    public constructor(message: InboxMessage) {
        this.messageId = message.messageId;
        this.consumerName = message.consumerName;
        this.payloadHash = message.payloadHash;
        this.receivedAt = message.receivedAt;
        this.processedAt = message.processedAt;
    }
}

export class InboxMessage {
    private constructor(
        public readonly messageId: string,
        public readonly consumerName: string,
        public readonly payloadHash: string,
        public readonly receivedAt: Date,
        private _processedAt?: Date
    ) {}

    static receive(props: ReceiveInboxProps): InboxMessage {
        return new InboxMessage(
            props.messageId,
            props.consumerName,
            props.payloadHash,
            props.receivedAt ?? new Date(),
            undefined
        );
    }

    static rehydrate(state: InboxMessageState): InboxMessage {
        return new InboxMessage(
            state.messageId,
            state.consumerName,
            state.payloadHash,
            state.receivedAt,
            state.processedAt
        );
    }

    get processedAt(): Date | undefined {
        return this._processedAt;
    }

    isProcessed(): boolean {
        return this._processedAt !== undefined;
    }

    markProcessed(at: Date): void {
        this._processedAt = at;
    }
}
