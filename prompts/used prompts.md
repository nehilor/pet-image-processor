You are a senior software architect helping design a take-home engineering assignment system.

Do NOT write implementation code.

Your task is to produce a **technical architecture specification** for the system described below.

The output must be a structured engineering document saved as:

docs/system_architecture.spec.md

The document must be written clearly as if it will be reviewed by senior engineers.

---

## PROJECT CONTEXT

We are building a small system that processes uploaded pet images asynchronously.

The goal of the assignment is to evaluate:

• architecture decisions
• async system design
• AWS infrastructure awareness
• testing strategy
• code organization
• ability to work with AI tools responsibly

The system should be intentionally simple but production-inspired.

---

## SYSTEM REQUIREMENTS

Users must be able to:

1. Upload a pet image
2. See the processing status
3. See the processed image once ready

The system must:

• store original images in S3
• process images asynchronously
• simulate AI processing (e.g., grayscale, crop, resize)
• store the processed image in S3
• expose an API to check job status

Processing must NOT be synchronous.

---

## TECH STACK

Frontend:
Next.js + React

Backend API:
Node.js (Express)

Async Queue:
AWS SQS

Worker:
Node.js worker or AWS Lambda

Storage:
AWS S3

Infrastructure as Code:
Terraform

Testing:
Jest + Supertest

---

## ARCHITECTURE STYLE

The system must follow a **clean async pipeline design**.

Flow:

Frontend
→ Backend API
→ S3 upload
→ Queue job
→ Worker processing
→ S3 processed image
→ Status API
→ Frontend polling

---

## WHAT THE SPEC MUST CONTAIN

Write the architecture specification with the following sections.

1. System Overview

Explain the goal of the system and the overall design.

2. High-Level Architecture

Describe each component:

Frontend
Backend API
Queue
Worker
S3 Storage
Terraform infrastructure

3. System Data Flow

Explain step-by-step h


------------------------------------------------------

You are a senior backend engineer designing the processing pipeline for a take-home engineering assignment.

Do NOT generate code.

You must produce a **technical backend specification** that defines the architecture and responsibilities of the backend services.

Save the document as:

docs/backend_processing_pipeline.spec.md

---

## PROJECT CONTEXT

We are building an asynchronous image processing system for uploaded pet photos.

Users upload an image.

The system must:

1. Store the original image in S3
2. Create a processing job
3. Send a message to a queue
4. A worker consumes the queue
5. The worker processes the image
6. The processed image is stored in S3
7. The job status becomes "completed"

The frontend polls the backend to check job status.

---

## BACKEND STACK

Node.js
Express
AWS SDK
SQS
S3
Sharp (image processing)
UUID for job IDs

Testing:

Jest
Supertest

---

## BACKEND ARCHITECTURE

The backend must be separated into logical layers.

Define the following architecture structure:

backend/
src/
controllers/
routes/
services/
queue/
storage/
jobs/
utils/
server.ts

Explain the responsibility of each layer.

---

## API ENDPOINTS

Define the API contract for the system.

POST /upload

Purpose:
Upload an image and create a processing job.

Flow:

1. Validate file upload
2. Generate jobId
3. Upload original image to S3
4. Create job record
5. Send message to SQS
6. Return jobId

Response example:

{
jobId: string,
status: "queued"
}

---

GET /status/:jobId

Purpose:
Return the processing status of a job.

Possible statuses:

queued
processing
completed
failed

Response example:

{
jobId: string,
status: "processing"
}

---

GET /result/:jobId

Purpose:
Return the processed image URL.

Response example:

{
jobId: string,
status: "completed",
processedImageUrl: string
}

---

## JOB MODEL

Define the structure of a processing job.

Example conceptual model:

Job

jobId
status
originalImageKey
processedImageKey
createdAt
updatedAt

Explain how jobs are tracked.

Explain whether jobs are stored:

in-memory
file-based
or mock database

Explain tradeoffs.

---

## S3 STORAGE STRATEGY

Define how images are stored.

Bucket structure example:

original-images/
processed-images/

Explain naming convention:

original-images/{jobId}.jpg
processed-images/{jobId}.jpg

Explain how URLs are generated.

---

## QUEUE STRATEGY

Define how SQS messages look.

Example message structure:

{
jobId: string,
imageKey: string
}

Explain why queue-based processing is used.

Explain how retries should behave.

---

## WORKER PROCESSING PIPELINE

Define the worker architecture.

Worker responsibilities:

1. Poll queue
2. Receive message
3. Download image from S3
4. Process image using Sharp
5. Upload processed image to S3
6. Update job status

Define possible simulated processing steps:

• convert to grayscale
• resize image
• crop center

Explain failure handling.

---

## ERROR HANDLING

Define how the system handles:

S3 upload failure
invalid image upload
worker processing error
queue message failure

---

## LOGGING STRATEGY

Define logging for:

uploads
job creation
queue events
worker processing

---

## TESTING STRATEGY

