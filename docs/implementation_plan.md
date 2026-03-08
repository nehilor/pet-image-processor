# Pet Image Processor — Implementation Plan

**Document version:** 1.0  
**Audience:** Senior engineers, implementers  
**Scope:** Step-by-step implementation order and discipline. No implementation code. Assumes existing specs in `docs/`.

---

## 1. Implementation Philosophy

### 1.1 Guiding Principles

- **Clarity over cleverness:** Prefer readable, explicit code over dense or clever solutions. Names, file layout, and control flow should make the async pipeline obvious to a reviewer. Follow the architecture in `docs/system_architecture.spec.md` and `docs/backend_processing_pipeline.spec.md` without adding unnecessary abstraction.
- **Incremental progress:** Build one layer or feature at a time. Get the backend server running before adding upload; get upload working before building the worker. Each step should leave the repo in a runnable or testable state so that problems are isolated to the last change.
- **Verify each layer before moving on:** After backend core: start the server and hit a health or stub route. After storage/queue abstractions: unit test or a minimal script that calls them. After upload: integration-style test or manual POST. After worker: run worker once and confirm job completes. Verification reduces the chance of discovering foundational bugs late.
- **Avoid premature optimization:** Do not optimize for scale or performance until the happy path works. Use in-memory job store first if the spec allows; add persistence or a DB only if required or as a later step. Keep the first version simple so the reviewer can follow the flow.
- **Keep the code reviewer in mind:** Clear commit messages, a logical folder structure, and a README that explains how to run and test the system. Assume the reviewer will read the specs first, then skim the code; the implementation should map obviously to the specs.

### 1.2 Why Structured Implementation Matters in a Take-Home

A take-home is evaluated on both outcome and process. A structured plan shows that the candidate can break a system into phases, respect dependencies (e.g. backend before frontend), and deliver in an order that minimizes rework. It also makes it easier to submit a partial but coherent solution if time runs out: backend and worker done with tests is stronger than a half-finished full stack. Following this plan and the existing specs aligns the implementation with reviewer expectations and reduces ambiguity.

---

## 2. High-Level Implementation Order

### 2.1 Recommended Order

1. **Backend foundation** — Express server, routes, controllers, services, job model, logging. No AWS yet; stubs or in-memory where needed.
2. **Storage and queue abstractions** — S3 upload/pre-signed URL and SQS send behind service layers. Job creation and status storage (in-memory or simple persistence). Enables upload and worker to be implemented against clear interfaces.
3. **Upload endpoint** — POST /upload: validation, jobId, S3 upload, job record, queue publish, response. First end-to-end API path.
4. **Worker processing pipeline** — Consume queue (poll or Lambda), download from S3, process with Sharp, upload processed image, update job status. Closes the async loop.
5. **Status and result endpoints** — GET /status/:jobId and GET /result/:jobId. Frontend can poll and display result.
6. **Frontend upload flow** — File picker, upload, preview, jobId state, polling, result display. Depends on backend and worker being functional.
7. **Terraform infrastructure** — S3, SQS, Lambda (or worker compute), IAM, environments. Defines deployable shape; can be validated with plan without full deploy.
8. **Automated tests** — Backend unit tests, upload integration test, job lifecycle and queue tests. Per `docs/testing_strategy.spec.md`.
9. **Documentation** — README, AI_USAGE.md, and any spec updates. Final pass for setup instructions and tradeoffs.

### 2.2 Why This Order Minimizes Risk and Confusion

- **Backend first:** The API is the contract. Building it before the frontend ensures the contract is stable and testable. The worker also depends on job model and queue message shape defined by the backend.
- **Abstractions before endpoints:** Storage and queue services are used by both upload and worker. Implementing them once and reusing reduces duplication and keeps AWS details in one place. Tests can mock these layers easily.
- **Upload before worker:** Upload creates jobs and messages; the worker consumes them. Implementing upload first allows manual or automated verification that jobs and messages are created correctly before adding the consumer.
- **Worker before status/result:** Status and result endpoints read job state that the worker updates. Having the worker in place makes it possible to verify completed and failed states end-to-end.
- **Frontend after backend and worker:** The frontend depends on all three endpoints and on the worker actually completing jobs. Building it last avoids building UI against stubs that later change.
- **Terraform after application code:** Infrastructure codifies the resources the app expects. Implementing app first clarifies what those resources are (bucket names, queue URL, Lambda config). Terraform can then be added without reworking the app.
- **Tests alongside or after features:** Unit tests can follow each backend layer; the upload integration test and worker tests are most useful once those paths exist. Prioritizing tests per the testing strategy gives confidence before submission.
- **Documentation last:** README and AI_USAGE reflect the final system. Writing them last avoids repeated updates and ensures setup instructions match the repo.

