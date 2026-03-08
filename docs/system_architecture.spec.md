# Pet Image Processor — Technical Architecture Specification

**Document version:** 1.0  
**Audience:** Senior engineers, technical reviewers  
**Scope:** Architecture and design only — no implementation code.

---

## 1. System Overview

### 1.1 Goal

The Pet Image Processor is a small, production-inspired system that lets users upload pet images and receive processed versions asynchronously. The system is designed to evaluate architecture decisions, async design, AWS usage, testing, code organization, and responsible use of AI tooling.

### 1.2 Design Principles

- **Asynchronous processing:** Image processing is decoupled from the upload request. Users receive a job identifier and poll for status and result.
- **Clean pipeline:** Clear separation between API (ingestion + status), queue (decoupling), and worker (processing). No synchronous processing in the API.
- **Simplicity:** Scope is intentionally limited (upload → queue → simulate AI processing → store result → expose status). No auth, multi-tenancy, or complex business rules in this assignment.
- **Production-inspired:** Uses real AWS primitives (S3, SQS), IaC (Terraform), and standard testing (Jest, Supertest) so the solution reflects real-world patterns.

### 1.3 Out of Scope (Assignment)

- User authentication / authorization
- Multi-tenancy or org-level isolation
- Real AI/ML inference (processing is simulated, e.g. grayscale, crop, resize)
- Retries, DLQ, or advanced queue semantics beyond basic SQS usage
- CI/CD pipelines (unless specified elsewhere)

---

## 2. High-Level Architecture

### 2.1 Component Diagram (Conceptual)

```text
┌─────────────┐     ┌─────────────┐     ┌─────┐     ┌─────────────┐     ┌─────────────┐
│   Frontend  │────▶│  Backend    │────▶│ S3  │     │     SQS     │────▶│   Worker    │
│  (Next.js)  │     │  API        │     │     │     │   (queue)   │     │ (Node/Lambda)│
└─────────────┘     └─────────────┘     └──┬──┘     └─────────────┘     └──────┬──────┘
       │                    │                │                                  │
       │                    │                │                                  │
       │                    │                │◀─────────────────────────────────┘
       │                    │                │   (store processed image)
       │                    │                │
       └────────────────────┴────────────────┘
              (poll status / fetch result)
```

### 2.2 Frontend (Next.js + React)

- **Role:** User interface for upload, status display, and viewing the processed image.
- **Responsibilities:**
  - Upload pet image (e.g. file input → POST to backend).
  - Receive and store job ID from upload response.
  - Poll status API (e.g. GET job by ID) until terminal state (e.g. completed / failed).
  - Display processed image URL or embedded image when ready.
- **Constraints:** No direct S3 upload from browser in this design; upload goes through the Backend API so the API can persist metadata and enqueue the job consistently.
- **Tech:** Next.js (App Router or Pages), React. No prescribed state library; local state or simple context is sufficient.

### 2.3 Backend API (Node.js + Express)

- **Role:** HTTP API for ingestion, job creation, and status.
- **Responsibilities:**
  - **Upload:** Accept multipart/form-data (or equivalent), upload file to S3 (original bucket/key), create a job record (or equivalent metadata), send a message to SQS with job identifier and S3 key(s), return job ID to client.
  - **Status:** GET endpoint(s) to return job status (e.g. pending, processing, completed, failed) and, when completed, the S3 key or pre-signed URL for the processed image.
- **Data model (logical):** Jobs have at least: job ID, status, original S3 key, processed S3 key (when done), timestamps. Storage can be in-memory, SQLite, or a small DB — the spec does not mandate a specific store; consistency and clarity matter more.
- **Constraints:** Must not perform image processing. Must not block the upload response until processing is done. All processing is triggered via the queue.

### 2.4 Queue (AWS SQS)

- **Role:** Decouple the API from the worker; ensure at-least-once delivery of work items.
- **Message shape (conceptual):** Job ID, original object key (and optionally bucket name), and any minimal context the worker needs to fetch the object and write the result.
- **Usage:** Backend API publishes one message per job after successful S3 upload. Worker(s) consume messages, process the image, write to S3, and update job status. No requirement for FIFO or deduplication in this assignment; standard queue is sufficient.
- **Visibility timeout:** Should be set so that processing typically completes within the timeout; long-running processing may require extending visibility or using a separate “processing” status to avoid duplicate processing (design choice to be documented).