Define the backend testing approach.

Unit tests should cover:

image processing logic
job service
queue service

Integration test:

upload endpoint end-to-end simulation

---

## IMPORTANT RULES

• Do not generate code
• This is a specification document
• Use clear architecture explanations
• Use bullet points where helpful
• Keep the design simple but realistic
• Avoid overengineering
• Assume this system will be reviewed by senior engineers


------------------------------------------------------

You are a senior frontend engineer designing the frontend experience for a take-home engineering assignment.

Do NOT generate code.

Your task is to produce a detailed frontend technical specification document for the upload and async processing flow.

Save the document as:

docs/frontend_upload_flow.spec.md

--------------------------------------------------
PROJECT CONTEXT
--------------------------------------------------

We are building a minimal frontend for an asynchronous pet image processing system.

The system allows a user to:

1. Upload a pet image
2. See upload progress / status
3. See backend processing status
4. See the processed image once the async job is complete

The UI must remain intentionally simple.
Visual polish is not the priority.
The priority is clarity, correctness, and clean state handling.

--------------------------------------------------
TECH STACK
--------------------------------------------------

Frontend framework:
Next.js + React + TypeScript

Assume a modern App Router-based Next.js project.

The frontend communicates with a separate Node.js backend API.

--------------------------------------------------
PRODUCT GOAL
--------------------------------------------------

The frontend should provide a clean and obvious user journey:

1. User selects an image
2. User submits upload
3. UI shows that upload was accepted
4. UI begins polling for job status
5. UI updates as job status changes
6. UI displays the processed image when ready
7. UI handles failures gracefully

The UX should feel deterministic, understandable, and easy to review by engineers.

--------------------------------------------------
FRONTEND SCOPE
--------------------------------------------------

The frontend should include a single primary page for the challenge.

This page should contain:

• title / short description
• image file picker
• upload button
• preview of selected original image
• upload / processing state section
• processed image result section
• error message area
• retry / reset behavior

No authentication is required.
No dashboard is required.
No multiple-page product flow is required.

--------------------------------------------------
DOCUMENT REQUIREMENTS
--------------------------------------------------

Write a detailed frontend specification with the following sections.

1. Frontend Overview

Explain the goal of the frontend and the intended user experience.

2. Page Structure

Define the layout of the main page.

Describe the major UI blocks:

• header / title area
• upload panel
• original image preview
• processing status panel
• processed image result panel
• error / retry area

Explain the order in which these should appear.

3. Frontend State Model

Define all relevant UI state clearly.

At minimum include conceptual state for:

• selected file
• local preview URL
• upload request state
• current jobId
• processing status
• processed image URL
• error message
• polling active / inactive
• reset / retry state

Explain how state transitions occur.

4. User Flow

Describe the full frontend user journey step by step:

A. Initial state
B. File selected
C. Upload submitted
D. Upload successful
E. Polling in progress
F. Processing completed
G. Processing failed
H. User retries
I. User resets and uploads another image

5. API Integration Contract

Describe how the frontend should call the backend.

Include conceptual integration for:

POST /upload
GET /status/:jobId
GET /result/:jobId

For each endpoint explain:

• when it is called
• what frontend state it updates
• how errors should be surfaced in the UI

6. Polling Strategy

Define the polling approach in detail.

Explain:

• when polling starts
• polling interval
• when polling stops
• max timeout or termination behavior
• what happens if polling fails temporarily
• what happens if the job status becomes failed
• how to avoid duplicate polling loops

Use a simple strategy suitable for a take-home challenge.

7. File Validation Rules

Define frontend validation before upload.

At minimum explain:

• allowed file types
• max file size
• behavior for invalid files
• how validation errors should appear

Keep the validation simple and practical.

8. UI States and Status Messaging

Define the expected UI messaging for each major state.

At minimum include messages for:

• no file selected
• file ready to upload
• upload in progress
• upload accepted / queued
• processing
• completed
• failed
• network error

The wording should be simple and user-friendly.

9. Component Architecture

Define a clean component breakdown for the frontend.

Propose a structure such as:

src/app/page.tsx
src/components/ImageUploadPanel.tsx
src/components/StatusPanel.tsx
src/components/ImagePreview.tsx
src/components/ProcessedImagePanel.tsx
src/components/ErrorNotice.tsx
src/services/api.ts
src/types/index.ts
src/hooks/useImageProcessing.ts (optional)

For each component or module, explain its responsibility.

Do NOT over-componentize unnecessarily.

10. State Management Strategy

Explain whether local component state is enough or whether a custom hook should be used.

Prefer a simple approach.

Explain why global state libraries are unnecessary here.

11. Error Handling UX

Define how the frontend should handle and present:

• upload request failure
• invalid file selection
• polling request failure
• backend job failure
• missing result image

Explain what users should be able to do after each error.

12. Accessibility and Usability Considerations

Define lightweight but important usability rules:

• accessible labels for file input
• disabled button states
• clear status messaging
• alt text for images
• keyboard-friendly interaction

