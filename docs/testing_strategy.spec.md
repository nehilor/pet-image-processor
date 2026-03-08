# Pet Image Processor — Testing Strategy Specification

**Document version:** 1.0  
**Audience:** Senior engineers, test reviewers  
**Scope:** Testing philosophy, scope, priorities, and test plans. No test code.

---

## 1. Testing Philosophy

### 1.1 Overall Philosophy

Testing for this system should demonstrate **engineering discipline and good judgment**: focus on the paths and failures that matter most, avoid over-testing trivial behavior, and deliver credible confidence within take-home time limits. The goal is not exhaustive coverage but **thoughtful, risk-based coverage** that would give a reviewer and a future maintainer confidence that the core async flow and business logic are correct.

### 1.2 Priorities

- **Correctness of the core async flow:** Upload → S3 → job → queue → worker → S3 → status/result. Tests should validate that this pipeline behaves as specified: job creation, queue publish, status transitions, and result delivery.
- **Confidence in business logic:** Job lifecycle (queued → processing → completed or failed), validation rules, error mapping, and the contract between API and frontend. Unit tests should isolate services and utilities; integration-style tests should exercise the API with mocked external dependencies.
- **Validation of critical backend behavior:** POST /upload, GET /status/:jobId, GET /result/:jobId are the backbone. They must accept valid input, reject invalid input, return the correct shapes, and handle storage/queue failures in a defined way.
- **Avoiding over-testing trivial UI details:** No need for exhaustive snapshot tests, styling assertions, or testing framework internals. Frontend tests, if any, should focus on state and flow (e.g. upload button state, polling start/stop, completed/failed display).
- **Balancing realism with time constraints:** Prefer one strong integration-style test (e.g. upload through API with mocked S3/SQS) over many shallow tests. Document what is left untested and why it is acceptable.

### 1.3 Why Focus on the Most Important Risks

The system’s main risks are **data integrity** (wrong job state, missing or wrong image reference), **integration failures** (S3 or queue errors not handled), and **contract violations** (frontend expects a shape the API does not provide). Tests that target these risks give the most value per test. Cosmetic or low-impact behavior does not justify the same investment in a time-boxed assignment.

---

## 2. Testing Scope Overview

### 2.1 What Should Be Tested

- **Backend unit tests:** Validation logic, job service (create, get, update), storage and queue abstractions (with AWS SDK mocked), image processing logic where testable in isolation, error mapping. Goal: core business rules and integrations with external systems are correct when dependencies behave as expected.
- **Backend integration-style tests:** At least one test that hits the real HTTP layer (e.g. Supertest) for POST /upload (and optionally GET /status, GET /result) with S3 and SQS mocked or stubbed. Goal: verify request/response contract, status codes, and that the full upload path (validate → store → job → queue → response) is wired correctly.
- **Frontend behavioral tests (optional, limited):** If time allows: upload button enable/disable, state after successful upload, polling start, completed/failed display. Goal: critical UI state and flow, not every component or style.
- **Infrastructure validation:** Terraform validate, fmt, plan; static review of IAM and resource layout. Goal: configuration is valid and reviewable even if not deployed.
- **Manual verification:** Short checklist: upload valid image, see queued → processing → completed, see result; trigger failure and retry; invalid file. Goal: sanity check of the full flow and UX.

### 2.2 What Should Not Necessarily Be Tested

- Exhaustive frontend unit tests for every component.
- Full end-to-end browser automation (Playwright/Cypress) against a live stack.
- Real AWS integration tests (no live S3/SQS in CI unless explicitly required).
- Load or performance tests.
- Visual regression or pixel-perfect UI tests.
- Every edge case in validation (representative cases are enough).

### 2.3 Priority of Layers

**Highest priority:** Backend unit tests for job lifecycle, validation, storage/queue abstractions, and upload/status/result logic. These protect the core contract and state machine.

**Next:** One solid integration-style test for the upload flow (and optionally status/result) so the API contract and wiring are validated.

**Then:** Worker/job lifecycle behavior (unit tests with mocks; optional integration-style run with test queue/bucket if feasible).