### 2.5 Worker (Node.js worker or AWS Lambda)

- **Role:** Consume SQS messages, “simulate” AI processing, and store the result in S3.
- **Responsibilities:**
  - Poll SQS (or be invoked by SQS trigger if Lambda).
  - For each message: resolve job ID and original S3 key; download object from S3; apply simulated processing (e.g. grayscale, crop, resize — at least one transformation); upload result to S3 (processed bucket/key); update job status to completed (and store processed key); delete message from queue (or rely on Lambda/success path).
  - On failure: either retry (SQS visibility timeout) or mark job failed and remove message (or send to DLQ if implemented).
- **Processing simulation:** Deterministic, non-AI transformations (e.g. sharpening, resize, crop) are sufficient to demonstrate the pipeline. No external AI API required.
- **Tech choice:** Node.js long-running worker (e.g. polling SQS in a loop) or Lambda triggered by SQS. Trade-offs (cost, scaling, operational simplicity) should be briefly noted in the implementation notes or README.

### 2.6 S3 Storage

- **Role:** Durable storage for original and processed images.
- **Structure (conceptual):**
  - **Original objects:** e.g. `originals/<job-id>/<filename>` or similar. Uploaded by Backend API.
  - **Processed objects:** e.g. `processed/<job-id>/<filename>`. Written by Worker.
- **Access:** Backend API generates pre-signed URLs for the frontend to display the processed image when status is completed, so the frontend never needs direct S3 credentials. CORS and bucket policy should allow API (and worker) access only; no public read required if using pre-signed URLs.

### 2.7 Terraform Infrastructure

- **Role:** Define AWS resources in code for reproducibility and review.
- **Expected resources (minimal):**
  - S3 bucket(s): one or two buckets (or prefixes) for originals and processed.
  - SQS queue: standard queue for job messages.
  - IAM roles and policies: Backend API role (S3 PutObject, SQS SendMessage; and read for pre-signed URL generation); Worker role (S3 GetObject, PutObject, SQS ReceiveMessage, DeleteMessage).
  - If Lambda: Lambda function, SQS event source mapping, and role.
- **State:** Remote state (e.g. S3 + DynamoDB) or local state; should be documented. No need for multiple environments in the spec unless required by the assignment.

---

## 3. System Data Flow

End-to-end flow, step by step:

1. **User selects image (Frontend)**  
   User chooses a pet image file in the browser.

2. **Upload request (Frontend → Backend API)**  
   Frontend sends POST with multipart body (image file) to an upload endpoint (e.g. `POST /api/upload` or `POST /api/jobs`).

3. **Store original (Backend API → S3)**  
   API uploads the file to S3 under the originals path, obtaining the object key.

4. **Create job and enqueue (Backend API)**  
   API creates a job record with status “pending” (or “queued”), then sends an SQS message containing job ID and original S3 key. API returns job ID (and optionally status) to the client.

5. **Response to client (Backend API → Frontend)**  
   Frontend receives job ID and (if applicable) initial status. Upload response is complete; no waiting for processing.

6. **Worker receives message (SQS → Worker)**  
   Worker (polling or Lambda) receives the SQS message and parses job ID and original key.

7. **Update status to “processing” (Worker)**  
   Worker updates the job status to “processing” (optional but recommended for UX).

8. **Download original (Worker → S3)**  
   Worker downloads the original object from S3 using the key from the message.

9. **Simulate processing (Worker)**  
   Worker applies simulated transformations (e.g. grayscale, crop, resize) in memory.

10. **Upload processed image (Worker → S3)**  
    Worker uploads the result to S3 under the processed path, keyed by job ID.

11. **Mark job completed (Worker)**  
    Worker updates the job record: status “completed”, processed S3 key, and any timestamps.

12. **Delete message (Worker → SQS)**  
    Worker deletes the SQS message so it is not redelivered.

13. **Poll status (Frontend → Backend API)**  
    Frontend periodically calls the status endpoint (e.g. `GET /api/jobs/:id`) with the job ID.

14. **Return status and result (Backend API → Frontend)**  
    API returns current status; when “completed”, it includes a pre-signed URL (or path) for the processed image.

15. **Display result (Frontend)**  
    When status is “completed”, frontend displays the processed image using the provided URL.

---

## 4. API Contract (Logical)