---

## 3. Phase 1 – Repository Initialization

### 3.1 Tasks

- **Initialize monorepo structure:** Create root directory and subdirectories `frontend/`, `backend/`, `worker/`, `terraform/`, `docs/`, `tests/`. Add a root `.gitignore` (node_modules, .env, Terraform state, build outputs). Optionally add a root package.json or tooling for running scripts across packages; keep it minimal.
- **Configure Node.js backend project:** Under `backend/`, add package.json (Express, AWS SDK, multer or similar for multipart, UUID, Sharp not required here), TypeScript or JavaScript as chosen, and a script to start the server. Create `backend/src/` and placeholder files for server entry (e.g. server.ts or index.js). Align with `docs/backend_processing_pipeline.spec.md` layout (controllers, routes, services, queue, storage, jobs, utils).
- **Configure Next.js frontend project:** Under `frontend/`, create a Next.js app (App Router, TypeScript). Add dependency for API client (fetch or axios). Ensure it can run with `npm run dev` and display a minimal page. Structure as in `docs/frontend_upload_flow.spec.md` (e.g. app/page, components, services, types, optional hook).
- **Configure worker project:** Under `worker/`, add package.json (AWS SDK, Sharp, and any shared types or config). Entry point for a Node process that will poll SQS (or a Lambda handler if Lambda is chosen). No HTTP server. Can share job status update logic with backend (e.g. in-memory store is not shared; DB or API client would be).
- **Configure Terraform folder structure:** Under `terraform/`, create `modules/` (s3, sqs, lambda or worker compute), `environments/` (dev, prod), and root `main.tf`, `variables.tf`, `outputs.tf` as per `docs/terraform_infrastructure.spec.md`. No resources yet; just the layout.
- **Create base README:** At repo root, add README.md with project name, one-sentence description, and a placeholder for architecture overview, setup, and run instructions. List the specs in `docs/` and the high-level flow (upload → queue → worker → result).

### 3.2 Purpose of Each Folder