**Lower:** Minimal frontend behavior tests; manual QA; infrastructure validation. These round out confidence without dominating the time budget.

---

## 3. Risk-Based Testing Priorities

### 3.1 Major Failure Risks

| Risk | Impact | Mitigated by |
| ---- | ------ | ------------ |
| Invalid image upload accepted | Bad data in S3/queue; worker or downstream errors | Unit tests for validation; integration test with invalid payloads |
| Upload request handling errors | Wrong status code or body; frontend cannot proceed | Upload endpoint tests (valid and invalid cases) |
| Job creation failure | No job record; status/result endpoints fail | Unit tests for job service; integration test asserts job exists after upload |
| Queue publish failure | Job created but never processed; stuck state | Unit test for queue abstraction; integration or unit test for “queue fails” path |
| Worker processing failure | Job stuck in processing or inconsistent state | Worker unit tests; job status transition tests |
| Incorrect job status transitions | Frontend shows wrong state; wrong UI branch | Job lifecycle unit tests; status endpoint tests per status |
| Missing processed image URL | Frontend cannot display result | Result endpoint tests for completed job; edge case “completed but no key” |
| Polling logic issues | Duplicate requests; never stops; wrong state | Frontend tests if implemented; documented assumptions otherwise |
| Inconsistent frontend state after backend errors | Confusing or broken UX | Failure-path API tests; frontend error-state tests if time allows |

### 3.2 Ranking and Grouping

**Tier 1 (must have):** Invalid upload rejected; valid upload returns jobId and queued; job record created and readable; status endpoint returns correct status for known job; result endpoint returns URL when completed and does not when not completed; unknown job returns 404. These are the contract and core flow.

**Tier 2 (should have):** Storage failure during upload returns 500 and no job/queue send; queue failure after upload handled (e.g. 500, job may exist); worker failure marks job failed; job lifecycle transitions (queued → processing → completed/failed) tested in isolation.

**Tier 3 (nice to have):** Frontend upload/status/polling behavior; duplicate message or retry behavior; malformed jobId handling; completed job with missing processed key.

### 3.3 Which Tests Give the Most Confidence

- **Upload integration-style test (Supertest + mocked S3/SQS):** Proves the full request path, response shape, job creation, and queue publish in one place. Highest single-test value.
- **Job service unit tests:** Prove create/get/update and status transitions without HTTP or AWS. Fast and precise.
- **Status and result endpoint tests (with in-memory or test job store):** Prove API contract for all statuses and for missing job. Directly protect frontend assumptions.
- **Validation and error-mapping unit tests:** Prove that invalid input and backend failures map to the right status codes and messages.

---

## 4. Backend Unit Testing Strategy

### 4.1 Modules to Test in Isolation

Unit tests should target **services and utilities** with **external dependencies mocked** (S3 client, SQS client, file system, or job store when testing another layer). Controllers and routes can be covered indirectly via integration-style tests or lightly in isolation with service mocks.

### 4.2 Conceptual Unit Test Areas

#### File validation logic

- **Validated:** Allowed MIME types (e.g. image/jpeg, image/png), max file size, presence of file. Rejection of invalid type, oversized file, missing file.
- **Mocked:** None (pure logic) or minimal file-like stub.
- **Cases:** Valid type and size passes; invalid type fails; over size fails; missing file fails.

#### Job creation logic

- **Validated:** Create returns job with jobId, status `queued`, originalImageKey; get by jobId returns same job; duplicate create does not overwrite incorrectly (if applicable).
- **Mocked:** Job store (in-memory or mock implementation).
- **Cases:** Create then get; unknown jobId returns null or throws as designed.

#### Job status transition logic

- **Validated:** Update from queued to processing, processing to completed (with processedImageKey), processing to failed. Invalid transitions (e.g. completed to processing) either disallowed or documented.
- **Mocked:** Job store.
- **Cases:** Each valid transition; optional invalid transition behavior.

#### S3 storage abstraction