13. Styling Guidance

The UI should be simple, clean, and professional.

Explain styling guidance such as:

• single-column centered layout
• card/container sections
• clear spacing
• simple status badges
• minimal visual hierarchy
• no elaborate design system required

Keep styling intentionally modest for the challenge.

14. Testing Considerations for Frontend

Explain what frontend behavior is most important to test if time allows.

Examples:

• file selection behavior
• upload button disabled logic
• polling start/stop logic
• state rendering for completed/failed jobs

This is a specification, not test code.

15. Tradeoffs

Explain what was intentionally simplified in the frontend and why.

Examples:

• polling instead of websockets
• one-page flow
• local state instead of global store
• minimal styling over fancy UI

16. Future Improvements

Explain what would be improved with more time.

Examples:

• drag-and-drop upload
• progress bar
• event-driven updates
• richer error recovery
• image metadata
• better responsive polish

--------------------------------------------------
IMPORTANT RULES
--------------------------------------------------

• Do not generate code
• This must be a specification document only
• Write in clear engineering language
• Be detailed and explicit
• Prefer clarity over verbosity
• Keep the design realistic for a take-home assignment
• Avoid unnecessary complexity
• Assume the audience is a senior engineering reviewer


------------------------------------------------------

You are a senior DevOps engineer designing the infrastructure for a take-home engineering assignment.

Do NOT generate Terraform code.

Your task is to produce a **Terraform infrastructure specification document** describing how the system infrastructure should be provisioned.

Save the document as:

docs/terraform_infrastructure.spec.md

---

## PROJECT CONTEXT

We are building an asynchronous image processing system for uploaded pet photos.

The system components are:

Frontend (Next.js)
Backend API (Node.js / Express)
Async queue (AWS SQS)
Worker (AWS Lambda or container worker)
Storage (AWS S3)

The system allows users to upload images which are processed asynchronously by a worker.

This assignment evaluates infrastructure awareness and Terraform discipline.

---

## INFRASTRUCTURE GOALS

The infrastructure should be:

• simple
• realistic
• secure
• cost-conscious
• production-inspired but not overengineered

The Terraform configuration does NOT need to actually be deployed, but it should be **realistic and runnable**.

---

## MAIN INFRASTRUCTURE COMPONENTS

Define the infrastructure resources required.

At minimum include:

S3 bucket(s)
SQS queue
Worker compute (Lambda recommended)
IAM roles and policies
Environment configuration

Explain what each resource is responsible for.

---

## S3 STORAGE DESIGN

Define the S3 storage architecture.

Explain:

• bucket naming strategy
• directory structure inside the bucket
• original vs processed image storage

Example conceptual layout:

original-images/
processed-images/

Explain how lifecycle rules could be used to reduce storage cost.

Explain public vs private object access strategy.

Explain how image URLs would be generated.

---

## SQS QUEUE DESIGN

Define the queue used for asynchronous job processing.

Explain:

• queue purpose
• message structure
• visibility timeout
• retry behavior
• dead-letter queue considerations

Explain how the worker consumes messages.

---

## WORKER COMPUTE DESIGN

Define the worker architecture.

Assume AWS Lambda as the primary design.

Explain:

• Lambda responsibility
• Lambda trigger configuration
• connection to SQS
• timeout configuration
• memory allocation considerations

Explain how the Lambda accesses S3.

Explain how failures are handled.

Also briefly describe an alternative design using a container worker.

---

## IAM SECURITY MODEL

Define the IAM role structure.

Explain the principle of least privilege.

Define roles for:

Lambda worker
Backend API
Terraform execution

Explain which permissions are required for each role.

Example:

Lambda needs:

• SQS receive/delete message
• S3 read/write image objects
• CloudWatch logs

Explain why broader permissions should be avoided.

---

## TERRAFORM PROJECT STRUCTURE

Define a clean Terraform project layout.

Example conceptual structure:

terraform/
modules/
s3/
sqs/
lambda/

environments/
dev/
prod/

main.tf
variables.tf
outputs.tf

Explain the purpose of each folder.

Explain why modules are useful even for a small system.

---

## ENVIRONMENT STRATEGY

Explain how environments should be organized.

Define at least:

dev
prod

Explain how variables differ between environments.

Explain naming conventions for resources across environments.

---

## STATE MANAGEMENT STRATEGY

Define how Terraform state should be managed.

Explain:

• remote state storage
• S3 backend usage
• DynamoDB locking

Explain why remote state is preferred.

---

## SECRET MANAGEMENT

Explain how secrets should be handled.

Possible approaches:

• environment variables
• AWS Secrets Manager
• parameter store

Explain why secrets should not be committed to Git.

---

## LOCAL DEVELOPMENT STRATEGY

Explain how the system could be run locally without real AWS infrastructure.

Example options:

• mocked services
• LocalStack
• in-memory job tracking
• local file storage instead of S3

Explain why local development flexibility is important.

