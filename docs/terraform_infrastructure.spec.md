# Pet Image Processor — Terraform Infrastructure Specification

**Document version:** 1.0  
**Audience:** Senior engineers, DevOps reviewers  
**Scope:** Infrastructure design, Terraform layout, AWS resources, and operational practices. No Terraform code.

---

## 1. Infrastructure Overview

### 1.1 Goal

The infrastructure provisions the AWS resources required for the asynchronous pet image processing system: S3 for image storage, SQS for the job queue, Lambda as the worker, and IAM roles for secure access. The Terraform configuration should be **simple, realistic, secure, cost-conscious, and production-inspired** without overengineering. It does not need to be deployed for the assignment but must be **runnable and reviewable**.

### 1.2 Design Principles

- **Simplicity:** Minimal resources; one bucket (or two), one queue, one Lambda, clear IAM boundaries.
- **Realistic:** Uses real AWS APIs and patterns (S3, SQS, Lambda event source mapping, IAM) so that `terraform plan` and `terraform apply` are meaningful.
- **Secure:** Least-privilege IAM; no public S3 read; secrets outside code.
- **Cost-conscious:** Pay-per-use (Lambda, SQS); lifecycle rules where appropriate; no always-on EC2 for the worker.
- **Production-inspired:** Remote state, modules, environment separation so the structure would scale to real deployments.

---

## 2. Main Infrastructure Components

### 2.1 Resource Summary

| Resource | Responsibility |
| -------- | ---------------- |
| **S3 bucket(s)** | Store original uploads and processed images. Optionally one bucket with two prefixes or two buckets. Block public access; access via IAM and pre-signed URLs. |
| **SQS queue** | Receive job messages from the Backend API; trigger or feed the worker. Standard queue; optional DLQ for failed messages. |
| **Lambda function** | Worker: invoked by SQS, reads original from S3, processes image, writes result to S3, updates job status. No HTTP server. |
| **IAM roles and policies** | Lambda execution role (SQS, S3, CloudWatch Logs); Backend API role (S3, SQS) if API runs on AWS; optional Terraform execution role. Least privilege per service. |
| **Environment configuration** | Variables for bucket names, queue URL, region, and (outside Terraform) any secrets. Differ by environment (e.g. dev, prod). |

### 2.2 What Terraform Does Not Provision

- **Frontend (Next.js):** Typically deployed separately (Vercel, S3/CloudFront, or other). Not in scope for this Terraform spec.
- **Backend API (Express):** May run on EC2, ECS, or elsewhere; Terraform may output queue URL and bucket names for the API to use. The API’s runtime is not necessarily defined in the same Terraform project.
- **Job store:** Backend API job persistence (in-memory, file, or DB) is application concern; not an AWS resource in this spec.

---

## 3. S3 Storage Design

### 3.1 Bucket Naming Strategy

- Use a naming scheme that avoids collisions and identifies purpose and environment (e.g. `pet-image-processor-{env}-{account-id}` or `{project}-{env}-images`). Bucket names must be globally unique. Terraform variable for `env` (e.g. dev, prod) and optional prefix.
- If two buckets: one for originals, one for processed (e.g. `...-originals`, `...-processed`). If one bucket: single bucket with two prefixes.

### 3.2 Directory Structure

- **Single-bucket option:** Two top-level prefixes:
  - `original-images/` — Keys e.g. `original-images/{jobId}.jpg`. Written by Backend API on upload.
  - `processed-images/` — Keys e.g. `processed-images/{jobId}.jpg`. Written by Lambda after processing.
- **Two-bucket option:** One bucket per prefix above; same key layout inside each bucket (e.g. `{jobId}.jpg` at root of each bucket).
- Naming convention: `{jobId}` plus extension (e.g. from original or fixed .jpg) so that the worker and API can derive keys without listing.

### 3.3 Original vs Processed Storage