- **Validated:** Upload called with expected bucket/key and body; getPreSignedUrl called with expected key and returns a URL-shaped string. No real S3 calls.
- **Mocked:** AWS S3 SDK (or wrapper). Assert method calls and arguments.
- **Cases:** Upload success; upload failure propagates; pre-signed URL generation success and failure.

#### Queue publishing abstraction

- **Validated:** SendMessage called with expected queue URL and body (e.g. jobId, imageKey). Body is JSON and parseable.
- **Mocked:** SQS SDK or client. Assert send called with correct payload.
- **Cases:** Publish success; publish failure propagates.

#### Result retrieval logic

- **Validated:** Given a completed job with processedImageKey, the service returns a URL (from storage layer). Given non-completed or no job, behavior is defined (e.g. null, throw, or specific error).
- **Mocked:** Job store and storage (pre-signed URL).
- **Cases:** Completed job with key returns URL; completed job without key handled; queued/processing job does not return URL; unknown job handled.

#### Image processing service logic

- **Validated:** When given a buffer or stream, the processing step (e.g. grayscale, resize) produces an output buffer or stream of expected type/size/dimensions. Sharp or similar can be mocked to return a deterministic buffer, or a tiny fixture image can be used.
- **Mocked:** Optional: Sharp if testing orchestration only; otherwise use small real image.
- **Cases:** Valid input produces valid output; invalid or corrupt input throws or returns error.

#### Error mapping and response formatting utilities

- **Validated:** Known errors (validation, not found, storage error, queue error) map to the intended HTTP status and body shape. No sensitive details leaked.
- **Mocked:** None for pure mapping; or trigger real errors from mocked dependencies.
- **Cases:** Each error type maps to correct status and safe message.

### 4.3 Success and Failure Cases That Matter Most

- **Success:** Valid upload path end-to-end in service layer (validate → store → job → queue) and correct response shape. Job get/update return expected data. Status and result services return correct shape for each state.
- **Failure:** Validation rejects invalid input; storage failure does not create job or publish to queue; queue failure after storage is handled (and optionally job exists); unknown job yields 404; completed job without key does not expose internal error.

---

## 5. Job Lifecycle Test Coverage

### 5.1 Specific Behaviors to Cover

- **New job starts as queued:** After create, get returns status `queued`. No `processedImageKey`. Status and result endpoints reflect this.
- **Queued job transitions to processing:** Update to `processing`; get returns `processing`. Status endpoint returns processing.
- **Processing job transitions to completed:** Update to `completed` with `processedImageKey`; get returns both. Status and result return completed and URL.
- **Failed processing transitions to failed:** Update to `failed`; get returns `failed`. Status returns failed; result does not return a URL (or returns error/status only).
- **Completed job exposes processed image reference:** Result endpoint returns `processedImageUrl` when status is completed. Job store and storage layer are consistent.
- **Invalid job ID returns appropriate not-found behavior:** GET /status/:id and GET /result/:id with unknown or malformed ID return 404 and consistent body. No 500 from bad ID.

### 5.2 Why State Transition Correctness Is Critical

The frontend and API contract assume a clear state machine: queued → processing → completed or failed. Wrong transitions (e.g. completed → processing) or missing transitions (e.g. job stuck in processing) break polling, result display, and user trust. Unit tests on the job service and tests on the status/result endpoints ensure the backend never exposes inconsistent or invalid states.

---

## 6. Upload Endpoint Testing Strategy

### 6.1 Test Scenarios

- **Accepts valid image upload:** Multipart request with a valid image file (e.g. small JPEG/PNG). Expect 201, body with jobId and status `queued`. Optionally assert job record exists and queue publish was called (integration-style).
- **Rejects missing file:** Request without file or wrong field name. Expect 400 and clear message. No job created; no queue publish.
- **Rejects unsupported file type:** File with disallowed MIME type. Expect 400. No job; no queue.
- **Rejects oversized file:** File over configured max size. Expect 413 or 400. No job; no queue.
- **Returns jobId and queued status on success:** Response body shape and values. Integration test can assert job store and queue mock were invoked correctly.
- **Handles storage failure gracefully:** Mock S3 upload to reject or throw. Expect 500; no job created; no queue publish. Response body safe (no stack trace).
- **Handles queue publish failure gracefully:** Mock S3 to succeed, queue to fail. Expect 500 or defined behavior; job may exist (document). No partial success exposed to client in an inconsistent way.