---

## COST AWARENESS

Explain how this architecture minimizes AWS costs.

Discuss:

• S3 storage pricing
• Lambda pay-per-use
• SQS low cost
• lifecycle rules
• avoiding overprovisioned compute

Explain why this design is cost efficient for low-volume workloads.

---

## FAILURE HANDLING

Explain how infrastructure handles failures.

Examples:

• worker crashes
• SQS message retries
• image processing errors
• partial uploads

Explain how retries and dead-letter queues help with reliability.

---

## SCALING CHARACTERISTICS

Explain how the system scales.

Discuss:

• SQS scaling
• Lambda concurrency
• S3 scalability

Explain why this design is naturally scalable for asynchronous workloads.

---

## FUTURE IMPROVEMENTS

Explain possible infrastructure improvements with more engineering time.

Examples:

• CloudFront for image delivery
• event-driven notifications
• monitoring dashboards
• alarms for failed jobs
• image processing pipelines
• better observability

---

## IMPORTANT RULES

• Do not generate Terraform code
• This must be a specification document
• Use clear infrastructure language
• Keep the design simple and realistic
• Avoid unnecessary complexity
• Focus on good infrastructure hygiene
• Assume this document will be reviewed by experienced engineers


------------------------------------------------------

You are a senior software engineer and test architect designing the testing strategy for a take-home engineering assignment.

Do NOT generate test code.

Your task is to produce a detailed testing strategy specification document for the system described below.

Save the document as:

docs/testing_strategy.spec.md

--------------------------------------------------
PROJECT CONTEXT
--------------------------------------------------

We are building a take-home engineering assignment for an asynchronous pet image processing system.

System flow:

1. User uploads a pet image from the frontend
2. Backend accepts the upload
3. Backend stores the original image in S3
4. Backend creates a processing job
5. Backend publishes a message to a queue
6. A worker consumes the message
7. The worker processes the image
8. The processed image is stored in S3
9. The frontend polls for status and later displays the processed image

The system is intentionally small, but should be designed and tested in a realistic way.

--------------------------------------------------
TECH STACK
--------------------------------------------------

Frontend:
Next.js + React + TypeScript

Backend:
Node.js + Express

Async messaging:
AWS SQS

Storage:
AWS S3

Image processing:
Sharp

Infrastructure:
Terraform

Testing tools:
Jest
Supertest

--------------------------------------------------
TESTING GOALS
--------------------------------------------------

The purpose of the testing strategy is to demonstrate:

• engineering discipline
• good judgment about what to test
• clear separation between unit and integration testing
• confidence in core business logic
• realistic scope for a take-home assignment
• awareness of tradeoffs and limitations

The testing approach should be practical and intentionally scoped.
We do NOT need exhaustive enterprise-level test coverage.
We DO need thoughtful and credible coverage of the critical paths.

--------------------------------------------------
OUTPUT REQUIREMENTS
--------------------------------------------------

Write a detailed testing strategy document with the following sections.

1. Testing Philosophy

Explain the overall philosophy for testing this system.

The philosophy should prioritize:
• correctness of core async flow
• confidence in business logic
• validation of critical backend behavior
• avoiding over-testing trivial UI details
• balancing realism with take-home assignment time constraints

Explain why testing should focus on the most important risks in the system.

2. Testing Scope Overview

Describe what should be tested and what should not necessarily be tested.

Divide scope into:
• backend unit tests
• backend integration tests
• frontend behavioral tests (optional / limited)
• infrastructure validation strategy
• manual verification

Explain which layers are highest priority for confidence.

3. Risk-Based Testing Priorities

Identify the most important failure risks in the system.

Examples:
• invalid image upload
• upload request handling errors
• job creation failure
• queue publishing failure
• worker processing failure
• incorrect job status transitions
• missing processed image URL
• polling logic issues
• inconsistent frontend state after backend errors

Rank or group the major risks by importance.

Explain which tests provide the most confidence for these risks.

4. Backend Unit Testing Strategy

Define the backend unit testing plan in detail.

Explain which modules/services should be tested in isolation.

At minimum include conceptual unit tests for:

• file validation logic
• job creation logic
• job status transition logic
• S3 storage abstraction
• queue publishing abstraction
• result retrieval logic
• image processing service logic (where practical)
• error mapping / response formatting utilities

For each unit testing area, explain:
• what is being validated
• what dependencies should be mocked
• what success/failure cases matter most

5. Job Lifecycle Test Coverage

Define specific tests around job lifecycle behavior.

At minimum cover:
• new job starts as queued
• queued job transitions to processing
• processing job transitions to completed
• failed processing transitions to failed
• completed job exposes processed image reference
• invalid job ID returns appropriate not found behavior

Explain why state transition correctness is critical.

6. Upload Endpoint Testing Strategy

Define the test coverage for POST /upload.

Explain the expected test scenarios such as:
• accepts valid image upload
• rejects missing file
• rejects unsupported file type
• rejects oversized file
• returns jobId and queued status on success
• handles storage failure gracefully
• handles queue publish failure gracefully