- **Originals:** Written by Backend API only. Lambda reads from here. Retention can be aligned with business needs (e.g. keep for 30 days, then lifecycle to Glacier or delete).
- **Processed:** Written by Lambda only. Backend API generates pre-signed URLs for the frontend. Same retention or lifecycle as originals if desired.

### 3.4 Lifecycle Rules (Cost Reduction)

- **Transition:** After a defined period (e.g. 30 or 90 days), move objects to S3 Glacier or Glacier Deep Archive to reduce standard storage cost. Apply to both prefixes (or both buckets) if long-term retention is required.
- **Expiration:** Optionally expire objects after a longer period (e.g. 1 year) to avoid unbounded growth. Useful for a take-home or low-volume production.
- Lifecycle rules are defined on the bucket; filters can target `original-images/` and `processed-images/` (or equivalent) separately if needed.

### 3.5 Public vs Private Access

- **Private:** Bucket and objects are not public. Block all public access (bucket setting). No bucket policy granting `s3:GetObject` to `*` or anonymous principals.
- **Access model:** Backend API and Lambda use IAM roles. Frontend receives **pre-signed URLs** generated by the Backend API (using the API’s IAM permissions) with a short TTL (e.g. 60–300 seconds). No public read required.

### 3.6 Image URL Generation

- **Processed image URL:** Backend API (running with an IAM role that has `s3:GetObject` on the processed prefix) calls the S3 API to generate a pre-signed GET URL for the processed object key. That URL is returned in GET /result/:jobId. Frontend uses it to display the image. URLs are ephemeral and do not expose credentials.

---

## 4. SQS Queue Design

### 4.1 Queue Purpose

- Decouple Backend API from the worker. API sends one message per job after uploading the original to S3; Lambda (or another consumer) processes messages asynchronously. Standard queue is sufficient (no FIFO requirement for this assignment).

### 4.2 Message Structure

- **Body (JSON):** At least `jobId` (string) and `imageKey` (string, S3 key of the original image). Optional: bucket name if using two buckets. Lambda parses the body to know which object to read and which job to update.

### 4.3 Visibility Timeout

- Set to a value greater than the expected processing time (e.g. 60–120 seconds). If Lambda does not delete the message before the timeout, SQS makes the message visible again for another consumer. Prevents message loss if Lambda fails mid-processing; may cause duplicate processing if Lambda succeeds but does not delete in time—design for idempotent processing (same jobId overwrites same processed key).

### 4.4 Retry Behavior

- **No redrive policy:** Messages that fail processing (Lambda returns failure or throws) become visible again after visibility timeout. Lambda can be configured to retry (e.g. on partial failure). After several failed receives, consider moving to a DLQ (see below).
- **With DLQ:** Configure a dead-letter queue and set `maxReceiveCount` (e.g. 3). After that many failed processing attempts, SQS moves the message to the DLQ. Prevents poison messages from blocking the main queue. Terraform can create the DLQ and attach the redrive policy to the main queue.

### 4.5 Dead-Letter Queue (DLQ) Considerations

- **Purpose:** Capture messages that could not be processed after N attempts for inspection, alerting, or manual replay.
- **Implementation:** Separate SQS queue (e.g. `...-dlq`). Main queue’s redrive policy points to this DLQ and sets `maxReceiveCount`. Lambda does not need permission to consume from the DLQ for normal operation; operators may use AWS Console or scripts to replay.
- **Optional for assignment:** DLQ is recommended for production-inspired design but can be omitted if scope is minimal; document the choice.

### 4.6 How the Worker Consumes Messages

- **Lambda:** SQS event source mapping links the queue to the Lambda. Lambda is invoked per batch of messages (e.g. 1–10). Lambda processes each message (download from S3, process, upload, update job, delete message). On success, Lambda returns success and SQS deletes the message. On failure or exception, Lambda does not delete; message becomes visible again after visibility timeout (or goes to DLQ after maxReceiveCount).

---

## 5. Worker Compute Design

### 5.1 Lambda as Primary Design

