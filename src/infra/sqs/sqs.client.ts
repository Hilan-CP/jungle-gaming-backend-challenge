import { SQSClient } from "@aws-sdk/client-sqs";
import { Injectable } from "@nestjs/common";
import { createSqsClient } from "../../config/aws.config";

@Injectable()
export class SqsClientProvider {
    private readonly client: SQSClient;

    constructor() {
        this.client = createSqsClient();
    }

    getClient(): SQSClient {
        return this.client;
    }
}