Explain which parts of the upload flow should be mocked in unit-style tests vs exercised in integration-style tests.

7. Status Endpoint Testing Strategy

Define test coverage for GET /status/:jobId.

Cover scenarios such as:
• existing queued job
• existing processing job
• existing completed job
• existing failed job
• unknown job ID
• malformed job ID

Explain what the API contract should guarantee.

8. Result Endpoint Testing Strategy

Define test coverage for GET /result/:jobId.

Cover scenarios such as:
• completed job returns processed image URL
• non-completed job does not return result
• failed job returns appropriate error or status
• unknown job ID returns not found
• completed job missing image key is handled safely

Explain how the frontend depends on consistent endpoint behavior.

9. Queue and Worker Testing Strategy

Define how the queue and worker flow should be tested conceptually.

Explain the difference between:
• unit testing the queue service abstraction
• unit testing worker orchestration logic
• integration-style simulation of async processing

Cover scenarios such as:
• valid queue message is processed successfully
• invalid queue message is rejected
• image processing error marks job failed
• S3 read failure is handled
• S3 write failure is handled
• worker does not leave status inconsistent
• duplicate message handling considerations
• retry-safe behavior where applicable

Explain what can be realistically tested in a take-home challenge and what can be left as documented assumptions.

10. Integration Testing Strategy

Define at least one strong integration-style test plan.

This system must include at least one integration-style test.

Describe a realistic integration scenario such as:

• upload a valid image to the API
• verify job record is created
• verify queue publish was invoked or simulated
• verify status endpoint returns queued/processing
• optionally simulate worker completion
• verify completed result is returned

Explain what dependencies may still be mocked in integration tests and why.

Define what makes the test "integration-style" rather than a pure unit test.

11. Mocking Strategy

Define the mocking philosophy clearly.

Explain which dependencies should be mocked in most automated tests:

• AWS S3 SDK calls
• SQS SDK calls
• image processing side effects where necessary
• time-based polling behavior where needed

Explain which logic should not be mocked because it represents the core behavior under test.

Emphasize that mocking should isolate external systems, not hide business logic bugs.

12. Test Data Strategy

Define the strategy for test data and fixtures.

Explain:
• use of small sample image fixtures
• use of deterministic fake job IDs where useful
• stable mock responses
• avoiding large binary test assets unless necessary

Explain how to keep tests fast, readable, and deterministic.

13. Failure Case Coverage

Define the most important failure-path tests.

At minimum include:
• upload without file
• invalid mime type
• backend service throws unexpectedly
• S3 upload failure
• queue publish failure
• worker processing exception
• job status endpoint for nonexistent job
• result endpoint before completion
• transient polling/backend network failure handling conceptually

Explain why failure-path testing matters more than cosmetic UI testing in this assignment.

14. Frontend Testing Considerations

Define a lightweight frontend testing strategy.

This does NOT need extensive frontend coverage.

Explain what would be worth testing if time allows:
• upload button enabled/disabled behavior
• state transitions after successful upload
• polling starts after jobId is received
• completed state renders processed image
• failed state renders error messaging

Also explain what can reasonably be omitted in a time-boxed challenge:
• exhaustive snapshot tests
• heavy styling tests
• trivial presentational details

15. Infrastructure Testing / Validation Strategy

Explain how infrastructure should be validated even if not fully deployed.

Examples:
• terraform fmt
• terraform validate
• terraform plan
• static review of IAM policies
• manual review of least privilege assumptions

Explain why infrastructure correctness is partly validated by structure and reasoning in a take-home assignment.

16. Manual Test Plan

Define a short but professional manual QA checklist.

Include user-facing validation steps such as:
• upload a valid image
• see queued state
• see processing state
• see completed image
• simulate backend failure
• verify failed state is understandable
• retry flow works
• invalid file shows validation message

Explain why manual testing still matters in addition to automated tests.

17. Coverage Prioritization Under Time Constraints

Explain what should be implemented first if time is limited.

Recommended priority order:
1. backend unit tests for critical services
2. upload endpoint integration-style test
3. worker/job lifecycle tests
4. minimal frontend behavior tests
5. extra edge cases

Explain why this priority order is appropriate for the assignment.

18. What Intentionally Will Not Be Fully Tested

Be explicit about what may be intentionally left untested or lightly tested.

Examples:
• full end-to-end browser automation
• real AWS integration tests
• full visual regression tests
• load testing
• exhaustive frontend component testing

Explain why these are reasonable omissions in a take-home project.

19. Success Criteria

Define what “good enough” testing means for this assignment.

Examples:
• core backend paths are covered
• major failure paths are validated
• one meaningful integration-style test exists
• async job lifecycle behavior is tested
• documentation clearly explains remaining gaps

20. Future Testing Improvements

Explain what would be added with more time.

