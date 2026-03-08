# Pet Image Processor — Backend Processing Pipeline Specification

**Document version:** 1.0  
**Audience:** Senior engineers, backend implementers  
**Scope:** Backend architecture, API contract, job model, storage, queue, worker, and testing. No implementation code.

---

## 1. Backend Architecture

### 1.1 Directory Structure

The backend is organized into logical layers under a single entrypoint:

- **backend/**
  - **src/**
    - **controllers/** — HTTP request/response handling
    - **routes/** — Route definitions and mounting
    - **services/** — Business logic orchestration
    - **queue/** — SQS send/receive abstraction
    - **storage/** — S3 read/write and URL generation
    - **jobs/** — Job CRUD and status management
    - **utils/** — Shared helpers (validation, errors, etc.)
  - **server.ts** — Express app bootstrap and listen

### 1.2 Layer Responsibilities

<!-- markdownlint-disable MD060 -->
| Layer        | Responsibility                                                                                                                                 |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| **controllers/** | Parse request (body, params, file), call services, format response (status, JSON). No business logic; thin layer.                             |
| **routes/**      | Map HTTP method and path to controller handlers; apply middleware (e.g. multipart for upload). Single place for API surface.                    |
| **services/**    | Orchestrate upload flow: validate → generate jobId → call storage (upload original) → call jobs (create record) → call queue (send message). Also orchestrate status/result responses using jobs and storage. |
| **queue/**       | Encapsulate AWS SQS: send message (jobId, imageKey), and optionally receive/delete for local worker. Abstracts queue URL and SDK usage.       |
| **storage/**     | Encapsulate AWS S3: upload buffer/stream to a given key, generate pre-signed GET URL for a key. Abstracts bucket names and key layout.         |
| **jobs/**        | Job persistence: create job with initial status, get by jobId, update status and processed key. Single source of truth for job state.         |
| **utils/**       | Reusable helpers: file type validation, error constructors, constants (status enum, limits). No AWS or HTTP specifics.                        |
| **server.ts**    | Create Express app, mount routes, configure port and any global middleware (e.g. JSON body parser). Start listening.                            |

<!-- markdownlint-enable MD060 -->
### 1.3 Data Flow Between Layers

- **Upload:** Route → Controller → Service (which uses storage, jobs, queue in sequence) → Controller returns response.
- **Status / Result:** Route → Controller → Service (which uses jobs, and storage for URL when completed) → Controller returns response.
- **Worker:** Standalone process or Lambda; uses queue (receive), storage (get object, put object), jobs (update status). Does not go through Express.

---

## 2. API Endpoints

### 2.1 POST /upload

**Purpose:** Upload an image and create a processing job. Processing is asynchronous; the response does not wait for processing to complete.

**Flow:**

1. Validate file upload (presence, type, size).
2. Generate `jobId` (UUID).
3. Upload original image to S3 under the originals path/key for this jobId.
4. Create job record with status `queued`, storing `originalImageKey`.
5. Send message to SQS with `jobId` and `imageKey` (or original S3 key).
6. Return `jobId` and status `queued`.

**Response (success):**

- Status: `201 Created`
- Body:
  - `jobId`: string (UUID)
  - `status`: `"queued"`

**Error responses:** `400` for validation failure, `413` for file too large (if limit enforced), `500` for S3 or queue failure after describing behavior.

---

### 2.2 GET /status/:jobId

**Purpose:** Return the current processing status of a job for polling.

**Possible statuses:**

- `queued` — Job created, message sent to queue; worker has not yet started.
- `processing` — Worker has taken the message and is processing the image.
- `completed` — Processing finished; processed image is in S3 and job has `processedImageKey`.
- `failed` — Processing or upload failed; job may include error information.

**Response (success):**

- Status: `200 OK`
- Body:
  - `jobId`: string
  - `status`: `"queued" | "processing" | "completed" | "failed"`

**Error responses:** `404` when `jobId` is unknown or invalid format.

---

### 2.3 GET /result/:jobId

**Purpose:** Return the processed image URL when the job is completed. Used by the frontend to display the result.

**Response (success, job completed):**

- Status: `200 OK`
- Body:
  - `jobId`: string
  - `status`: `"completed"`
  - `processedImageUrl`: string (pre-signed S3 URL or equivalent)

**Response when not yet completed:**

- Status: `200 OK` with current status (e.g. `queued` or `processing`) and no `processedImageUrl`, or `404`/`409` depending on desired contract. Recommended: return `200` with current status and omit `processedImageUrl` until `completed`.

**Error responses:** `404` when job does not exist.

---

## 3. Job Model

### 3.1 Structure

A **Job** represents one image processing request and its outcome. Conceptual fields:

<!-- markdownlint-disable MD060 -->
| Field                 | Type            | Description                                                                 |
| --------------------- | --------------- | --------------------------------------------------------------------------- |
| `jobId`               | string (UUID)   | Unique identifier; generated at upload.                                    |
| `status`              | enum            | One of: `queued`, `processing`, `completed`, `failed`.                      |
| `originalImageKey`    | string          | S3 key of the original image (set at creation).                             |
| `processedImageKey`   | string \| null  | S3 key of the processed image; set by worker when done.                     |
| `createdAt`           | timestamp       | When the job was created.                                                   |
| `updatedAt`           | timestamp       | Last status or metadata update.                                             |

<!-- markdownlint-enable MD060 -->
Optional for assignment: `errorMessage` or `errorCode` when `status === "failed"`.

### 3.2 How Jobs Are Tracked

- **Create:** On successful S3 upload and before sending the SQS message, the API creates a job record with `jobId`, `status: "queued"`, and `originalImageKey`. The same `jobId` is sent in the SQS message so the worker can update the same record.
- **Read:** Status and result endpoints look up the job by `jobId` and return the current `status` and, when completed, a URL derived from `processedImageKey`.
- **Update:** Only the worker updates the job: first to `processing` when it starts, then to `completed` with `processedImageKey` (or to `failed` with optional error info).

### 3.3 Storage Options for Jobs

<!-- markdownlint-disable MD060 -->
| Option            | Description                                               | Tradeoffs                                                                                           |
| ----------------- | --------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| **In-memory**     | Store jobs in a Map or object keyed by `jobId`.           | Simple, no setup; data lost on restart. Acceptable for a take-home or single-instance demo.          |
| **File-based**    | JSON file or directory of files (one per job).            | Survives restart; no extra services; concurrency and locking need care if multiple processes write. |
| **Mock / SQLite** | SQLite or an in-memory DB used as a “mock” for a real DB. | Good for testing and for demonstrating a repository pattern; closer to production patterns. |

<!-- markdownlint-enable MD060 -->

**Recommendation for assignment:** Document the choice clearly. In-memory is sufficient to show the pipeline; file or SQLite shows persistence and testability. Consistency and clear boundaries (e.g. a single jobs module) matter more than the backing store.

---

## 4. S3 Storage Strategy

### 4.1 Bucket Structure

Two logical areas; can be one bucket with two prefixes or two buckets:

- **original-images/** — Original uploads only. Written by the API on upload.
- **processed-images/** — Processed outputs only. Written by the worker after processing.

### 4.2 Naming Convention

- **Originals:** `original-images/{jobId}.jpg` (or preserve extension, e.g. `{jobId}.png`). One file per job; `jobId` is unique.
- **Processed:** `processed-images/{jobId}.jpg` (or same extension as original). One processed file per job.

Using `jobId` in the key avoids collisions and makes it easy for the worker and API to derive keys from the job record or message.

### 4.3 URL Generation

- **Processed image URL:** The API does not expose raw S3 keys to the client. When `status === "completed"`, the backend uses the storage layer to generate a **pre-signed GET URL** for `processedImageKey`, with a short TTL (e.g. 60–300 seconds). That URL is returned as `processedImageUrl` in GET /result/:jobId (and optionally in GET /status/:jobId when completed).
- **Security:** Bucket can remain private; no public read. All access via pre-signed URLs generated by the backend/worker with appropriate IAM.

---

## 5. Queue Strategy

### 5.1 Message Structure

SQS message body (JSON):

- `jobId`: string — Identifies the job to update.
- `imageKey`: string — S3 key of the original image (e.g. `original-images/{jobId}.jpg`). Worker uses this to download the object.

Optional: `bucket` or a single key that implies bucket/prefix if multiple buckets are used.

### 5.2 Why Queue-Based Processing

- **Decoupling:** API responds quickly with `jobId`; heavy work (download, Sharp processing, upload) runs in the worker. API throughput is not tied to processing time.
- **Reliability:** SQS provides at-least-once delivery and visibility timeout so if the worker crashes, the message can be retried.
- **Scaling:** Multiple workers can consume from the same queue without the API needing to know.

### 5.3 Retries

- **Visibility timeout:** Set long enough that processing (download + Sharp + upload) usually completes (e.g. 30–60 seconds). If the worker does not delete the message before the timeout, SQS redelivers the message.
- **Worker failure:** On error (S3 or Sharp), the worker should not delete the message (or should explicitly return it to the queue) so it can be retried. Optionally set job status to `failed` after N attempts or on permanent errors to avoid infinite retries.
- **Idempotency:** Processing and upload can be idempotent (same jobId → same processed key). Duplicate messages may cause duplicate work but not inconsistent state if the worker overwrites the same processed key and sets status to `completed` once.

---

## 6. Worker Processing Pipeline

### 6.1 Architecture

The worker is a separate Node.js process (or Lambda) that:

1. **Poll queue** — Long-poll SQS for messages (or Lambda is invoked per message).
2. **Receive message** — Parse body to get `jobId` and `imageKey`.
3. **Download image from S3** — Use storage layer or S3 SDK to get the object at `imageKey`.
4. **Process image using Sharp** — Apply one or more transformations (see below).
5. **Upload processed image to S3** — Write to `processed-images/{jobId}.<ext>`.
6. **Update job status** — Set status to `processing` at start; then to `completed` with `processedImageKey`, or to `failed` on error. Then delete the SQS message.

No HTTP server in the worker; it only consumes the queue and uses S3 and the job store.

### 6.2 Simulated Processing Steps

At least one of the following (or equivalent) should be applied to demonstrate the pipeline:

- **Convert to grayscale** — Reduces color to luminance; good for testing Sharp and I/O.
- **Resize image** — e.g. max width/height or fixed dimensions; shows handling of dimensions and format.
- **Crop center** — e.g. crop to a square or fixed aspect ratio from the center; demonstrates metadata and geometry.

Choice can be fixed or configurable; the spec does not require all three.

### 6.3 Failure Handling

- **Download failure (S3):** Log error, set job status to `failed`, do not delete message so it can retry, or delete and mark failed if it’s a permanent error (e.g. key not found).
- **Processing failure (Sharp):** Log error, set job to `failed`, then either retry (don’t delete message) or delete and mark failed to avoid poison messages.
- **Upload processed image failure:** Same as above; job remains in `processing` or is set to `failed`.
- **Job update failure:** Log and consider retry; if the processed image was already uploaded, a later retry or manual fix can update the job. Optionally delete message only after job update succeeds so that visibility timeout can redeliver and retry the update.

---

## 7. Error Handling

<!-- markdownlint-disable MD060 -->
| Scenario                         | Handling                                                                                                                                  |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| **S3 upload failure (API)**      | Return `500`; do not create job or send queue message. Optionally log and return a generic message to the client.                          |
| **Invalid image upload**        | Validate type (e.g. image/jpeg, image/png) and size before S3 upload. Return `400` with a clear validation message; no job created, no queue message. |
| **Worker processing error**      | Worker sets job status to `failed`; logs error. Message is either left for retry (visibility timeout) or deleted to avoid poison messages; document the choice. |
| **Queue message send failure (API)** | If job was created and S3 upload succeeded, either retry send or return `500` and document that the job exists but may never be processed (operational follow-up). Prefer: retry once, then 500. |
| **Unknown jobId (status/result)** | Return `404` with a consistent JSON body.                                                                                                |
| **S3 pre-signed URL failure**    | If job is completed but URL generation fails, return `500`; avoid exposing internal keys.                                                 |

<!-- markdownlint-enable MD060 -->
Ensure the jobs layer and services do not throw unhandled exceptions to the client; controllers catch and map to status codes and safe JSON bodies.

---

## 8. Logging Strategy

Logging should be structured enough for debugging and review; no need for a heavy framework.

- **Uploads:** Log when upload starts (e.g. filename, size) and when it succeeds (jobId, original key). On failure, log error and context (jobId if created).
- **Job creation:** Log jobId and status when a job is created and when it is updated (e.g. processing, completed, failed).
- **Queue events:** Log when a message is sent (jobId, queue name/URL) and, in the worker, when a message is received and when it is deleted (or failed).
- **Worker processing:** Log start (jobId, imageKey), success (jobId, processed key), and failures (jobId, error type/message). Avoid logging full image buffers or S3 bodies.

Use a single logger interface so that implementation can be swapped (e.g. console vs structured logger). Include timestamp and level (info, error, warn) where useful.

---

## 9. Testing Strategy

### 9.1 Unit Tests (Jest)

- **Image processing logic:** If extraction into a pure or testable function (e.g. “apply grayscale + resize”), unit test with a fixture image or buffer; assert output dimensions or format. Mock Sharp if needed to test orchestration only.
- **Job service:** Mock the job store; test create returns jobId and initial status; get returns the right job; update changes status and processedImageKey. Test unknown jobId returns null or throws as designed.
- **Queue service:** Mock SQS SDK; test that send is called with the expected body (jobId, imageKey). Optionally test receive/delete shape.

### 9.2 Integration Test (Supertest)

- **Upload endpoint end-to-end simulation:** Mock S3 (e.g. in-memory or localstack) and SQS (or use a test queue). Send a multipart request with a small image file. Assert: 201, body has jobId and status `queued`; one object in “originals”; one message in queue with matching jobId; one job record with status `queued`. Do not run a real worker; focus on API → S3 → job → queue.

Optional: GET /status/:jobId and GET /result/:jobId with a pre-created job (and optionally a pre-created processed object) to assert response shape and that `processedImageUrl` appears only when status is `completed`.

### 9.3 Worker Tests

- **Unit:** Given a mock SQS message (jobId, imageKey), mock S3 get/put and job update; assert the worker calls get with imageKey, put with processed key, and updates job to `completed`. Test failure path sets status to `failed`.
- **Integration (optional):** Run worker against a test queue and test bucket with one message; assert processed object exists and job is completed.

---

## 10. Summary

The backend is split into **controllers**, **routes**, **services**, **queue**, **storage**, **jobs**, and **utils**, with **server.ts** as the entrypoint. The API exposes **POST /upload**, **GET /status/:jobId**, and **GET /result/:jobId**. Jobs are stored in a single store (in-memory, file, or mock DB) and tracked by UUID. Originals and processed images live in S3 under **original-images/{jobId}** and **processed-images/{jobId}**; the API returns pre-signed URLs for the processed image. SQS carries **jobId** and **imageKey**; the worker polls, downloads, processes with Sharp (e.g. grayscale, resize, crop), uploads, updates the job, and deletes the message. Errors are mapped to HTTP status codes and job status `failed` where appropriate; logging covers uploads, jobs, queue, and worker. Testing uses Jest for unit tests (jobs, queue, processing) and Supertest for an upload integration test with mocked or test S3 and SQS.