### 6.2 Unit-Style vs Integration-Style

- **Unit-style (service or controller with mocks):** Validate and storage/queue/job mocks. Assert validation rules, that storage and queue are called with correct arguments, and that failures propagate to the right status code. No real HTTP.
- **Integration-style (Supertest):** Real HTTP POST with multipart body. S3 and SQS mocked at the SDK or adapter layer. Assert status code, response body, and (via mocks or test doubles) that job was created and queue message was sent. One such test is the minimum for “integration-style” coverage.

---

## 7. Status Endpoint Testing Strategy

### 7.1 Scenarios

- **Existing queued job:** GET /status/:jobId with job in queued state. Expect 200, body with jobId and status `queued`. No processedImageUrl.
- **Existing processing job:** Job in processing. Expect 200, status `processing`.
- **Existing completed job:** Job completed with processedImageKey. Expect 200, status `completed`. processedImageUrl may appear here or only on GET /result per API design.
- **Existing failed job:** Job failed. Expect 200, status `failed`. No processedImageUrl.
- **Unknown job ID:** Valid UUID format but not in store. Expect 404 and consistent body.
- **Malformed job ID:** Invalid format (e.g. non-UUID). Expect 404 or 400 per API contract.

### 7.2 API Contract Guarantees

- Every known job returns 200 with jobId and status. Status is one of queued, processing, completed, failed.
- Unknown or invalid jobId returns 404 (or 400 for malformed). Response shape is consistent (e.g. JSON with message or code).
- No 500 for “job not found” or invalid ID. Frontend relies on 404 to show “job not found” or to stop polling.

---

## 8. Result Endpoint Testing Strategy

### 8.1 Scenarios

- **Completed job returns processed image URL:** Job completed and has processedImageKey. Expect 200, status `completed`, processedImageUrl present and URL-shaped (or usable by frontend).
- **Non-completed job does not return result:** Job queued or processing. Expect 200 with current status and no processedImageUrl, or 404/409 per design. Frontend must not receive a URL for non-completed jobs.
- **Failed job returns appropriate error or status:** Job failed. Expect 200 with status `failed` and no processedImageUrl, or error response. Frontend shows error state, not result.
- **Unknown job ID returns not found:** Expect 404.
- **Completed job missing image key handled safely:** Edge case where status is completed but processedImageKey is null or missing. Expect 500 or defined error; no crash. Frontend should see an error, not a broken URL.

### 8.2 How the Frontend Depends on This

The frontend polls status and, when status is completed, calls GET /result to get the URL and displays the image. If the result endpoint returns a URL for a non-completed job, or fails to return a URL for a completed job, or returns 200 with inconsistent shape, the UI can show wrong content or hang. Tests that assert status/result shape and URL presence only when completed protect that contract.

---

## 9. Queue and Worker Testing Strategy

### 9.1 Unit Testing the Queue Service Abstraction

- **Validated:** Given jobId and imageKey, the queue service calls the SQS client with the correct queue URL and a JSON body containing those fields. No real SQS.
- **Mocked:** SQS SDK or client. Assert send called once with correct payload.
- **Cases:** Success; client throws and error propagates.

### 9.2 Unit Testing Worker Orchestration Logic

- **Validated:** Given an SQS message body (jobId, imageKey), the worker logic (orchestrator) calls: get from job store, get object from S3, process image, put object to S3, update job to completed with processedImageKey, then delete message (or equivalent). Order and arguments correct. On S3 or process failure, job updated to failed and message not deleted (or deleted after N failures per design).
- **Mocked:** S3 get/put, job store get/update, SQS delete. Optionally image processing (Sharp) to return deterministic output.
- **Cases:** Happy path; S3 get failure; S3 put failure; processing throws; job update failure. Assert job status and message delete/no-delete as designed.

### 9.3 Integration-Style Simulation of Async Processing

