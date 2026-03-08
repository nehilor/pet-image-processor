# AI Usage in Pet Image Processor

This document describes how AI-assisted tools were used during the development of the pet-image-processor project. The goal is to be transparent: AI was used to speed up implementation while **all design decisions, integration, and validation remained under human oversight**.

---

## Overview

AI tools (including **Cursor** and **ChatGPT**) were used to accelerate development. They were applied for:

- **Architecture guidance** – Discussing async pipelines, queue vs synchronous processing, and component boundaries.
- **Boilerplate generation** – Scaffolding Express routes, Next.js pages, and worker structure so the developer could focus on business logic.
- **Documentation drafting** – Initial versions of README, API descriptions, and this file.
- **Testing suggestions** – Test layout (Jest, Supertest), what to mock (S3, SQS), and example test cases.

All generated code and text were reviewed, edited, and integrated by the developer. AI did not make final architectural or product decisions.

---

## Areas Where AI Was Used

### Project architecture planning

AI was used to explore and document:

- Separation of frontend, backend, worker, and infrastructure.
- Use of S3 for storage and SQS for decoupling.
- Flow: upload → S3 + job creation + SQS message → worker → processed image + job update → frontend polling.

Specs in `docs/` and the README reflect both AI-drafted structure and human refinements.

### Boilerplate generation

Initial code structure was generated or suggested by AI for:

- **Express backend** – Server setup, route layout, controllers, services (job, storage, queue), middleware (multer, error handling).
- **Next.js frontend** – App Router page, components (upload panel, status, result), API client, state and polling logic.
- **Worker** – Package layout, config, S3/SQS clients, job update client, poll loop and Sharp processing.

From that baseline, the developer adjusted types, error handling, env usage, and integration with the real AWS and API contracts.

### Terraform infrastructure templates

Terraform in `infra/` (provider, S3, SQS, IAM, Lambda, variables, outputs) was drafted with AI assistance. The developer reviewed resource names, IAM scoping, S3 public read for `processed-images/*`, and queue settings (visibility timeout, retention).

### Documentation drafting

- **README.md** – Structure, architecture diagram, setup steps, env vars, API endpoints, testing, and design decisions were drafted with AI and then edited for accuracy and consistency with the actual codebase.
- **AI_USAGE.md** – This file was drafted with AI and revised by the developer.

### Testing structure

AI suggested:

- Jest + Supertest for the backend.
- Splitting tests into `job.service.test.ts`, `upload.test.ts`, `status.test.ts`, and integration tests.
- Mocking S3 and SQS so tests don’t call AWS.
- Extracting the Express app for supertest (e.g. `app.ts` vs `server.ts`).

The developer implemented and adjusted the tests, assertions, and mocks to match the real API and behavior.

---

## Human Review

Every AI-generated or AI-suggested change was reviewed and often modified:

- **Architecture** – The developer validated that the async pipeline, job lifecycle, and API contract (upload → status → result) matched the intended design.
- **API contracts** – Request/response shapes, status values, and error formats were checked against the backend and frontend.
- **AWS integration** – S3 keys, prefixes, queue URL validation, and worker → backend job-update calls were verified and fixed where needed.
- **End-to-end flow** – The developer ran the full pipeline (frontend upload → backend → S3/SQS → worker → status/result) and confirmed correct behavior.

No AI-generated code was committed without being read, tested, and adjusted as necessary.

---

## Validation Process

Correctness was ensured through:

- **Manual API testing** – `POST /upload`, `GET /status/:jobId`, `GET /result/:jobId` exercised with real or test data; error cases (missing file, invalid type, unknown job) verified.
- **End-to-end image processing** – Uploading an image, confirming the worker processed it, and checking that the frontend showed the processed image and correct status.
- **Terraform** – `terraform init`, `terraform validate`, and `terraform plan` (and apply where used) to ensure the infrastructure code is valid and matches the intended resources.
- **Frontend integration** – Running the Next.js app against the real backend and confirming upload, polling, and result display.
- **Backend tests** – Running `npm test` in `backend/` and fixing any failing or flaky tests.

---

## Limitations

AI-generated code and config often needed manual refinement. Examples:

- **AWS configuration** – Placeholder or incorrect env var names, regions, or bucket/queue names were corrected; SQS URL validation was added after real usage.
- **S3 permissions and URLs** – Public read for processed images and the exact shape of `processedImageUrl` (no encoding of path slashes) were fixed after testing.
- **URL encoding** – The backend initially encoded the full S3 key in the result URL; this was changed so the key is used as-is and the URL is valid for the frontend.
- **Error handling** – Error messages, status codes, and JSON shapes were tightened so the frontend and clients could rely on them.
- **Worker ↔ backend** – The worker’s job-update endpoint (e.g. `POST /internal/job-update`) and payload were aligned with the backend and tested manually.

These fixes illustrate that AI output was treated as a starting point, not a final implementation.

---

## Where AI Assistance Was Incorrect

During development, several AI-generated suggestions required manual correction.

### Upload Endpoint Wiring

The initial implementation generated by AI created the `/upload` route but did not correctly mount it in the Express server.
This resulted in the error:

"Cannot POST /upload"

The issue was resolved by properly registering the route in `server.ts`.

### S3 URL Encoding Issue

The AI-generated implementation incorrectly encoded the S3 key when constructing the processed image URL:

processed-images%2F<jobId>.jpg

This caused broken image links in the frontend.
The fix was to construct the URL without encoding the `/` separator.

### S3 Public Access Configuration

The system initially failed to display processed images due to S3 access restrictions.

The bucket had **Block Public Access enabled**, which prevented browser access.

This was resolved by:

- disabling block public access for the bucket
- adding a bucket policy allowing `s3:GetObject`

### Verification Process

Each correction was validated through:

- manual API testing with `curl`
- frontend upload testing
- verifying direct image access via S3 URLs
- confirming the worker pipeline completed successfully

---
## Conclusion

AI served as an **assistant** to speed up architecture discussion, boilerplate, Terraform templates, documentation, and test structure. The **final system design, API contracts, AWS integration, debugging, and validation were done by the developer**. All AI-generated content was reviewed and adjusted before use. This document is intended to give readers a clear picture of how AI was used and where human judgment and verification were applied.
