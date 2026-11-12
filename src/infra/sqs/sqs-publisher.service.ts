import { SendMessageCommand } from "@aws-sdk/client-sqs";
import { Injectable, Logger } from "@nestjs/common";
import { SqsClientProvider } from "./sqs.client";
import { OutboxMessage } from "../../entity/outbox";
import { getWagerQueueUrl } from "../../config/aws.config";

@Injectable()
export class SqsPublisherService {
    private readonly logger = new Logger(SqsPublisherService.name);
    private readonly queueUrl: string;

    constructor(private readonly sqsClientProvider: SqsClientProvider) {
        this.queueUrl = getWagerQueueUrl();
    }

    async publish(message: OutboxMessage): Promise<void> {
        const body = JSON.stringify({
            id: message.id,
            aggregateId: message.aggregateId,
            eventType: message.eventType,
            payload: message.payload,
            occurredAt: message.occurredAt.toISOString()
        });

        const command = new SendMessageCommand({
            QueueUrl: this.queueUrl,
            MessageBody: body,
            MessageGroupId: message.aggregateId,
            MessageDeduplicationId: message.id
        });

        await this.sqsClientProvider.getClient().send(command);
    }
}
