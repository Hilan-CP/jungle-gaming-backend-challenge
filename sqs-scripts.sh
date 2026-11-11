# Criação da Fila Principal FIFO
aws --endpoint-url=http://localhost:4566 sqs create-queue \
  --queue-name wager-transactions.fifo \
  --attributes '{
    "FifoQueue": "true",
    "ContentBasedDeduplication": "false",
    "VisibilityTimeout": "30"
  }'

# Criação da Fila de Dead Letter Queue (DLQ) FIFO
aws --endpoint-url=http://localhost:4566 sqs create-queue \
  --queue-name wager-transactions-dlq.fifo \
  --attributes '{
    "FifoQueue": "true"
  }'

# Configuração do Redrive Policy (DLQ)
aws --endpoint-url=http://localhost:4566 sqs set-queue-attributes \
  --queue-url http://localhost:4566/000000000000/wager-transactions.fifo \
  --attributes '{
    "RedrivePolicy": "{\"deadLetterTargetArn\":\"arn:aws:sqs:us-east-1:000000000000:wager-transactions-dlq.fifo\",\"maxReceiveCount\":\"5\"}"
  }'