- **Concept:** Run the worker (or a test harness that invokes the same logic) against a test queue and test bucket (e.g. LocalStack or in-memory mocks). Send one message; assert processed object exists in “processed” bucket/prefix and job is completed. Optional: use real Sharp with a tiny fixture.
- **Scope for take-home:** Full integration with real SQS/S3 is optional. At minimum: unit tests for worker orchestration with all AWS and job store mocked. If time allows, one run against LocalStack or test doubles that simulate the full path.

### 9.4 Scenarios to Cover Conceptually

- Valid queue message is processed successfully: job completed, processed object written, message deleted.
- Invalid queue message (missing jobId or imageKey): worker rejects or fails; message not deleted or sent to DLQ; job status failed or unchanged.
- Image processing error: job marked failed; message retried or moved to DLQ per design.
- S3 read failure: job failed; no processed object; message retried or DLQ.
- S3 write failure: job failed; message retried or DLQ.
- Worker does not leave status inconsistent: e.g. if job update fails after S3 put, document behavior (retry on next receive vs manual fix).
- Duplicate message handling: processing is idempotent (same jobId overwrites same key); duplicate receive does not corrupt state.
- Retry-safe behavior: Visibility timeout and optional maxReceiveCount; after N failures message goes to DLQ. Worker logic does not assume exactly-once delivery.

### 9.5 What Can Be Realistically Tested vs Documented

- **Realistically testable in take-home:** Queue send unit test; worker orchestration unit test with mocks; optional one integration-style test with test queue/bucket or mocks that simulate the full path.
- **Documented assumptions:** Exact retry count; DLQ replay procedure; behavior when job update fails after S3 write. These can be described in the spec or README rather than fully automated.

---

## 10. Integration Testing Strategy

### 10.1 Minimum Integration-Style Test

The system **must** include at least one test that is integration-style: real HTTP layer (Supertest), real application code path for upload (and optionally status/result), with external systems mocked.

**Suggested scenario:**

1. Start the app (or a test server) with mocked S3 and SQS (or test doubles that record calls).
2. POST /upload with a valid multipart image (small fixture).
3. Assert: 201 response; body contains jobId and status `queued`.
4. Assert: S3 upload was called with expected bucket/key (or equivalent).
5. Assert: SQS send was called with message body containing that jobId and the same key.
6. Assert: Job record exists in the job store (in-memory or test double) with status queued and originalImageKey set.
7. Optionally: GET /status/:jobId returns 200 with status queued.
8. Optionally: Simulate worker completion (update job to completed, set processedImageKey; optionally put a fake object in storage mock). Then GET /result/:jobId returns 200 with processedImageUrl.

### 10.2 What May Still Be Mocked

- **S3:** Mock or stub so that PutObject and GetObject (and pre-sign) succeed or fail on demand. No real AWS.
- **SQS:** Mock or stub so SendMessage is recorded and no real message is sent. ReceiveMessage/DeleteMessage can remain unused in this test unless worker is also run.
- **Job store:** Can be real in-memory implementation so that job creation and retrieval are real. That makes the test more of an integration test while keeping S3/SQS controlled.

### 10.3 What Makes It Integration-Style

- **Real HTTP:** Request goes through Express (routes, middleware, controllers). Response status and body are what the client would see.
- **Real application flow:** Validation, storage call, job creation, queue publish, and response are executed in order. No bypassing of layers.
- **External systems mocked:** S3 and SQS are not real, so the test is fast, deterministic, and does not require AWS. The “integration” is between the HTTP layer and the application logic, with clear boundaries at the storage and queue adapters.

---

## 11. Mocking Strategy

### 11.1 Dependencies to Mock in Most Automated Tests

- **AWS S3 SDK calls:** Upload, GetObject, and pre-signed URL generation. Mock at the client or adapter layer so tests do not call real S3. Allows asserting correct keys and body; allows simulating failures.
- **SQS SDK calls:** SendMessage (and ReceiveMessage/DeleteMessage in worker tests). Mock so no real messages are sent. Assert message body and queue URL.
- **Image processing (Sharp) where necessary:** If testing orchestration only, mock Sharp to return a buffer. If testing actual transform, use a small fixture image and real Sharp; keep tests fast.
- **Time-based polling (frontend):** In frontend tests, mock timers or fake the API client so polling can be advanced without real delays. Avoids slow and flaky tests.