- **Responsibility:** Consume SQS messages, download original image from S3, apply image processing (e.g. Sharp: grayscale, resize, crop), upload processed image to S3, update job status (via backend API or shared store). Then let SQS delete the message on success.

### 5.2 Lambda Trigger Configuration

- **Event source mapping:** Terraform creates an `aws_lambda_event_source_mapping` (or equivalent) from the SQS queue to the Lambda function. Batch size 1 (or small, e.g. 5) to simplify error handling and avoid long runs. Lambda is invoked automatically when messages are available.

### 5.3 Connection to SQS

- Lambda needs permission to be invoked by SQS (resource-based policy on Lambda: `sqs:SendMessage` from the queue’s ARN). Lambda needs permission to receive and delete messages from the queue (IAM: `sqs:ReceiveMessage`, `sqs:DeleteMessage`, `sqs:GetQueueAttributes` on the queue). Terraform configures both.

### 5.4 Timeout Configuration

- Set Lambda timeout to at least the visibility timeout of the queue (or slightly less) so that if Lambda runs long, the message is not redelivered while Lambda is still running. Typical: 30–60 seconds for small images; increase if processing is heavier.

### 5.5 Memory Allocation

- Image processing (e.g. Sharp) is memory-bound. Allocate enough memory (e.g. 512 MB–1 GB) so that runs complete quickly and do not hit memory limits. Higher memory also increases CPU share; tune for cost vs latency.

### 5.6 Lambda Access to S3

- Lambda execution role includes an IAM policy granting `s3:GetObject` on the originals bucket/prefix and `s3:PutObject` (and optionally `s3:DeleteObject`) on the processed bucket/prefix. No public access; all via IAM.

### 5.7 Failure Handling

- **Processing error:** Lambda throws or returns an error; SQS does not delete the message; after visibility timeout the message is visible again (or sent to DLQ after maxReceiveCount). Lambda should set job status to `failed` (e.g. via Backend API or shared store) so the frontend can show failure.
- **Partial failure in batch:** If batch size > 1, use partial batch response (Lambda returns which message IDs failed) so only failed messages are retried. With batch size 1, success/failure is per message.

### 5.8 Alternative: Container Worker

- **Design:** Run a long-running process (e.g. Node.js) on EC2 or ECS that polls SQS in a loop, processes messages, and updates S3 and job status. No Lambda event source mapping; worker pulls messages.
- **Tradeoffs:** More control over runtime and dependencies; requires managing compute (EC2/ECS), scaling, and deployment. Higher baseline cost if always on. Prefer Lambda for the assignment for simplicity and pay-per-use; document container option as an alternative for environments that require it.

---

## 6. IAM Security Model

### 6.1 Principle of Least Privilege

- Each identity (Lambda role, Backend API role, Terraform role) receives only the permissions required for its actions. No wildcard `*` on resources where a specific ARN or prefix can be used. Reduces blast radius of compromised credentials or misconfiguration.

### 6.2 Lambda Worker Role

- **Needs:**
  - **SQS:** `sqs:ReceiveMessage`, `sqs:DeleteMessage`, `sqs:GetQueueAttributes` on the main queue. Optional: same on DLQ if Lambda is used to drain or replay.
  - **S3:** `s3:GetObject` on originals bucket/prefix; `s3:PutObject` on processed bucket/prefix. Restrict to the specific bucket(s) and prefix pattern.
  - **CloudWatch Logs:** `logs:CreateLogGroup`, `logs:CreateLogStream`, `logs:PutLogEvents` for the Lambda’s log group.
- **Does not need:** S3 DeleteObject unless explicitly required; other queues; other services.

### 6.3 Backend API Role

- If the Backend API runs on AWS (e.g. EC2, ECS, Lambda), it needs:
  - **S3:** `s3:PutObject` on originals bucket/prefix; `s3:GetObject` on processed bucket/prefix (for pre-signed URL generation). Restrict to the bucket(s) used by the app.
  - **SQS:** `sqs:SendMessage` on the main queue.