Examples:
• real LocalStack-based integration tests
• end-to-end browser tests
• worker contract tests
• retry/idempotency tests
• performance/load tests
• observability/assertion around logs and metrics

--------------------------------------------------
IMPORTANT RULES
--------------------------------------------------

• Do not generate code
• This must be a specification document only
• Use clear engineering language
• Be detailed and explicit
• Keep the scope realistic for a take-home assignment
• Prefer practical testing decisions over theoretical perfection
• Focus on confidence in the system’s critical behavior
• Assume the audience is a senior engineering reviewer

------------------------------------------------------

You are a senior software engineer planning the implementation of a take-home engineering assignment.

Do NOT generate implementation code.

Your task is to produce a structured implementation plan for building the system described in the existing specification documents.

Save the document as:

docs/implementation_plan.md

---

## PROJECT CONTEXT

We are implementing an asynchronous pet image processing system.

The system consists of:

Frontend (Next.js + React)
Backend API (Node.js + Express)
Async queue (AWS SQS)
Worker (Node.js worker or AWS Lambda)
Storage (AWS S3)
Infrastructure (Terraform)

The system allows users to upload pet images that are processed asynchronously.

---

## EXISTING SPECIFICATIONS

The implementation plan must assume the following specification documents already exist:

docs/system_architecture.spec.md
docs/backend_processing_pipeline.spec.md
docs/frontend_upload_flow.spec.md
docs/terraform_infrastructure.spec.md
docs/testing_strategy.spec.md

This document must explain how the system should be implemented step-by-step following those specs.

---

## IMPLEMENTATION GOAL

The goal is to build the system in a clear, disciplined, and review-friendly way.

The implementation should:

• follow a logical order
• avoid unnecessary refactoring
• keep commits clean and understandable
• allow easy verification by reviewers
• align with the architecture defined in the specs

The plan must assume the project is implemented inside a monorepo structure:

pet-image-processor/

frontend/
backend/
worker/
terraform/
docs/
tests/

---

## DOCUMENT STRUCTURE

The implementation plan must include the following sections.

1. Implementation Philosophy

Explain the guiding principles for implementing the system.

Focus on:

• clarity over cleverness
• incremental progress
• verifying each layer before moving on
• avoiding premature optimization
• keeping the code reviewer in mind

Explain why structured implementation matters in a take-home assignment.

2. High-Level Implementation Order

Define the correct high-level order for building the system.

Recommended order:

1. Backend foundation
2. Storage and queue abstractions
3. Upload endpoint
4. Worker processing pipeline
5. Status and result endpoints
6. Frontend upload flow
7. Terraform infrastructure
8. Automated tests
9. Documentation

Explain why this order minimizes risk and confusion.

3. Phase 1 – Repository Initialization

Describe the first phase of implementation.

Tasks include:

• initialize monorepo structure
• configure Node.js backend project
• configure Next.js frontend project
• configure worker project
• configure Terraform folder structure
• create base README

Explain the purpose of each folder.

Define the expected repository structure after Phase 1.

4. Phase 2 – Backend Core Architecture

Define the tasks for building the backend core.

This includes:

• Express server setup
• route structure
• controller layer
• service layer
• job model abstraction
• basic logging

Explain the separation of responsibilities between controllers and services.

Explain why the backend core should be built before implementing endpoints.

5. Phase 3 – Storage and Queue Integration

Define how S3 and SQS integration should be implemented.

Tasks include:

• create storage service abstraction
• create queue publishing abstraction
• define job creation logic
• define job status storage strategy

Explain why AWS interactions should be abstracted behind service layers.

Explain how this improves testability.

6. Phase 4 – Upload Endpoint Implementation

Define the implementation of POST /upload.

Tasks include:

• file upload handling
• validation logic
• job ID generation
• original image upload to storage
• job record creation
• queue message publishing

Explain the expected flow for the upload endpoint.

Define key validation and error-handling rules.

7. Phase 5 – Worker Processing Pipeline

Define the worker implementation.

Tasks include:

• queue polling
• message parsing
• downloading original image
• image processing using Sharp
• uploading processed image
• updating job status

Explain how worker failures should be handled.

Explain how job status transitions should occur.

8. Phase 6 – Status and Result Endpoints

Define the implementation of:

GET /status/:jobId
GET /result/:jobId

Explain the logic for each endpoint.

Define expected response structures.

Explain how job lookup should behave for:

• queued jobs
• processing jobs
• completed jobs
• failed jobs
• unknown job IDs

9. Phase 7 – Frontend Upload Flow

Define how the frontend should be implemented.

Tasks include:

• file selection UI
• upload request integration
• preview of selected image
• jobId storage in state
• polling status endpoint
• displaying processed result

Explain the recommended component structure.

Explain the polling strategy.

10. Phase 8 – Terraform Infrastructure

Define the tasks for creating Terraform infrastructure.

Tasks include:

• define S3 bucket module
• define SQS queue module
• define Lambda worker module
• define IAM roles
• define environment structure