### 11.2 What Should Not Be Mocked

- **Core business logic:** Validation rules, job state transitions, error-to-status mapping. These are the behavior under test; mock only their dependencies (file, store, S3, SQS).
- **Request/response shaping in the layer under test:** If testing a controller or route, the mapping from service result to HTTP response should be real so that contract bugs are caught.
- **Job store in integration test:** Using a real in-memory (or test) job store in the upload integration test avoids mocking the very behavior (job creation) that the test is meant to validate.

### 11.3 Principle

Mock **external systems and side effects** (AWS, time, file system if needed), not the **logic under test**. Over-mocking can hide bugs in business rules; the goal is to isolate the unit or integration path while keeping the code under test as close to production as practical.

---

## 12. Test Data Strategy

### 12.1 Sample Image Fixtures

- Use **small** image files (e.g. tiny JPEG/PNG, few KB) for upload and processing tests. Stored in the repo (e.g. `test/fixtures/`). Avoid large binaries; tests should stay fast and portable.
- One or two fixtures are enough: one valid JPEG, one valid PNG. Optional: one invalid (wrong extension or corrupt) for failure cases.

### 12.2 Deterministic Fake Job IDs

- Use fixed UUIDs (e.g. `test-job-id-1`) in unit tests for job store and status/result endpoints so that behavior is reproducible. Generate UUIDs only where the test asserts “new job” behavior (e.g. in upload integration test).

### 12.3 Stable Mock Responses

- Mocks should return consistent, minimal data (e.g. success with empty or minimal body, or a fixed error). Avoid randomness so tests are deterministic and failures are easy to reproduce.

### 12.4 Avoiding Large Binary Assets

- Do not commit large images. If a test needs a “large file” for size validation, generate a buffer of the required size in memory or use a small file and mock the size check. Keeps the repo small and tests fast.

### 12.5 Fast, Readable, Deterministic

- **Fast:** No real AWS; small fixtures; mock timers in frontend. Suite should run in seconds.
- **Readable:** Clear test names (e.g. “POST /upload returns 201 and jobId when valid image provided”); one main assertion per test or one logical scenario.
- **Deterministic:** No flaky timeouts or network; fixed IDs and mock responses. Same result every run.

---

## 13. Failure Case Coverage

### 13.1 Most Important Failure-Path Tests

- **Upload without file:** 400; no job; no queue. Validates validation and that no partial state is created.
- **Invalid MIME type:** 400; no job; no queue.
- **Backend service throws unexpectedly:** Controller or service catches and returns 500 (or defined code) with safe body. No stack trace or internal detail in response.
- **S3 upload failure:** Upload path returns 500; no job created; no queue publish. Ensures no orphan job or message.
- **Queue publish failure:** After S3 success, queue fails. Return 500 (or defined behavior); job may exist—document. Ensures client sees failure and does not assume success.
- **Worker processing exception:** Worker unit test: job updated to failed; message not deleted (or DLQ). Ensures state stays consistent.
- **Job status endpoint for nonexistent job:** 404; consistent body. No 500.
- **Result endpoint before completion:** 200 with status and no URL, or 404/409 per design. Frontend never gets a URL for incomplete job.
- **Transient polling/backend network failure:** Conceptually: frontend should handle non-2xx or network error (show error, allow retry). Can be documented or lightly tested in frontend; backend tests ensure status/result return correct codes so frontend can distinguish not-found from server error.

### 13.2 Why Failure-Path Testing Matters More Than Cosmetic UI

In this assignment, the main risks are **wrong data, wrong state, and broken contract**. Failure-path tests ensure that invalid input and backend errors are handled correctly and that the API never leaks inconsistent or sensitive information. Cosmetic UI tests (e.g. exact class names or pixel layout) do not reduce these risks and consume time that is better spent on backend and integration coverage.

---

## 14. Frontend Testing Considerations

### 14.1 What Is Worth Testing If Time Allows

