import { Injectable, Logger, type OnApplicationBootstrap, type OnApplicationShutdown } from "@nestjs/common";
import { MikroORM, RequestContext } from "@mikro-orm/postgresql";
import { OutboxRepository } from "../repository/outbox.repository";
import { SqsPublisherService } from "../infra/sqs/sqs-publisher.service";

@Injectable()
export class OutboxPublisherWorker implements OnApplicationBootstrap, OnApplicationShutdown {
    private readonly logger = new Logger(OutboxPublisherWorker.name);
    private intervalId?: NodeJS.Timeout;
    private isRunning = false;

    constructor(
        private readonly outboxRepository: OutboxRepository,
        private readonly sqsPublisherService: SqsPublisherService,
        private readonly orm: MikroORM
    ) {}

    onApplicationBootstrap(): void {
        const intervalMs = Number(process.env.OUTBOX_POLL_INTERVAL_MS) || 2000;
        this.intervalId = setInterval(() => {
            void this.processDueMessages();
        }, intervalMs);
    }

    onApplicationShutdown(): void {
        if (this.intervalId !== undefined) {
            clearInterval(this.intervalId);
            this.intervalId = undefined;
        }
    }

    async processDueMessages(): Promise<void> {
        if (this.isRunning) {
            return;
        }
        this.isRunning = true;

        try {
            await RequestContext.create(this.orm.em, async () => {
                const now = new Date();
                const dueMessages = await this.outboxRepository.findDueMessages(20, now);

                for (const message of dueMessages) {
                    try {
                        await this.sqsPublisherService.publish(message);
                        message.markPublished(new Date());
                        await this.outboxRepository.save(message);
                    } catch {
                        message.scheduleRetry(new Date());
                        await this.outboxRepository.save(message);
                        this.logger.warn(`Failed to publish outbox message ${message.id}, scheduled retry`);
                    }
                }
            });
        } catch (error) {
            const reason = error instanceof Error ? error.message : String(error);
            this.logger.error(`Error during outbox dispatch cycle: ${reason}`);
        } finally {
            this.isRunning = false;
        }
    }
}