Explain how Terraform should be organized.

Explain how infrastructure configuration should remain readable.

11. Phase 9 – Automated Testing

Define the testing tasks.

Tasks include:

• backend unit tests
• upload endpoint integration test
• job lifecycle tests
• queue abstraction tests

Explain what should be mocked.

Explain which tests provide the most confidence.

12. Phase 10 – Documentation

Define final documentation tasks.

Documents should include:

README.md
AI_USAGE.md

Explain what should be included in each.

README.md must describe:

• architecture overview
• system flow
• setup instructions
• tradeoffs
• scaling considerations

AI_USAGE.md must describe:

• how AI tools were used
• prompts used at a high level
• where AI output was incorrect
• what was rewritten manually
• how correctness was verified

13. Suggested Git Commit Strategy

Define a clean commit history strategy.

Provide example commit sequence such as:

initial monorepo structure
setup backend server
add storage service abstraction
add queue publishing service
implement upload endpoint
implement worker processing pipeline
add status and result endpoints
implement frontend upload flow
add terraform infrastructure structure
add backend tests
finalize documentation

Explain why clear commit history improves reviewer confidence.

14. Verification Checklist

Define a checklist to confirm the system works end-to-end.

Example checks:

• image upload works
• jobId returned
• queue message created
• worker processes image
• processed image stored
• status endpoint updates correctly
• frontend shows completed result

Explain why end-to-end verification is important before submission.

15. Time Management Strategy

Explain how a candidate should approach this assignment under time constraints.

Suggested allocation:

• architecture planning
• backend implementation
• worker implementation
• frontend integration
• testing
• documentation

Explain how to prioritize the most important parts if time becomes limited.

16. Future Improvements

Explain what could be improved with more engineering time.

Examples:

• event-driven frontend updates
• job persistence database
• better retry handling
• CloudFront image delivery
• observability and metrics
• more robust worker orchestration

---

## IMPORTANT RULES

• Do not generate implementation code
• This must be a planning document only
• Use clear engineering language
• Be structured and precise
• Focus on implementation order and discipline
• Assume the audience is a senior engineering reviewer
------------------------------------------------------

You are implementing the backend foundation for the project described in the specification documents.

Follow the architecture defined in:

docs/system_architecture.spec.md
docs/backend_processing_pipeline.spec.md
docs/testing_strategy.spec.md
docs/implementation_plan.md

Do NOT implement business logic yet.

Your goal is to implement **Phase 2 – Backend Core Architecture** from the implementation plan.

---

## PROJECT STRUCTURE

Work inside the monorepo backend folder:

backend/

Create the following structure:

backend/
src/
controllers/
routes/
services/
queue/
storage/
jobs/
utils/
config/

server.ts
app.ts

tests/

---

## TECH STACK

Node.js
Express
TypeScript

Dependencies expected:

express
cors
dotenv
uuid

Dev dependencies:

typescript
ts-node
nodemon
jest
supertest

---

## OBJECTIVE

Create the foundational backend architecture including:

• Express application setup
• route registration
• controller structure
• service structure
• job abstraction
• configuration handling
• logging utilities
• health check endpoint

Do NOT implement S3 logic yet.
Do NOT implement queue logic yet.
Do NOT implement upload endpoint yet.

Only create the architecture skeleton.

---

## SERVER SETUP

Create:

server.ts

Responsibilities:

• load environment variables
• initialize Express app
• start server
• listen on configured port

Create:

app.ts

Responsibilities:

• configure middleware
• register routes
• configure error handling middleware

---

## MIDDLEWARE

Configure:

• JSON parsing
• CORS
• basic request logging middleware

Logging should be simple console-based for now.

---

## ROUTE STRUCTURE

Create route modules.

Example structure:

routes/
health.routes.ts
upload.routes.ts
job.routes.ts

Register them in app.ts.

Only implement the health endpoint for now.

Endpoint:

GET /health

Response:

{
status: "ok"
}

---

## CONTROLLER STRUCTURE

Create controllers but do not implement logic yet.

controllers/

upload.controller.ts
job.controller.ts

Each controller should export functions that will be used by routes later.

Example placeholder functions:

handleUpload
getJobStatus
getJobResult

Leave TODO comments indicating where logic will be implemented later.

---

## SERVICE LAYER

Create service modules.

services/

job.service.ts
image-processing.service.ts

These should contain placeholder methods for:

createJob
updateJobStatus
getJob
processImage

Do NOT implement processing logic yet.

---

## JOB MODEL

Create a simple job model abstraction.

jobs/

job.types.ts
job.store.ts

The store should initially be an **in-memory store** implemented as a Map.

This will simulate job persistence for the challenge.

Define job states:

queued
processing
completed
failed

---

## STORAGE ABSTRACTION

Create storage abstraction but do not implement S3 yet.

storage/

storage.service.ts

Define placeholder methods:

uploadOriginalImage
uploadProcessedImage
getImageUrl

Leave TODO markers indicating S3 integration will come later.