- **Does not need:** Receive or delete from SQS; DeleteObject unless required; other buckets.

### 6.4 Terraform Execution Role

- The identity that runs `terraform plan` and `terraform apply` (e.g. CI role or developer role) needs permissions to create, update, delete the resources defined in the configuration: S3, SQS, Lambda, IAM roles and policies, event source mappings, etc. Prefer a dedicated role with a narrow policy (e.g. list of allowed resource types and optional resource ARN constraints) over broad AdministratorAccess. State bucket and DynamoDB table for locking require their own permissions (see State Management).

### 6.5 Why Avoid Broad Permissions

- Broad policies (e.g. `s3:*`, `sqs:*` on `*`) increase the impact of a mistake or compromise. Tight resource and action scoping limits damage and makes audits and compliance easier. For a take-home, demonstrating scoped policies is more important than convenience.

---

## 7. Terraform Project Structure

### 7.1 Conceptual Layout

- **terraform/** — Root of the Terraform project.
  - **modules/** — Reusable modules.
    - **s3/** — S3 bucket(s), lifecycle rules, block public access, optional bucket policy.
    - **sqs/** — Main queue, optional DLQ, redrive policy.
    - **lambda/** — Lambda function (zip or image), execution role, CloudWatch log group, SQS event source mapping, IAM policies.
  - **environments/** — Environment-specific entrypoints and variable values.
    - **dev/** — `terraform.tfvars` (or similar) for dev (e.g. bucket suffix, queue name prefix).
    - **prod/** — Same for prod; different naming and possibly stricter settings.
  - **main.tf** — Root module: calls modules (s3, sqs, lambda), passes variables. May live at root or inside each environment.
  - **variables.tf** — Variable declarations (region, env, project name, etc.).
  - **outputs.tf** — Outputs (bucket name(s), queue URL, Lambda ARN) for use by Backend API or CI.

### 7.2 Purpose of Each Folder

- **modules/s3, sqs, lambda:** Encapsulate one resource group; accept inputs (e.g. bucket name, queue name, Lambda config) and expose outputs. Keeps root or environment configs readable and allows reuse (e.g. second environment reuses same modules with different vars).
- **environments/dev, prod:** Isolate environment-specific values (names, tags, optional feature flags) so that `terraform apply` in dev does not affect prod. Each environment may have its own state (see State Management).

### 7.3 Why Modules for a Small System

- **Clarity:** Each module has a single responsibility; reviewers can read s3, sqs, or lambda in isolation.
- **Reuse:** Adding staging or another env is mostly new variable values and state, not copy-pasted resource blocks.
- **Testing:** Modules can be tested or composed in different ways. Encourages good habits even when the system is small.

---

## 8. Environment Strategy

### 8.1 Environments

- **dev:** Non-production; used for integration and assignment validation. Lower retention or no lifecycle rules if desired. Naming includes `dev`.
- **prod:** Production-like; lifecycle rules, DLQ, and naming consistent with production standards. Naming includes `prod`.

### 8.2 How Variables Differ

- **Naming:** `env` variable (dev vs prod) drives bucket name, queue name, and Lambda function name (e.g. `pet-image-processor-dev`, `pet-image-processor-prod`).
- **Optional:** Stricter timeouts or smaller batch size in prod; enable DLQ and lifecycle in prod only if desired.
- **Tags:** Different tags per environment (e.g. `Environment = dev` vs `prod`) for cost and ops.

### 8.3 Naming Conventions for Resources

- **Pattern:** `{project}-{env}-{resource-type}` or `{project}-{resource-type}-{env}` (e.g. `pet-image-processor-dev-originals`, `pet-image-processor-dev-queue`). Consistent prefix makes it easy to identify environment and purpose in the console and billing.

---

## 9. State Management Strategy

### 9.1 Remote State Storage

- **Preferred:** Terraform state is stored in a **remote backend** (e.g. S3) so that multiple runs (e.g. from different machines or CI) use the same state file. Avoids local state files that are lost or not shared.

### 9.2 S3 Backend Usage

- Configure a backend block (e.g. `backend "s3"`) with bucket, key (e.g. `terraform/{env}/terraform.tfstate`), and region. The bucket should exist before use (bootstrap with a one-time local apply or a separate bootstrap config). Enable versioning on the state bucket so that state history can be recovered.

### 9.3 DynamoDB Locking

- Use a DynamoDB table for state **locking**. Backend config points to the table; Terraform acquires a lock (e.g. by state file key) during apply so that two applies do not run concurrently and corrupt state. Prevents race conditions in CI or team use.

### 9.4 Why Remote State is Preferred

- **Collaboration:** Team or CI uses the same state; no manual state handoff.
- **Safety:** Versioned and locked state reduces risk of loss or corruption.
- **Consistency:** Single source of truth for what is deployed. For the assignment, documenting remote state and locking shows production-minded practice even if the actual backend is local for simplicity.

---

## 10. Secret Management

### 10.1 Approaches

- **Environment variables:** Backend API and Lambda receive config at runtime (e.g. queue URL, bucket names) via environment variables. Secrets (e.g. API keys, DB credentials) can be injected the same way in deployment (CI, Elastic Beanstalk, Lambda env config). Not stored in Terraform.
- **AWS Secrets Manager:** Store secrets (e.g. DB password) in Secrets Manager; Lambda or Backend API retrieves them at runtime using IAM. Terraform can create the secret resource and grant IAM read access; the secret value is written once outside Terraform or via a separate process.
- **Parameter Store (SSM):** Simpler key-value or secure string parameters. Lambda or API can read with IAM. Terraform can create parameters and grant access; sensitive values are not in code.

### 10.2 Why Secrets Must Not Be in Git

- Terraform files and tfvars in Git are often readable by many people and systems. Putting secrets in them risks exposure. Use variables or external data sources that resolve at apply/run time, or store secrets in a vault (Secrets Manager, Parameter Store) and reference them by name or ARN in Terraform. For the assignment, document that sensitive values are not committed and how they are provided (env, Parameter Store, or Secrets Manager).

---

## 11. Local Development Strategy

### 11.1 Options

- **Mocked services:** Backend API and worker use in-memory or file-based mocks for S3 and SQS (e.g. no AWS calls). Fast and offline; good for unit tests and simple runs.
- **LocalStack:** Run S3 and SQS (and optionally Lambda) locally via LocalStack; point Backend API and worker at local endpoints. Closer to real AWS behavior without cost; useful for integration tests.
- **In-memory job tracking:** Job store is in-memory or SQLite; no DynamoDB or RDS. Aligns with backend spec; keeps local setup simple.
- **Local file storage:** Replace S3 with local directory (e.g. `./uploads/originals`, `./uploads/processed`). Worker reads/writes files; API serves or generates file URLs. No S3 dependency locally.

### 11.2 Why Local Development Flexibility Matters

- Developers can run and debug the full flow without AWS accounts or network. Speeds iteration and allows the assignment to be run and reviewed without live infrastructure. Document which mode (mocks vs LocalStack vs local files) is supported and how to switch (env vars or config).

---

## 12. Cost Awareness

### 12.1 S3 Storage Pricing

- Pay for storage and requests. Lifecycle rules (transition to Glacier, expiration) reduce long-term storage cost. For low volume, cost is minimal; lifecycle keeps it bounded as data grows.

### 12.2 Lambda Pay-per-Use

- No charge when no requests; pay per invocation and compute time. For sporadic uploads, cost scales with usage. Prefer Lambda over always-on EC2 for the worker.

### 12.3 SQS Low Cost

- First 1M requests per month are free tier; then low per-request cost. Standard queue is cheap for moderate throughput.

### 12.4 Lifecycle Rules

- Moving old objects to Glacier or expiring them avoids unbounded standard storage cost. Important if retention is long or volume grows.

### 12.5 Avoiding Overprovisioned Compute

- No idle EC2 for the worker; Lambda scales to zero. Backend API may run on a small instance or serverless depending on scope; Terraform does not need to oversize.

### 12.6 Why This Design is Cost-Efficient for Low Volume

- No fixed compute for the async worker; S3 and SQS scale with usage; lifecycle controls storage cost. Suitable for a take-home or low-traffic production.

---

## 13. Failure Handling

### 13.1 Worker Crashes

- If Lambda fails or times out, the SQS message is not deleted. After visibility timeout, the message becomes visible again and Lambda (or another instance) can retry. Processing should be idempotent (same jobId produces same result) so retries are safe.

### 13.2 SQS Message Retries

- Visibility timeout and (optionally) maxReceiveCount plus DLQ provide retries without losing messages. Poison messages eventually move to DLQ for inspection.

### 13.3 Image Processing Errors

- Lambda sets job status to `failed` (via API or store) and does not delete the message (or does after recording failure). Message may retry or go to DLQ; application logic decides whether to retry the same job.

### 13.4 Partial Uploads

- If Backend API fails after S3 upload but before SQS send, the object remains in S3. Optional: lifecycle rule or cleanup job to remove orphaned originals after a period. Not required for minimal assignment.

### 13.5 How Retries and DLQ Help Reliability

- Retries absorb transient failures (network, throttling). DLQ isolates permanently failing messages so the main queue keeps processing and operators can fix or discard bad messages.

---

## 14. Scaling Characteristics

### 14.1 SQS Scaling

- SQS is managed and scales with message volume. No capacity planning for the queue itself. Throughput is sufficient for typical assignment or low-volume production.

### 14.2 Lambda Concurrency

- Lambda scales with the number of concurrent executions (subject to account/region limits). SQS event source mapping controls how many messages are in flight. For bursty uploads, Lambda scales up and down automatically.

### 14.3 S3 Scalability

- S3 scales with request and storage volume. No need to provision capacity. Pre-signed URLs and IAM avoid the API as a bottleneck for image delivery.

### 14.4 Why This Design Scales for Async Workloads

- Queue absorbs spikes; Lambda and S3 scale with load. No single bottleneck. Backend API can be scaled independently (e.g. more instances) if request rate grows.

---

## 15. Future Improvements

With more time, the following would strengthen the infrastructure:

- **CloudFront:** Put a CDN in front of processed image delivery (origin = S3 or API). Lower latency and reduced load on S3/API.
- **Event-driven notifications:** SNS or EventBridge when a job completes, so the frontend can subscribe instead of polling (or for downstream systems).
- **Monitoring dashboards:** CloudWatch (or similar) dashboards for queue depth, Lambda errors, S3 request counts. Improves operability.
- **Alarms for failed jobs:** CloudWatch alarm on DLQ message count or Lambda error rate; SNS email or PagerDuty for on-call.
- **Image processing pipelines:** More steps (e.g. thumbnail, multiple formats) with separate queues or steps. Out of scope for minimal assignment.
- **Observability:** Structured logging, tracing (e.g. X-Ray), and correlation IDs across API, queue, and Lambda for debugging.

---

## 16. Summary

The Terraform configuration provisions **S3** (originals and processed, private, optional lifecycle), **SQS** (main queue, optional DLQ, visibility and redrive), **Lambda** (worker with SQS trigger, S3 and SQS permissions, CloudWatch Logs), and **IAM roles** (Lambda, Backend API, Terraform) with least privilege. Project structure uses **modules** (s3, sqs, lambda) and **environments** (dev, prod) with clear naming and variables. **State** is remote (S3) with locking (DynamoDB). **Secrets** are not in Git; they are supplied via environment, Parameter Store, or Secrets Manager. **Local development** can use mocks, LocalStack, or local file storage. The design is **cost-conscious** (pay-per-use, lifecycle) and **resilient** (retries, DLQ). It is **scalable** for async workloads and leaves room for **future improvements** (CloudFront, monitoring, alarms).
