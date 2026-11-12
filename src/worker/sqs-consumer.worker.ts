import { DeleteMessageCommand, ReceiveMessageCommand, type Message } from "@aws-sdk/client-sqs";
import { Injectable, Logger, type OnApplicationBootstrap, type OnApplicationShutdown } from "@nestjs/common";
import { MikroORM, RequestContext } from "@mikro-orm/postgresql";
import { SqsClientProvider } from "../infra/sqs/sqs.client";
import { InboxRepository } from "../repository/inbox.repository";
import { InboxMessage, InboxMessageState } from "../entity/inbox";
import { computeRawPayloadHash } from "../util/payload-hash.util";
import { getWagerQueueUrl } from "../config/aws.config";

@Injectable()
export class SqsConsumerWorker implements OnApplicationBootstrap, OnApplicationShutdown {
    private readonly logger = new Logger(SqsConsumerWorker.name);
    private readonly queueUrl: string;
    private isPolling = false;
    private shouldStop = false;
    private pollTimeout?: NodeJS.Timeout;

    constructor(
        private readonly sqsClientProvider: SqsClientProvider,
        private readonly inboxRepository: InboxRepository,
        private readonly orm: MikroORM
    ) {
        this.queueUrl = getWagerQueueUrl();
    }

    onApplicationBootstrap(): void {
        this.shouldStop = false;
        this.startPolling();
    }

    onApplicationShutdown(): void {
        this.shouldStop = true;
        if (this.pollTimeout !== undefined) {
            clearTimeout(this.pollTimeout);
            this.pollTimeout = undefined;
        }
    }

    private startPolling(): void {
        if (this.shouldStop || this.isPolling) {
            return;
        }
        this.isPolling = true;

        void this.pollMessages().finally(() => {
            this.isPolling = false;
            if (!this.shouldStop) {
                const intervalMs = Number(process.env.SQS_CONSUMER_POLL_INTERVAL_MS) || 2000;
                this.pollTimeout = setTimeout(() => this.startPolling(), intervalMs);
            }
        });
    }

    private async pollMessages(): Promise<void> {
        try {
            await RequestContext.create(this.orm.em, async () => {
                const command = new ReceiveMessageCommand({
                    QueueUrl: this.queueUrl,
                    MaxNumberOfMessages: 10,
                    WaitTimeSeconds: 5
                });

                const response = await this.sqsClientProvider.getClient().send(command);
                const messages = response.Messages ?? [];

                for (const message of messages) {
                    await this.handleMessage(message);
                }
            });
        } catch {
            // Fila SQS pode estar inacessível ou vazia no ambiente local
            this.logger.warn("SQS consumer polling cycle warning or queue not reachable");
        }
    }

    async handleMessage(message: Message): Promise<void> {
        const messageId = message.MessageId;
        const receiptHandle = message.ReceiptHandle;
        const body = message.Body;

        if (messageId === undefined || receiptHandle === undefined || body === undefined) {
            return;
        }

        const consumerName = "wagering-inbox-consumer";
        let parsedBody: Record<string, unknown> = {};
        try {
            parsedBody = JSON.parse(body) as Record<string, unknown>;
        } catch {
            parsedBody = { raw: body };
        }

        const payloadHash = computeRawPayloadHash(parsedBody);
        const existingInbox = await this.inboxRepository.findByMessageIdAndConsumer(messageId, consumerName);

        if (existingInbox && existingInbox.isProcessed()) {
            await this.deleteMessage(receiptHandle);
            return;
        }

        let inboxMessage = existingInbox;
        if (!inboxMessage) {
            inboxMessage = InboxMessage.receive({
                messageId,
                consumerName,
                payloadHash,
                receivedAt: new Date()
            });
            await this.inboxRepository.save(new InboxMessageState(inboxMessage));
            await this.orm.em.flush();
        }

        try {
            inboxMessage.markProcessed(new Date());
            await this.inboxRepository.update(new InboxMessageState(inboxMessage));
            await this.orm.em.flush();
            await this.deleteMessage(receiptHandle);
        } catch {
            this.logger.error(`Error processing message ${messageId} in consumer`);
        }
    }

    private async deleteMessage(receiptHandle: string): Promise<void> {
        try {
            const deleteCommand = new DeleteMessageCommand({
                QueueUrl: this.queueUrl,
                ReceiptHandle: receiptHandle
            });
            await this.sqsClientProvider.getClient().send(deleteCommand);
        } catch {
            this.logger.warn("Failed to delete message from SQS");
        }
    }
}