- **Upload button enabled/disabled:** Disabled when no file or invalid file; disabled during upload; enabled again after success or error.
- **State transitions after successful upload:** jobId stored; status area shows queued (or similar); polling starts (e.g. mock API and assert poll called with jobId).
- **Polling starts after jobId received:** After upload response, GET /status or GET /result is called (mock API client and assert).
- **Completed state renders processed image:** When status is completed and processedImageUrl is set, image or result area is visible. Mock API to return completed and URL.
- **Failed state renders error messaging:** When status is failed or API returns error, error area shows a message; retry or reset available.

### 14.2 What Can Be Omitted in a Time-Boxed Challenge

- Exhaustive snapshot tests for every component.
- Styling or layout assertions (e.g. specific CSS or dimensions).
- Trivial presentational details (e.g. exact button text or icon).
- Full coverage of every state combination in the UI.
- E2E browser tests (unless explicitly required).

Frontend tests should add confidence in **state and flow**, not in appearance. One or two tests that prove upload → jobId → polling → completed/failed display are enough to show awareness; the rest can be manual.

---

## 15. Infrastructure Testing and Validation Strategy

### 15.1 Validation Without Full Deploy

- **terraform fmt:** Ensures consistent formatting. Run in CI or pre-commit.
- **terraform validate:** Checks syntax and basic configuration. Catches many errors without apply.
- **terraform plan:** Run against a dev or sandbox state (or empty state) to ensure plan succeeds and resource set is as expected. No apply required for the assignment, but plan validates that modules and variables are wired correctly.
- **Static review of IAM policies:** Read Terraform IAM policies and confirm Lambda has only SQS receive/delete, S3 get/put on the right prefixes, and CloudWatch Logs; API role has only S3 and SQS send; no wildcard on resources where not needed.
- **Manual review of least-privilege:** Document that roles are scoped and that no role has more permission than necessary. Part of the assignment is demonstrating security awareness.

### 15.2 Why Infrastructure Correctness Is Partly Validated by Structure and Reasoning

In a take-home, full deployment and post-deploy tests may not be required. Confidence comes from: (1) Terraform validating and planning cleanly, (2) a clear module and variable structure, and (3) a written explanation of IAM and resource design. The spec and code review replace live integration tests for infrastructure.

---

## 16. Manual Test Plan

### 16.1 Short QA Checklist

- **Upload a valid image:** Choose JPEG or PNG, submit. Expect “Upload accepted” or “Queued” and a job ID. No error.
- **See queued state:** Status area shows “Queued” (or equivalent) after upload.
- **See processing state:** Within a few seconds, status updates to “Processing” (if worker is running and fast enough).
- **See completed image:** When worker finishes, status becomes “Completed” and the processed image appears. Image loads from the URL returned by the API.
- **Simulate backend failure:** Stop the worker or backend, or use an invalid request. Trigger an error path. Expect clear error message and no crash.
- **Verify failed state is understandable:** If job fails, UI shows “Failed” or similar and an error message. User knows what happened.
- **Retry flow works:** After failure, retry (or reset and re-upload) works. No stuck state.
- **Invalid file shows validation message:** Select non-image or oversized file. Submit. Expect validation message and no upload.

### 16.2 Why Manual Testing Still Matters

Automated tests cannot cover every device, browser, or timing. Manual testing confirms that the **end-to-end flow feels correct**, that errors are visible and actionable, and that the implementation matches the intended UX. It also catches integration gaps (e.g. CORS, wrong base URL) that unit and integration tests might not hit. A short checklist is sufficient to demonstrate due diligence.

---

## 17. Coverage Prioritization Under Time Constraints

### 17.1 Recommended Priority Order

1. **Backend unit tests for critical services:** Validation, job service (create/get/update and transitions), storage and queue abstractions, error mapping. These are fast and protect core logic.
2. **Upload endpoint integration-style test:** One Supertest test with mocked S3/SQS that asserts 201, jobId, job creation, and queue publish. Highest single-test value.
3. **Worker and job lifecycle tests:** Worker orchestration unit test with mocks; status and result endpoint tests for each job state and for unknown job. Protects async flow and API contract.
4. **Minimal frontend behavior tests:** Upload button state; optional polling and completed/failed display. Adds UI confidence without large effort.
5. **Extra edge cases:** Malformed jobId, completed job without key, queue failure after upload. Fill remaining time.

