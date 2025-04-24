# WhatsApp Bot v2 🚀

This is the second major iteration of the WhatsApp Bot project, built to send WhatsApp messages via the Web API using **[Baileys](https://github.com/WhiskeySockets/Baileys)** as a dependency. Unlike the previous version, this is no longer a fork of Baileys—it stands as an independent, refactored, and enhanced project.

The bot is deployed as a scheduled AWS Lambda function and uses DynamoDB to securely store WhatsApp session credentials, avoiding repeated logins. The infrastructure is managed via the [Serverless Framework](https://www.serverless.com), allowing seamless deployment and scaling in the cloud.

## What's New in v2 🔧

- **No longer a fork of Baileys**: Now used as a dependency for better maintainability and flexibility.
- **Major code refactor**: Cleaner, modular structure with improved readability and maintainability.
- **Socket connection improvements**: Enhanced handling and configuration of the WhatsApp WebSocket for more stable connections.
- **Race condition fix**: Solved an issue where messages remained in a *pending* state due to the connection closing prematurely. Messages are now reliably sent before termination.
- **Updated dependencies**: All libraries are up-to-date to benefit from performance improvements and security fixes.

## What It Does

This bot queries a finance API for the USD to COP conversion rate and sends that value as a message to a specified WhatsApp group or contact. Originally a Rust project ([check it out here](https://github.com/SergioRt1/whatsapp-bot-rs)), this JavaScript/TypeScript version is optimized for the cloud, designed to run efficiently even on the free-tier AWS Lambda (128MB), and completely avoids the need for Selenium or headless browsers.

## Why Baileys?

Baileys enables direct interaction with WhatsApp Web via WebSocket—no Selenium, no Chromium. This approach significantly reduces memory usage and system complexity.

📚 **Read the Baileys docs [here](https://baileys.wiki/docs/intro/)**  
💬 **Join the community on [Discord](https://discord.gg/WeJM5FP9GG)**

## Getting Started

### Prerequisites

- Node.js 19+
- AWS CLI configured (`aws configure`)
- Serverless Framework (`npm install -g serverless`)
- Yarn

### Setup

1. Clone the project and install dependencies:
   ```bash
   yarn
   ```

2. Create a `.env` file in the project root:
   ```env
   EXTERNAL_STORAGE_ENABLED=true
   GROUP_NAME=your-group-name
   DYNAMODB_TABLE=whats-app-bot-table
   CREDS_ID=creds-v2
   ```

3. Run locally:
   ```bash
   sls invoke local --function cronHandler
   ```

4. Deploy to AWS:
   ```bash
   sls deploy --verbose
   ```

### Heads Up

If you run into an error like:

```
Cannot read file node_modules\dayjs\esm\locale\sk.js due to: EMFILE: too many open files
```

You can patch it by adding:
```js
require('../../graceful-fs/graceful-fs').gracefulify(require('fs'));
```
right after `'use strict';` in `node_modules/serverless/bin/serverless.js`.

## ⚠️ Disclaimer

This project is not affiliated with or endorsed by WhatsApp. It is a personal, educational tool. **Please do not use it to spam users.**
