#!/bin/bash
set -e

# Criação da Fila Principal FIFO
awslocal sqs create-queue \
  --queue-name wager-transactions.fifo \
  --attributes '{
    "FifoQueue": "true",
    "ContentBasedDeduplication": "false",
    "VisibilityTimeout": "30"
  }'

# Criação da Fila de Dead Letter Queue (DLQ) FIFO
awslocal sqs create-queue \
  --queue-name wager-transactions-dlq.fifo \
  --attributes '{
    "FifoQueue": "true"
  }'

# Configuração do Redrive Policy (DLQ)
awslocal sqs set-queue-attributes \
  --queue-url http://localhost:4566/000000000000/wager-transactions.fifo \
  --attributes '{
    "RedrivePolicy": "{\"deadLetterTargetArn\":\"arn:aws:sqs:us-east-1:000000000000:wager-transactions-dlq.fifo\",\"maxReceiveCount\":\"5\"}"
  }'