### 17.2 Why This Order

- **Unit tests first:** Fast feedback; they define the intended behavior of each piece. Without them, integration tests are harder to debug.
- **Upload integration second:** Proves the main entry point and the wiring of validate → store → job → queue. One test covers a lot.
- **Status/result and worker third:** These close the loop on the async pipeline and the contract the frontend depends on.
- **Frontend and edge cases last:** They add polish and extra safety but are not the foundation. If time runs out, the first three items already provide strong confidence.

---

## 18. What Intentionally Will Not Be Fully Tested

### 18.1 Explicit Omissions

- **Full end-to-end browser automation:** No Playwright/Cypress against a fully deployed stack. Requires running frontend, backend, worker, and optionally AWS or mocks; high setup and maintenance for a take-home.
- **Real AWS integration tests:** No tests that call live S3 or SQS. They require credentials, cost, and environment setup; mocks and LocalStack are sufficient to demonstrate behavior.
- **Full visual regression tests:** No pixel or screenshot comparison. Low value for this assignment; manual check is enough.
- **Load testing:** No performance or concurrency tests. Scope is correctness and contract, not scale.
- **Exhaustive frontend component testing:** Not every component or prop combination. Only the critical state and flow (upload, polling, completed/failed).

### 18.2 Why These Are Reasonable Omissions

The assignment evaluates **testing judgment and discipline**, not total coverage. E2E, real AWS, load, and exhaustive UI tests are valuable in production but require time and tooling. For a take-home, omitting them and **documenting the omission** shows awareness of tradeoffs. The reviewer can see what was tested, what was not, and why the chosen scope is appropriate.

---

## 19. Success Criteria

### 19.1 “Good Enough” for This Assignment

- **Core backend paths are covered:** Upload (valid and key invalid cases), status (known job in each status, unknown job), result (completed with URL, non-completed, unknown job). Unit tests for job, validation, storage, and queue abstractions.
- **Major failure paths are validated:** Missing file, invalid type/size, S3 failure, queue failure, worker failure, 404 for unknown job. No need for every possible failure, but the main ones that affect user or system state.
- **One meaningful integration-style test exists:** At least one test that uses the real HTTP layer (e.g. Supertest) for upload (and optionally status/result) with S3/SQS mocked. This test proves the wiring and contract.
- **Async job lifecycle behavior is tested:** Job transitions (queued → processing → completed/failed) are tested in unit and/or endpoint tests. Worker orchestration is tested with mocks.
- **Documentation clearly explains remaining gaps:** README or testing doc states what is tested, what is not (E2E, real AWS, load, full frontend), and why. Reviewer can assess risk and judgment.

Meeting these criteria demonstrates thoughtful, risk-based testing within take-home constraints.

---

## 20. Future Testing Improvements

With more time, the following would strengthen the test suite:

- **LocalStack-based integration tests:** Run backend (and optionally worker) against real S3 and SQS in Docker. Full path without production AWS. Validates SDK usage and configuration.
- **End-to-end browser tests:** Playwright or Cypress for the full flow: upload → see status → see result. Catches frontend–backend integration and UX issues.
- **Worker contract tests:** Explicit tests that the worker expects a specific message shape and that the API sends that shape. Ensures producer and consumer stay in sync.
- **Retry and idempotency tests:** Worker receives same message twice; assert idempotent behavior (e.g. same result, no duplicate side effects). Important for SQS at-least-once delivery.
- **Performance or load tests:** Many concurrent uploads; queue depth and Lambda concurrency. Validates scaling and limits.
- **Observability and assertions on logs/metrics:** Structured logs or metrics (e.g. job created, job completed, errors). Tests or manual checks that critical events are logged and that error paths emit expected data for debugging.

These improvements are out of scope for the minimal assignment but document the direction for a production-ready system.