---

## QUEUE ABSTRACTION

Create queue abstraction without implementing AWS.

queue/

queue.service.ts

Define placeholder method:

publishImageProcessingJob(jobId, imageKey)

Leave TODO comments for SQS integration later.

---

## CONFIGURATION

Create configuration module:

config/

env.ts

Load environment variables such as:

PORT
AWS_REGION
S3_BUCKET_NAME
SQS_QUEUE_URL

Provide default fallback values for local development.

---

## UTILITIES

Create utility modules:

utils/

logger.ts
errors.ts

Logger should provide simple functions:

info()
error()

---

## ERROR HANDLING

Add global Express error middleware.

Handle:

• validation errors
• unexpected server errors

Return consistent JSON responses.

---

## TESTING SETUP

Prepare the testing structure but do not implement tests yet.

tests/

Create placeholder test files:

health.test.ts
upload.test.ts
job.test.ts

Configure Jest configuration if necessary.

---

## OUTPUT REQUIREMENTS

The result should be a clean backend skeleton ready for feature implementation.

The backend must:

• compile successfully
• start with npm run dev
• expose GET /health
• follow the defined folder structure
• include TODO markers for future implementation

---

## IMPORTANT RULES

• Do not implement S3 integration yet
• Do not implement SQS integration yet
• Do not implement image processing yet
• Only build the backend foundation
• Keep the architecture clean and readable
• Follow TypeScript best practices
• Prefer small files with clear responsibilities


------------------------------------------------------

You are a senior Node.js backend engineer.

You are implementing the backend foundation for the system described in the specification documents.

Follow the architecture described in:

docs/system_architecture.spec.md
docs/backend_processing_pipeline.spec.md
docs/implementation_plan.md

Specifically implement **Phase 2 – Backend Core Architecture**.

IMPORTANT:
Do NOT implement the upload endpoint yet.
Do NOT implement queue publishing yet.
Do NOT implement worker logic yet.

Your goal is to create the **backend project foundation and architecture** only.

---

PROJECT STRUCTURE

The backend lives in:

backend/

Create the following structure:

backend/
src/
server.ts

routes/
controllers/
services/
queue/
storage/
jobs/
utils/

config/

tests/

---

TECH STACK

Node.js
Express
TypeScript

Dependencies to install:

express
cors
dotenv
uuid

Dev dependencies:

typescript
ts-node
nodemon
jest
supertest
@types/jest
@types/express
@types/node

---

SERVER SETUP

Implement a clean Express server setup in:

src/server.ts

Requirements:

• load environment variables
• configure JSON middleware
• configure CORS
• register routes
• start server on PORT

Use a clean modular structure.

---

ROUTES LAYER

Create route modules.

For now create:

routes/upload.routes.ts
routes/status.routes.ts

Even if endpoints are not implemented yet, define the route structure.

Example:

POST /upload
GET /status/:jobId
GET /result/:jobId

Routes should delegate to controllers.

---

CONTROLLERS LAYER

Create controllers but leave business logic minimal.

controllers/upload.controller.ts
controllers/status.controller.ts

Controllers should:

• receive request
• call service layer
• return response
• handle errors

Do NOT implement full logic yet.

---

SERVICES LAYER

Create empty service scaffolding.

services/job.service.ts
services/storage.service.ts
services/queue.service.ts

These services will later handle:

job lifecycle
S3 interaction
SQS interaction

For now define method signatures only.

---

JOB MODEL

Create a job abstraction:

jobs/job.types.ts

Define:

JobStatus

queued
processing
completed
failed

Define Job interface.

---

CONFIGURATION

Create a configuration loader:

config/env.ts

This module should:

• read environment variables
• validate required variables
• export typed configuration

---

UTILITIES

Create utility modules.

utils/logger.ts

Provide a simple structured logger wrapper.

---

ENVIRONMENT FILES

Generate:

.env.example

Include the following variables:

PORT
NODE_ENV

AWS_REGION
AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY

S3_BUCKET_NAME
S3_ORIGINAL_PREFIX
S3_PROCESSED_PREFIX

SQS_QUEUE_URL

MAX_FILE_SIZE_MB
WORKER_POLL_INTERVAL_MS
JOB_STATUS_TTL_MINUTES

Also add `.env` to `.gitignore`.

---

PACKAGE.JSON SCRIPTS

Add scripts:

dev
build
start
test

Example intention:

dev → run with nodemon
build → compile TypeScript
start → run compiled code
test → run jest

---

TESTING SETUP

Configure Jest but do NOT write tests yet.

Create:

tests/setup.ts

Ensure Supertest can be used later.

---

OUTPUT REQUIREMENTS

Generate all files necessary for this foundation.

Focus on:

• clean architecture
• good TypeScript types
• separation of concerns
• readable folder structure
• maintainable code

Do NOT implement business logic yet.
This step is only the backend skeleton.

Make sure the server can start successfully.


------------------------------------------------------