The following is a minimal contract sufficient for the assignment. Exact paths and status values are illustrative.

### 4.1 Upload

- **Request:** `POST /api/jobs` (or `/api/upload`)  
  - Body: multipart/form-data with field name for the file (e.g. `image`).
- **Response:** `201 Created`  
  - Body: `{ "jobId": "<uuid-or-opaque-id>", "status": "pending" }`
- **Errors:** `400` (no file, invalid type), `413` (file too large if limited), `500` (S3/SQS failure).

### 4.2 Get job status

- **Request:** `GET /api/jobs/:jobId`
- **Response:** `200 OK`  
  - Body: `{ "jobId": "...", "status": "pending" | "processing" | "completed" | "failed", "processedImageUrl": "<optional-presigned-url>" }`  
  - `processedImageUrl` present only when `status === "completed"`.
- **Errors:** `404` (unknown job), `500` (server error).

Pre-signed URLs should have a short TTL (e.g. 60–300 seconds); frontend uses the URL immediately for display.

---

## 5. Testing Strategy

- **Backend API (Jest + Supertest):**
  - Upload: mock S3 and SQS; assert correct S3 key, correct SQS message payload, and response contains job ID and pending status.
  - Status: with a stored job (mocked or in-memory), assert response shape and that `processedImageUrl` appears only when status is completed.
  - Error cases: invalid input, missing job ID, and (if applicable) S3/SQS failures returning appropriate status codes.
- **Worker (Jest):**
  - Unit tests: given an SQS message body, assert correct S3 key resolution, that processing (e.g. resize) is applied, and that the correct processed key is written. S3 and job store should be mocked.
  - Integration-style (optional): local SQS + localstack S3 or mocks to validate full message-to-S3 flow without real AWS.
- **Frontend (optional for spec):**
  - Component tests: upload form submits with file; status polling shows loading then image when completed. API calls can be mocked.
- **Infrastructure:**
  - Terraform: `terraform validate` and `terraform plan`; optionally `terraform apply` in a disposable account or sandbox to verify resources.

No end-to-end test is mandated in the spec; if implemented, it should use test buckets and queue and avoid production resources.

---

## 6. Code Organization

Recommended layout (conceptual; no code):

- **Monorepo or separate repos:** Either is acceptable; document the choice.
- **Backend:**  
  - Routes/handlers for upload and job status.  
  - Services or modules for: S3 (upload original, generate pre-signed URL), SQS (send message), job store (create, get, update by ID).  
  - Config for bucket names, queue URL, and region from env.
- **Worker:**  
  - Entrypoint: SQS poll (or Lambda handler).  
  - Steps: parse message → get object → process image → put object → update job → delete message.  
  - Shared constants for S3 keys/prefixes and status values to stay aligned with API.
- **Frontend:**  
  - Page(s) for upload and for “job status / result” (could be one page with state).  
  - API client helpers for `POST /api/jobs` and `GET /api/jobs/:id`.  
  - Polling with backoff or fixed interval; stop when terminal status.
- **Infrastructure:**  
  - Terraform in a dedicated directory (e.g. `infra/` or `terraform/`); modules optional; variables for region, prefix, etc.

Shared types (e.g. job status enum, message schema) can live in a shared package or be duplicated with a single source of truth documented.

---

## 7. Security and Operational Notes

- **Secrets and config:** No AWS keys in code; use IAM roles (e.g. EC2 instance role, Lambda execution role) where possible. Env vars for queue URL, bucket names, region.
- **Input validation:** Backend should validate file type (e.g. image/*) and size to avoid abuse and accidental large uploads.
- **Pre-signed URLs:** Prefer short expiry for processed image URLs to limit exposure.
- **Idempotency:** Same job ID should not be enqueued twice from a single upload; job creation and enqueue should be atomic in the API.
- **Failure handling:** Worker should set job status to “failed” on error and then delete (or eventually DLQ) the message so the queue does not block. Visibility timeout and retry count should be tuned to avoid duplicate processing where possible.

---

## 8. Summary

The system implements a clean async pipeline: **Frontend → Backend API → S3 + SQS → Worker → S3 + status update → Status API → Frontend polling.** Components are clearly separated, processing is fully asynchronous, and the tech stack (Next.js, Express, SQS, S3, Terraform, Jest/Supertest) supports a production-inspired take-home assignment focused on architecture, async design, AWS, testing, and code organization.