- **frontend/** — Next.js app; user-facing upload, status, and result display. Depends on backend API.
- **backend/** — Express API; upload, status, result endpoints; job model; storage and queue integrations. Entry point for API traffic.
- **worker/** — Node (or Lambda) process that consumes SQS, processes images, writes to S3, updates job status. No UI.
- **terraform/** — IaC for S3, SQS, Lambda/worker, IAM. Used to provision or validate infrastructure.
- **docs/** — Specifications and this implementation plan. No code.
- **tests/** — Optional: shared fixtures (e.g. small test images) or E2E config. Backend and worker unit/integration tests typically live inside `backend/` and `worker/` (e.g. `backend/__tests__/` or `backend/src/**/*.test.ts`).

### 3.3 Expected Repository Structure After Phase 1

- `pet-image-processor/` with subdirs as above; each of frontend, backend, worker has a runnable (or runnable-after-stub) setup; terraform has modules and environments folders; docs contains the existing spec files; README exists and points to docs.

---

## 4. Phase 2 – Backend Core Architecture

### 4.1 Tasks

- **Express server setup:** Create the Express app in backend entry (e.g. server.ts). Attach JSON body parser middleware. Listen on a configurable port (env or default). No routes yet or a single health route (e.g. GET /health returns 200). Start server and confirm it responds.
- **Route structure:** Add a routes module (e.g. routes/index.ts or routes/jobs.ts) that mounts route handlers. Define placeholders for POST /upload, GET /status/:jobId, GET /result/:jobId. Mount routes on the app (e.g. /api prefix if desired). Confirm each route is reachable (e.g. 404 or stub response).
- **Controller layer:** For each endpoint, add a controller function that receives request and response (and optionally next). Controllers extract params (jobId), body or file, call a service function, and send response (status + JSON). No business logic in controllers; they only delegate and format. Stub services can return fixed data for now.
- **Service layer:** Add an upload service (or job service) that will orchestrate: validate file, generate jobId, call storage, create job, call queue, return result. Add placeholder functions for status and result that will call job store and storage. Services receive dependencies (storage, queue, job store) so they can be tested with mocks later.
- **Job model abstraction:** Define the job shape (jobId, status, originalImageKey, processedImageKey, createdAt, updatedAt). Add a job store interface (create, getById, update) and an in-memory implementation (e.g. Map keyed by jobId). Use this in services for create/get/update. No AWS yet.
- **Basic logging:** Add a simple logger (console or a small library). Log request method and path (or only errors). Use it in server and in controllers/services for errors so that debugging is possible without stepping through code.

### 4.2 Separation of Responsibilities

- **Controllers:** Parse HTTP (file from multer, jobId from params), call one or more service methods, set status code and JSON body. Catch service errors and map to HTTP status (e.g. 404, 500). Thin layer.
- **Services:** Contain business logic: validation rules, order of operations (upload then job then queue), and what to return. They call storage, queue, and job store abstractions. No knowledge of Express req/res.

### 4.3 Why Backend Core Before Endpoints

Implementing server, routes, controllers, services, and job store first establishes the pipeline and dependency injection points. When adding storage and queue in Phase 3, they plug into existing services without rewriting the flow. When adding upload in Phase 4, the upload service already has a clear signature and the controller only wires the file and response. Building core first avoids reworking structure when adding AWS or validation.

---

## 5. Phase 3 – Storage and Queue Integration

### 5.1 Tasks

- **Create storage service abstraction:** Implement a storage module (e.g. storage/s3.ts or storage/index.ts) that exposes: upload(buffer or stream, key) and getPreSignedUrl(key) (or getResultUrl). Internally use AWS S3 SDK; read bucket name and region from env. Key layout: originals prefix and processed prefix as in backend spec (e.g. original-images/{jobId}.jpg). Inject this into the upload and result services.
- **Create queue publishing abstraction:** Implement a queue module (e.g. queue/sqs.ts) that exposes: sendMessage(body). Body is JSON with jobId and imageKey. Use SQS SDK; queue URL from env. Inject into upload service. No receive/delete in backend unless implementing a local worker that shares the same codebase.
- **Define job creation logic:** In the upload service (or a dedicated job service), implement: create(jobId, originalImageKey) that stores a job with status `queued`. Ensure job store is called after successful S3 upload and before queue send so that a queue failure does not leave an orphan job without a message (or document the opposite order and failure behavior per spec).
- **Define job status storage strategy:** Job store already has getById and update. Worker will need to update status (processing, completed, failed) and processedImageKey. If worker runs in a separate process, job store must be shared (e.g. same in-memory store in dev if single process, or API client, or DB). Document the choice (in-memory for single-machine dev, or API calls from worker to backend for status updates).

### 5.2 Why AWS Interactions Are Abstracted

- **Testability:** Unit and integration tests can replace the storage and queue modules with mocks that assert call arguments and return success or failure. No real AWS calls in tests.
- **Clarity:** Application code depends on “upload this buffer to this key” and “send this message,” not on SDK details. Bucket names and queue URLs stay in config.
- **Flexibility:** Swapping to LocalStack or a different storage/queue implementation requires changing only the adapter, not the services.

### 5.3 How This Improves Testability

- Services receive storage and queue as parameters or via constructor. In tests, pass mock implementations that record calls and return controlled results. Assert that upload was called with the correct key, that sendMessage was called with the correct body, and that failures propagate to the response (e.g. 500).

---

## 6. Phase 4 – Upload Endpoint Implementation

### 6.1 Tasks

- **File upload handling:** Use multer (or equivalent) in the upload route to handle multipart/form-data. Configure a single file field (e.g. `image`). Limit file size per spec (e.g. 5–10 MB). Attach the file to the request (e.g. req.file). Controller passes file to upload service.
- **Validation logic:** In the service or a validation utility: require file to be present; require MIME type in allowed list (e.g. image/jpeg, image/png); require size within limit. If validation fails, return a clear error (e.g. 400 with message). Do not call storage, job, or queue on validation failure.
- **Job ID generation:** Generate a UUID (e.g. uuid.v4()) before S3 upload. Use this as jobId and in the object key (e.g. original-images/{jobId}.jpg).
- **Original image upload to storage:** Call storage.upload with the file buffer or stream and the chosen key. On failure, do not create job or send message; return 500.
- **Job record creation:** Call job store create(jobId, originalImageKey) with status queued. If using a separate job store implementation, ensure it is invoked after S3 success.
- **Queue message publishing:** Call queue.sendMessage({ jobId, imageKey: originalImageKey }). On failure, return 500; per spec, job may already exist (document behavior). Optionally retry once.
- **Response:** Return 201 with body { jobId, status: "queued" }.

### 6.2 Expected Flow for Upload

1. Request arrives with multipart file.
2. Controller extracts file; if missing, return 400.
3. Service validates type and size; if invalid, return 400.
4. Service generates jobId, uploads to S3; on S3 failure, return 500.
5. Service creates job with status queued; then sends queue message; on queue failure, return 500 (and optionally document that job exists).
6. Controller returns 201 with jobId and status.

### 6.3 Key Validation and Error-Handling Rules

- Missing file or wrong field: 400, no job, no queue.
- Invalid MIME type: 400.
- File too large: 413 or 400, per API spec.
- S3 or queue failure: 500, safe message body (no stack trace). Do not create job if S3 fails; do not send message if job create fails (order as specified in backend spec).

---

## 7. Phase 5 – Worker Processing Pipeline

### 7.1 Tasks

- **Queue polling:** If using a Node worker process: in a loop, call SQS receiveMessage (long poll). Process each message; delete on success. If using Lambda: implement the Lambda handler that receives SQS events; process each record and let Lambda delete on success. Configure event source mapping in Terraform later.
- **Message parsing:** Parse message body as JSON; extract jobId and imageKey. If missing or invalid, log and do not delete (or move to DLQ if implemented). Do not crash the worker.
- **Downloading original image:** Call S3 getObject with imageKey (and bucket from config). Stream or buffer into memory. On failure (e.g. key not found), set job status to failed, then delete message or leave for retry per spec.
- **Image processing using Sharp:** Load the buffer with Sharp; apply one or more operations (e.g. grayscale, resize, crop center) as in backend spec. Output to buffer. On Sharp error, set job to failed and handle message as above.
- **Uploading processed image:** Call S3 putObject with the processed buffer and key (e.g. processed-images/{jobId}.jpg). On failure, set job to failed.
- **Updating job status:** Before processing: optional update to `processing`. After successful upload: update to `completed` and set processedImageKey. On any failure: update to `failed`. Job store must be accessible from the worker (same process, API call, or shared DB).

### 7.2 Worker Failure Handling

- **Transient errors (e.g. network):** Do not delete the message so SQS will redeliver after visibility timeout. Optionally set job to failed after N attempts.
- **Permanent errors (e.g. invalid key):** Set job to failed; delete message to avoid poison retries, or send to DLQ if configured.
- **Consistency:** Always update job status (processing, completed, or failed) so the API and frontend never see an inconsistent state. Delete SQS message only after job update succeeds if ordering matters.

### 7.3 Job Status Transitions

- Initial: job created by API with status `queued`.
- Worker starts: optionally set to `processing`.
- Worker succeeds: set to `completed` and set processedImageKey.
- Worker fails: set to `failed`. Optional: store error message or code for debugging.

---

## 8. Phase 6 – Status and Result Endpoints

### 8.1 GET /status/:jobId

- **Logic:** Extract jobId from params. Call job store getById(jobId). If not found, return 404 with consistent body. If found, return 200 with { jobId, status }. Do not include processedImageUrl here if the API contract reserves it for GET /result.
- **Response structure:** { jobId: string, status: "queued" | "processing" | "completed" | "failed" }.

### 8.2 GET /result/:jobId

- **Logic:** Get job by jobId. If not found, return 404. If status is not completed, return 200 with current status and no processedImageUrl (or 404/409 per spec). If status is completed, get processedImageKey, call storage.getPreSignedUrl(processedImageKey), return 200 with { jobId, status: "completed", processedImageUrl }. If key is missing or URL generation fails, return 500 and do not expose internal details.

### 8.3 Job Lookup Behavior

- **Queued job:** getById returns job with status queued; status endpoint returns 200 and queued; result endpoint returns 200 without URL (or per-spec behavior).
- **Processing job:** Same idea; status processing; no result URL.
- **Completed job:** Status completed; result endpoint returns processedImageUrl.
- **Failed job:** Status failed; result endpoint does not return URL; may return status and error info.
- **Unknown job ID:** getById returns null or throws; both endpoints return 404 with consistent body. Malformed jobId (e.g. non-UUID) can be validated and return 404 or 400 per API spec.

---

## 9. Phase 7 – Frontend Upload Flow

### 9.1 Tasks

- **File selection UI:** File input with label; optional display of selected file name. On change, update state (selectedFile) and create object URL for preview. Clear previous preview on new selection.
- **Upload request integration:** On submit, validate file (type, size) client-side; if invalid, show error and do not send. If valid, POST /upload with multipart body (field name matching backend). Parse response; on 201, store jobId and set upload state to success; on error, set error message and error state.
- **Preview of selected image:** Display an image element with the object URL for the selected file. Revoke object URL on reset or unmount to avoid leaks.
- **JobId storage in state:** After successful upload, store jobId (and optionally initial status). Use React state or a custom hook (e.g. useImageProcessing) so that polling and result display can use the same jobId.
- **Polling status endpoint:** After receiving jobId, start a timer (e.g. setInterval) that calls GET /status/:jobId (or GET /result if that returns status and URL). Update processingStatus from the response. When status is completed or failed, stop polling. Clear interval on unmount. Use a ref or flag to avoid duplicate polling loops.
- **Displaying processed result:** When status is completed, call GET /result/:jobId if URL not already in status response. Display the processedImageUrl in an img tag or equivalent. Handle load error (e.g. show message).

### 9.2 Recommended Component Structure

- **Page:** Composes header, upload panel, preview, status panel, result panel, error notice. Holds state (or uses a hook) and passes props/callbacks.
- **ImageUploadPanel:** File input, upload button, disabled/loading state. Receives selectedFile, onFileSelect, onUpload, uploadState.
- **StatusPanel:** Shows current status (queued, processing, completed, failed). Receives status and optional jobId.
- **ProcessedImagePanel:** Shows processed image when URL is present. Receives processedImageUrl.
- **ErrorNotice:** Shows error message and retry/reset. Receives errorMessage, onRetry, onReset.
- **API client:** Functions that call POST /upload, GET /status, GET /result. Base URL from env or config.

### 9.3 Polling Strategy

- Start polling after 201 response with jobId. Interval: 2–3 seconds (configurable). Stop when status is completed or failed, or after a max duration/attempts. On each tick, call status (or result) and update state. Do not start a second interval if one is already active; clear interval on component unmount.

---

## 10. Phase 8 – Terraform Infrastructure

### 10.1 Tasks

- **Define S3 bucket module:** Module that creates a bucket (or two: originals, processed). Enable block public access; optional versioning for state bucket. Use variables for bucket name prefix and environment. Output bucket name(s).
- **Define SQS queue module:** Create main queue; optional DLQ and redrive policy. Visibility timeout and message retention as in terraform spec. Output queue URL and ARN.
- **Define Lambda worker module (if Lambda):** Lambda function (zip or image); execution role with SQS receive/delete, S3 get/put on the relevant prefixes, CloudWatch Logs. Event source mapping from SQS to Lambda. Timeout and memory as in spec. Output Lambda ARN.
- **Define IAM roles:** Lambda execution role; optional Backend API role if API runs on AWS. Policies scoped to the specific bucket(s), queue, and log group. No wildcard on resources where not needed.
- **Define environment structure:** environments/dev and environments/prod (or similar) with tfvars or equivalent that set env, naming prefix, and optional feature flags. Root or per-env main.tf that calls modules and passes variables.

### 10.2 Organization and Readability

- Keep each module in its own directory with main.tf, variables.tf, outputs.tf. Use descriptive variable names (e.g. bucket_name_prefix, queue_visibility_timeout_seconds). Comment non-obvious defaults. So that a reviewer can follow what each resource is for without running plan.

---

## 11. Phase 9 – Automated Testing

### 11.1 Tasks

- **Backend unit tests:** Test validation (allowed types, size, presence). Test job store (create, get, update, unknown id). Test storage and queue abstractions with mocked SDK (assert upload/send called with correct args). Test error mapping (validation → 400, not found → 404). Use Jest (or equivalent). Mock S3 and SQS in tests.
- **Upload endpoint integration test:** One Supertest test: POST /upload with a small fixture image (multipart). Mock S3 and SQS. Assert 201, body has jobId and status queued; assert job exists in store; assert queue send was called with matching jobId and key. Optionally assert 400 for missing file and 400 for invalid type.
- **Job lifecycle tests:** Unit tests that job create sets status queued; update to processing, completed, failed; get returns correct data. Status and result endpoint tests with in-memory job store: queued job returns status; completed job returns URL; unknown job returns 404.
- **Queue abstraction tests:** Unit test: sendMessage called with correct queue URL and body (jobId, imageKey). Mock SQS client.

### 11.2 What Should Be Mocked

- S3 SDK (upload, getObject, getSignedUrl or equivalent). SQS SDK (sendMessage, and receiveMessage/deleteMessage in worker tests). Optional: Sharp in worker unit tests if testing orchestration only. Time in frontend polling tests.

### 11.3 Which Tests Provide the Most Confidence

- Upload integration test: proves the full HTTP path and that job + queue are invoked correctly. Job service and status/result tests: prove API contract and state transitions. Storage and queue unit tests: prove integration points are called correctly and failures propagate.

---

## 12. Phase 10 – Documentation

### 12.1 README.md

Include:

- **Architecture overview:** Short description of frontend, backend, worker, S3, SQS, and how they connect. Reference docs/system_architecture.spec.md.
- **System flow:** Step-by-step: user uploads → API stores and enqueues → worker processes → status/result endpoints → frontend polls and displays. One paragraph or bullet list.
- **Setup instructions:** Prerequisites (Node version, AWS credentials or LocalStack if used). How to install dependencies (frontend, backend, worker). Env vars (API URL, bucket, queue URL, region). How to run backend, worker, and frontend locally. How to run tests. How to run Terraform validate/plan.
- **Tradeoffs:** In-memory job store vs persistence; polling vs WebSockets; Lambda vs long-running worker. One or two sentences each.
- **Scaling considerations:** SQS and Lambda scale with load; S3 scales; backend can be scaled horizontally. Optional: link to terraform and testing specs.

### 12.2 AI_USAGE.md

Include:

- **How AI tools were used:** Which tools (e.g. Cursor, Copilot, ChatGPT) and for what (e.g. scaffolding, writing tests, explaining Terraform).
- **Prompts used at a high level:** Short description of key prompts (e.g. “implement upload endpoint per backend spec,” “add unit tests for job service”). No need to paste full prompts unless relevant.
- **Where AI output was incorrect:** Specific examples: wrong status code, incorrect mock setup, off-spec behavior. What was fixed.
- **What was rewritten manually:** Sections or files that were rewritten for correctness, style, or alignment with specs.
- **How correctness was verified:** Running tests, manual upload flow, Terraform plan, code review against specs.

---

## 13. Suggested Git Commit Strategy

### 13.1 Example Commit Sequence

- `chore: initial monorepo structure` — Phase 1: folders, package.json files, base README.
- `feat(backend): setup Express server and route structure` — Phase 2: server, routes, controller/service stubs.
- `feat(backend): add job model and in-memory store` — Phase 2: job shape and store.
- `feat(backend): add storage service abstraction` — Phase 3: S3 upload and pre-signed URL.
- `feat(backend): add queue publishing service` — Phase 3: SQS send.
- `feat(backend): implement POST /upload` — Phase 4: validation, S3, job, queue, response.
- `feat(worker): implement processing pipeline` — Phase 5: poll, process, S3, job update.
- `feat(backend): add GET /status and GET /result` — Phase 6: status and result endpoints.
- `feat(frontend): implement upload flow and polling` — Phase 7: file picker, upload, status, result display.
- `feat(terraform): add S3, SQS, Lambda modules` — Phase 8: infrastructure layout and resources.
- `test(backend): add unit and integration tests` — Phase 9: tests per testing strategy.
- `docs: finalize README and AI_USAGE` — Phase 10: documentation.

Commits can be smaller (e.g. one per endpoint or per module); the above is a minimal sequence that tells a story.

### 13.2 Why Clear Commit History Improves Reviewer Confidence

- A reviewer can follow the implementation order and see that each step is self-contained. Easy to revert or inspect a single feature. Messages that describe “what” and “why” (e.g. “add queue abstraction for testability”) show intent. A single giant commit is harder to review and suggests lack of incremental verification.

---

## 14. Verification Checklist

### 14.1 Checks

- **Image upload works:** Select a valid image in the frontend, click upload; receive 201 and a jobId. No console or network errors.
- **JobId returned:** Response body contains jobId and status "queued". Frontend stores jobId and shows queued state.
- **Queue message created:** After upload, a message exists in the queue (or mock records the send) with jobId and imageKey. Worker receives it (or would receive it in deployed env).
- **Worker processes image:** Worker runs (locally or Lambda); message is consumed; job status moves to processing then completed (or failed on error). Processed image appears in S3 (or storage mock).
- **Processed image stored:** Object exists at processed prefix/key. Backend can generate a pre-signed URL for it.
- **Status endpoint updates correctly:** GET /status/:jobId returns queued, then processing, then completed (or failed). Same jobId throughout.
- **Frontend shows completed result:** When status is completed, frontend displays the processed image (via URL from GET /result or status). No infinite polling; error state shown on failure.

### 14.2 Why End-to-End Verification Matters Before Submission

- Automated tests may not cover every environment (e.g. real S3/SQS, CORS, or browser behavior). A quick manual pass catches integration gaps, wrong env config, or UX issues. It also confirms that the specs were implemented as intended and gives the candidate confidence to submit.

---

## 15. Time Management Strategy

### 15.1 Suggested Allocation (Relative)

- **Architecture planning:** Read all specs; align on order (this plan). Short (e.g. 10–15% of time).
- **Backend implementation:** Phases 2–4 and 6. Largest share (e.g. 35–40%). Core of the system.
- **Worker implementation:** Phase 5. Moderate (e.g. 15–20%). Depends on backend and storage/queue.
- **Frontend integration:** Phase 7. Moderate (e.g. 15–20%). Can be minimal but functional.
- **Testing:** Phase 9. Meaningful (e.g. 15–20%). At least backend unit tests and one upload integration test per testing strategy.
- **Documentation:** Phase 10. Final (e.g. 5–10%). README and AI_USAGE.

### 15.2 If Time Becomes Limited

- **Priority 1:** Backend core, storage/queue, upload endpoint, and status/result endpoints. API contract and job lifecycle must work.
- **Priority 2:** Worker pipeline so that jobs can complete. Without it, the system is incomplete.
- **Priority 3:** One integration-style test and key unit tests (job, validation, upload flow). Proves discipline.
- **Priority 4:** Frontend: at least upload and status/result display (can be minimal UI). Manual verification possible.
- **Priority 5:** Terraform structure (modules and one environment) and basic resources. Can be plan-only.
- **Priority 6:** Extra tests, polish, README and AI_USAGE. Document what was skipped and why.

Submitting a working backend + worker + minimal frontend with tests and a clear README is better than a full but broken or untested stack.

---

## 16. Future Improvements

With more engineering time, the following would improve the system:

- **Event-driven frontend updates:** WebSockets or Server-Sent Events from backend when job status changes, so the frontend does not need to poll.
- **Job persistence database:** Replace in-memory job store with PostgreSQL or DynamoDB for durability and multi-instance support.
- **Better retry handling:** DLQ, exponential backoff, and idempotent worker so that at-least-once delivery is handled safely.
- **CloudFront image delivery:** Serve processed images via CDN with pre-signed URLs or signed cookies for lower latency and reduced S3 load.
- **Observability and metrics:** Structured logging, correlation IDs across API and worker, and metrics (e.g. job created, completed, failed) for dashboards and alerts.
- **More robust worker orchestration:** Partial batch failure handling (Lambda), heartbeat or visibility timeout extension for long jobs, and clearer separation of “process image” vs “update job” for retries.

These are out of scope for the minimal assignment but document the natural next steps for production use.
