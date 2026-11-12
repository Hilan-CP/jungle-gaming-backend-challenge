import { SQSClient, type SQSClientConfig } from "@aws-sdk/client-sqs";

export interface AwsConfig {
    readonly accessKeyId: string;
    readonly defaultRegion: string;
    readonly endpointUrl: string;
    readonly secretAccessKey: string;
}

export function getAwsConfig(): AwsConfig {
    return {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || "test",
        defaultRegion: process.env.AWS_DEFAULT_REGION || "us-east-1",
        endpointUrl: process.env.AWS_ENDPOINT_URL || "http://localhost:4566",
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "test"
    };
}

export function createSqsClient(overrides?: Partial<SQSClientConfig>): SQSClient {
    const config = getAwsConfig();

    return new SQSClient({
        region: config.defaultRegion,
        endpoint: config.endpointUrl,
        credentials: {
            accessKeyId: config.accessKeyId,
            secretAccessKey: config.secretAccessKey
        },
        ...overrides
    });
}

export function getWagerQueueUrl(queueName = "wager-transactions.fifo"): string {
    if (process.env.SQS_QUEUE_URL) {
        return process.env.SQS_QUEUE_URL;
    }
    const config = getAwsConfig();
    return `${config.endpointUrl}/000000000000/${queueName}`;
}
