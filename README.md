# Pet Image Processor

An **asynchronous pet image processing system**: users upload a photo through a web app, the backend stores it in S3 and enqueues a job, a worker processes the image (resize, grayscale), and the frontend polls until the processed image is available.

---

## Table of Contents

- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Local Development](#local-development)
- [Environment Variables](#environment-variables)
- [API Endpoints](#api-endpoints)
- [Testing](#testing)
- [Infrastructure](#infrastructure)
- [Design Decisions](#design-decisions)
- [Tradeoffs](#tradeoffs)
- [Future Improvements](#future-improvements)

---

## Architecture

The system is built around a **queue-based pipeline**: the frontend talks only to the backend; the backend uploads to S3 and sends messages to SQS; a separate worker consumes the queue, processes images, and writes results back to S3 and job status via the API.

```
                    ┌─────────────┐
                    │   Frontend  │
                    │  (Next.js)  │
                    └──────┬──────┘
                           │ HTTP (upload, poll status/result)
                           ▼
                    ┌─────────────┐     PUT object      ┌─────────┐
                    │  Backend API │ ──────────────────►│   S3    │
                    │  (Express)   │◄────────────────────│ (store) │
                    └──────┬──────┘   pre-signed / URL   └────┬────┘
                           │                                  │
                           │ SendMessage                     │ Get/Put
                           ▼                                  │
                    ┌─────────────┐                    ┌──────┴──────┐
                    │     SQS     │ ◄──────────────────│   Worker    │
                    │   (queue)   │   ReceiveMessage   │  (Node.js   │
                    └─────────────┘   DeleteMessage    │   + Sharp)  │
                                                       └─────────────┘
                                                             │
                                                             │ POST /internal/job-update
                                                             ▼
                    ┌─────────────┐
                    │  Backend API│  (update job status & processed key)
                    └─────────────┘
```

**Flow:**

1. User selects an image and clicks **Upload** in the frontend.
2. Frontend sends the file to **POST /upload** (multipart, field `image`).
3. Backend validates the file, uploads it to **S3** under `original-images/{jobId}.jpg`, creates a job (status `queued`), and publishes `{ jobId, imageKey }` to **SQS**.
4. Backend responds with **201** and `{ jobId, status: "queued" }`.
5. Frontend starts **polling GET /status/:jobId** every 2 seconds.
6. **Worker** (long-running process or Lambda) polls SQS, receives a message, downloads the image from S3, processes it with **Sharp** (resize, grayscale), uploads to S3 under `processed-images/{jobId}.jpg`, and updates the job via **POST /internal/job-update** (status `completed`, `processedImageKey`).
7. When status is `completed`, frontend calls **GET /result/:jobId**, gets the processed image URL, and displays it.

---

## Tech Stack

| Layer          | Technologies |
|----------------|--------------|
| **Frontend**   | Next.js, React, TypeScript, Tailwind CSS |
| **Backend**    | Node.js, Express, TypeScript |
| **Worker**     | Node.js, Sharp (image processing) |
| **Storage**    | AWS S3 (originals + processed) |
| **Queue**      | AWS SQS |
| **Infrastructure** | Terraform (AWS provider) |

---

## Project Structure

```
pet-image-processor/
├── frontend/          # Next.js app – upload UI, preview, status, result
│   ├── src/
│   │   ├── app/       # App Router (page, layout)
│   │   ├── components/
│   │   └── services/  # API client
│   └── package.json
├── backend/           # Express API – upload, status, result, job store
│   ├── src/
│   │   ├── controllers/
│   │   ├── routes/
│   │   ├── services/  # job, storage, queue
│   │   └── middleware/
│   ├── config/
│   ├── tests/         # Jest + Supertest
│   └── package.json
├── worker/            # SQS consumer – download, Sharp, upload, update job
│   ├── src/
│   │   ├── services/   # S3, SQS, job API client
│   │   └── worker.ts  # poll loop
│   ├── config/
│   └── package.json
├── infra/             # Terraform – S3, SQS, IAM, Lambda (optional)
│   ├── main.tf
│   ├── s3.tf
│   ├── sqs.tf
│   ├── iam.tf
│   ├── lambda.tf
│   └── variables.tf
├── docs/              # Specs and design docs
│   ├── system_architecture.spec.md
│   ├── backend_processing_pipeline.spec.md
│   ├── frontend_upload_flow.spec.md
│   └── ...
└── README.md
```

---

## Local Development

**Prerequisites:** Node.js 18+, npm, AWS account (or LocalStack), Terraform (optional, for infra).

### 1. Install dependencies

```bash
cd backend  && npm install && cd ..
cd worker   && npm install && cd ..
cd frontend && npm install && cd ..
```

### 2. Configure environment variables

- **Backend:** Copy `backend/.env.example` to `backend/.env`. Set AWS credentials, `S3_BUCKET_NAME`, and **`SQS_QUEUE_URL`** to a real SQS queue URL (create one in the AWS Console or via Terraform).
- **Worker:** Copy `worker/.env.example` to `worker/.env`. Use the same AWS and S3/SQS values as the backend; set **`BACKEND_BASE_URL=http://localhost:4000`**.
- **Frontend:** Copy `frontend/.env.example` to `frontend/.env.local` (optional). Set **`NEXT_PUBLIC_API_URL=http://localhost:4000`** if the API runs on a different host/port.

### 3. Run the backend

```bash
cd backend
npm run dev
```

Server listens on **http://localhost:4000** (or the port in `PORT`). Health: **GET http://localhost:4000/health**.

### 4. Run the worker

In a second terminal:

```bash
cd worker
npm run dev
```

The worker polls SQS, processes messages, and calls the backend to update job status and `processedImageKey`.

### 5. Run the frontend

In a third terminal:

```bash
cd frontend
npm run dev
```

Open **http://localhost:3000**, select an image, upload, and watch status until the processed image appears.

---

## Environment Variables

### Backend (`backend/.env`)

| Variable | Description | Example |
|---------|-------------|---------|
| `PORT` | HTTP server port | `4000` |
| `NODE_ENV` | Environment | `development` |
| `AWS_REGION` | AWS region | `us-east-1` |
| `AWS_ACCESS_KEY_ID` | AWS access key | (your key) |
| `AWS_SECRET_ACCESS_KEY` | AWS secret key | (your secret) |
| `S3_BUCKET_NAME` | S3 bucket name | `pet-image-processor` |
| `S3_ORIGINAL_PREFIX` | Prefix for uploads | `original-images` |
| `S3_PROCESSED_PREFIX` | Prefix for processed | `processed-images` |
| `SQS_QUEUE_URL` | SQS queue URL | `https://sqs.us-east-1.amazonaws.com/…/queue-name` |
| `MAX_FILE_SIZE_MB` | Max upload size (MB) | `5` |
| `WORKER_POLL_INTERVAL_MS` | (unused by backend) | `2000` |
| `JOB_STATUS_TTL_MINUTES` | (optional) | `60` |

### Worker (`worker/.env`)

| Variable | Description | Example |
|---------|-------------|---------|
| `AWS_REGION` | Same as backend | `us-east-1` |
| `AWS_ACCESS_KEY_ID` | Same as backend | (your key) |
| `AWS_SECRET_ACCESS_KEY` | Same as backend | (your secret) |
| `S3_BUCKET_NAME` | Same bucket | `pet-image-processor` |
| `S3_ORIGINAL_PREFIX` | Same as backend | `original-images` |
| `S3_PROCESSED_PREFIX` | Same as backend | `processed-images` |
| `SQS_QUEUE_URL` | Same queue as backend | `https://sqs.…` |
| `WORKER_POLL_INTERVAL_MS` | SQS poll interval (ms) | `2000` |
| `BACKEND_BASE_URL` | Backend API base URL | `http://localhost:4000` |

### Frontend (`frontend/.env.local`)

| Variable | Description | Example |
|---------|-------------|---------|
| `NEXT_PUBLIC_API_URL` | Backend API base URL | `http://localhost:4000` |

---

## API Endpoints

Base URL: `http://localhost:4000` (or `/api` prefix, e.g. `http://localhost:4000/api`).

### POST /upload

Upload an image and create a processing job.

- **Request:** `multipart/form-data`, field **`image`** (JPEG, PNG, or WebP; max 5 MB).
- **Success (201):** `{ "jobId": "<uuid>", "status": "queued" }`.
- **Errors:** 400 (missing/invalid file), 413 (too large), 500 (S3/SQS error).

### GET /status/:jobId

Get the current job status.

- **Success (200):** `{ "jobId": "<id>", "status": "queued" | "processing" | "completed" | "failed" }`.
- **Error (404):** `{ "error": "Job not found", "jobId": "<id>" }`.

### GET /result/:jobId

Get the processed image URL when the job is completed.

- **Success (200), completed:** `{ "jobId": "<id>", "status": "completed", "processedImageUrl": "https://…" }`.
- **Success (200), not completed:** `{ "jobId": "<id>", "status": "queued" | "processing" | "failed" }` (no `processedImageUrl`).
- **Error (404):** Job not found.

---

## Testing

### Backend

From the repo root:

```bash
cd backend
npm test
```

Runs **Jest** with:

- **Unit:** `tests/job.service.test.ts` (job create, get, update, setProcessedImage).
- **API:** `tests/upload.test.ts` (POST /upload with mocked S3/SQS), `tests/status.test.ts` (GET /status/:jobId), `tests/integration.upload.test.ts` (upload then status).

S3 and SQS are mocked; no real AWS calls. No production code changes required to run tests.

---

## Infrastructure

The **`infra/`** directory contains **Terraform** configuration for AWS:

- **provider.tf** – AWS and archive providers, region from variable.
- **variables.tf** – `aws_region`, `s3_bucket_name`, `queue_name`, Lambda name, S3 prefixes.
- **s3.tf** – One S3 bucket, versioning enabled; public read only for `processed-images/*`.
- **sqs.tf** – One SQS queue (`visibility_timeout_seconds = 60`, `message_retention_seconds = 86400`).
- **iam.tf** – IAM role for the worker (Lambda or EC2): S3 GetObject/PutObject, SQS Receive/Delete/Send, CloudWatch Logs.
- **lambda.tf** – Optional Lambda function (worker package zipped from `../worker`), triggered by SQS; Node 18, 30 s timeout, 512 MB.

**Usage:**

```bash
cd infra
cp terraform.tfvars.example terraform.tfvars   # edit if needed
terraform init
terraform plan
terraform apply   # when you want to create/update resources
```

Outputs: `s3_bucket_name`, `sqs_queue_url`, `lambda_function_name`. Use these in backend and worker `.env`. No automatic deploy; apply is manual.

---

## Design Decisions

- **Asynchronous processing** – Image processing (resize, grayscale) can take a few seconds. Doing it synchronously would block the upload request and hurt UX. By returning immediately with a `jobId` and processing in the background, the API stays fast and can scale workers independently.

- **SQS** – A managed queue decouples the backend from the worker, provides at-least-once delivery and retries, and allows multiple workers. Alternatives (e.g. polling a DB) would require more custom logic for visibility and scaling.

- **S3 for storage** – Images are binary and can be large; S3 is built for that. Prefixes (`original-images/`, `processed-images/`) keep a clear layout. Processed images can be served via public URLs or pre-signed URLs without going through the API.

- **Polling instead of WebSockets** – Polling GET /status every 2 seconds is simple to implement, works with the existing REST API, and avoids WebSocket/SSE infrastructure. For a take-home or MVP, the extra latency is acceptable; WebSockets or SSE can be added later for real-time updates.

---

## Tradeoffs

- **In-memory job store** – Jobs are kept in a process-local Map. Restarting the backend loses job state; multiple backend instances don’t share state. Acceptable for a single-node dev/demo; production would use a DB or Redis.

- **No dead-letter queue (DLQ)** – Failed SQS messages are retried by SQS; there’s no DLQ or alerting. Production would add a DLQ and monitoring.

- **Public read on processed images** – The Terraform bucket policy allows public GetObject on `processed-images/*`. Simple for demos; production might use pre-signed URLs or a CDN with access control.

- **Worker as long-running process** – The repo runs the worker as a Node process that polls SQS. The Terraform Lambda is an alternative; adapting the worker to a Lambda handler (e.g. for SQS events) would be a separate step.

---

## Future Improvements

- **WebSockets or Server-Sent Events** – Push status updates to the frontend when the job completes instead of polling.
- **Cloud deployment** – Run backend and frontend on ECS, App Runner, or similar; worker as Lambda or ECS task.
- **More image transformations** – Options for format, size, filters, or thumbnails, driven by query params or job options.
- **Authentication** – Protect upload and status/result endpoints (e.g. JWT, API keys, or OAuth).
- **Rate limiting** – Throttle uploads per user or IP to avoid abuse.
- **Persistence** – Store jobs in PostgreSQL or DynamoDB for durability and multi-instance support.
- **Observability** – Structured logging, correlation IDs, and metrics (e.g. jobs created/completed/failed, queue depth).

---

For detailed specs, see the **`docs/`** directory.
