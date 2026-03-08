# Pet Image Processor — Frontend Upload Flow Specification

**Document version:** 1.0  
**Audience:** Senior engineers, frontend implementers  
**Scope:** Frontend UX, state, API integration, polling, components, and testing. No implementation code.

---

## 1. Frontend Overview

### 1.1 Goal

The frontend is the single user-facing entry point for the asynchronous pet image processing system. Its goal is to provide a **clear, deterministic, and reviewable** flow: the user selects an image, uploads it, sees that the upload was accepted, watches processing status update via polling, and sees the processed image when the job completes. Failures and retries should be obvious and actionable.

### 1.2 Intended User Experience

- **Clarity:** At every step the user understands what is happening (e.g. "Upload accepted", "Processing…", "Complete").
- **Correctness:** State and API calls are consistent; no duplicate uploads or polling loops; errors map to clear UI messages.
- **Clean state handling:** One source of truth for job state; transitions are explicit and easy to reason about in code review.

Visual polish is secondary. The UI should be simple, professional, and easy to navigate—not a showcase for design systems or animations.

---

## 2. Page Structure

### 2.1 Single Primary Page

The frontend consists of **one main page** (e.g. the root route in App Router). No dashboard, no auth, no multi-page flow.

### 2.2 Layout and Block Order

Content is laid out in a **single-column, top-to-bottom** flow. The order of major blocks is:

1. **Header / title area**
2. **Upload panel**
3. **Original image preview**
4. **Processing status panel**
5. **Processed image result panel**
6. **Error / retry area**

Sections 2–6 can be visible at once; visibility and content depend on state (e.g. status panel only meaningful after upload; result panel only when completed; error area only when there is an error).

### 2.3 Major UI Blocks

| Block | Description |
| ----- | ----------- |
| **Header / title area** | Page title (e.g. "Pet Image Processor") and a short description (e.g. "Upload a pet photo to process it asynchronously."). Static text. |
| **Upload panel** | File input (picker), optional visible file name, and an "Upload" (or "Process") button. User selects file here and triggers upload. |
| **Original image preview** | After a file is selected (and optionally after upload), show a thumbnail or preview of the selected/original image. Hidden or empty when no file is selected. |
| **Processing status panel** | Shows current job status: queued, processing, completed, or failed. May show jobId for debugging. Visible after upload is accepted; updates as polling returns new status. |
| **Processed image result panel** | When status is completed, displays the processed image (via URL from GET /result/:jobId). Hidden or placeholder when not completed. |
| **Error / retry area** | Displays error messages (validation, network, job failed). Includes retry and/or reset actions where applicable. Shown when an error state is set; hidden or collapsed when there is no error. |

The order above defines both visual hierarchy and the logical flow of the user journey.

---

## 3. Frontend State Model

### 3.1 Conceptual State

All state needed for the flow is listed below. Implementation may use `useState`, a custom hook, or a small reducer—the spec defines the logical state, not the API.

| State | Type / meaning | When it changes |
| ----- | ----------------- | ---------------- |
| **selectedFile** | `File or null` | User selects or clears file in the file input. |
| **previewUrl** | `string or null` | Object URL created from `selectedFile` for local preview; revoked on cleanup or reset. |
| **uploadRequestState** | e.g. `idle or pending or success or error` | Set to `pending` when upload request is sent; `success` when response is 2xx and body has jobId; `error` on failure. Reset on reset flow. |
| **jobId** | `string or null` | Set from upload response when upload succeeds. Cleared on reset. |
| **processingStatus** | `queued or processing or completed or failed or null` | `null` before any job; updated from GET /status or GET /result responses. |
| **processedImageUrl** | `string or null` | Set when processingStatus is `completed` and GET /result returns a URL. Cleared on reset. |
| **errorMessage** | `string or null` | Set on validation error, upload failure, polling failure, or job failure. Cleared on retry or reset. |
| **pollingActive** | `boolean` | `true` while a polling interval is running; `false` when polling has stopped (terminal status, timeout, or error). Used to avoid starting duplicate loops. |
| **reset / retry** | Conceptual | "Reset" clears file, jobId, status, result, error, stops polling, returns to initial state. "Retry" typically re-uploads the same file or re-polls; exact behavior is defined in Error Handling. |

### 3.2 State Transitions

- **File selected:** `selectedFile` set; `previewUrl` set (create object URL). Optional: clear previous `errorMessage`.
- **Upload button clicked (valid file):** `uploadRequestState` → `pending`; optional: clear `errorMessage`. On success: `uploadRequestState` → `success`, `jobId` set, start polling (`pollingActive` → true). On failure: `uploadRequestState` → `error`, `errorMessage` set.
- **Polling tick:** Request GET /status or GET /result; on success update `processingStatus` (and `processedImageUrl` if completed). On terminal status (completed/failed): stop polling (`pollingActive` → false). On job failed: set `errorMessage`. On repeated network error: optionally set `errorMessage` and stop polling.
- **Retry:** Clear `errorMessage`; either re-send upload (same file) or restart polling for same jobId—per section 11.
- **Reset:** Clear all job-related and file-related state; revoke `previewUrl`; stop polling; UI returns to initial state.

---

## 4. User Flow

Step-by-step user journey and corresponding UI behavior:

### A. Initial state

- No file selected. Upload button disabled or not actionable. No preview, no status, no result, no error. Header and upload panel visible; status and result panels empty or hidden.

### B. File selected

- User chooses a file via the file picker. Preview of the original image appears. Upload button becomes enabled (if validation passes). Any previous error message can be cleared.

### C. Upload submitted

- User clicks Upload. Button may show loading/disabled. No new file selection during request. If validation fails (type/size), show error and do not call API.

### D. Upload successful

- API returns 201 with jobId and status "queued". UI shows confirmation (e.g. "Upload accepted" or "Queued"). Polling starts. Status panel shows "Queued" (and optionally jobId).

### E. Polling in progress

- Status panel updates as responses arrive: "Queued" → "Processing" → eventually "Completed" or "Failed". Processed image panel stays empty until completed. No duplicate polling loops.

### F. Processing completed

- A poll returns status "completed" and (from status or result endpoint) a processed image URL. Polling stops. Processed image panel displays the image. Status panel shows "Completed".

### G. Processing failed

- A poll returns status "failed" or the backend indicates failure. Polling stops. Error area shows a message (e.g. "Processing failed"). User can retry or reset.

### H. User retries

- After an upload or network error: user can click Retry to resend the upload (same file). After a job failure: Retry may re-poll the same job once or prompt to upload again—spec should pick one and document it. Error message cleared when retry starts.

### I. User resets and uploads another image

- User clicks Reset (or equivalent). All state cleared; preview cleared; polling stopped. UI returns to initial state. User can select a new file and upload again.

---

## 5. API Integration Contract

### 5.1 POST /upload

- **When called:** When the user clicks Upload and client-side validation passes. Called once per submit; no automatic retry unless user clicks Retry.
- **Request:** Multipart form data with the selected image file (field name consistent with backend, e.g. `image`).
- **Success (e.g. 201):** Response body contains `jobId` and `status` (e.g. "queued"). Frontend stores `jobId`, sets upload state to success, starts polling. Status panel shows queued.
- **Failure (4xx/5xx or network error):** Set upload state to error; set `errorMessage` from response body or a generic "Upload failed" message. Do not start polling. User can retry (resend same file).
- **State updated:** `jobId`, `uploadRequestState`, `errorMessage`; polling is started so `pollingActive` and `processingStatus` will be updated by polling.

### 5.2 GET /status/:jobId

- **When called:** Repeatedly at a fixed interval (e.g. every 2–3 seconds) after a successful upload, until a terminal status or timeout.
- **Success (200):** Body has `jobId` and `status`. Frontend updates `processingStatus`. If status is `completed` or `failed`, stop polling. If `completed`, frontend may call GET /result to obtain the image URL, or the status response may include it—align with backend spec.
- **Failure (e.g. 404, 5xx, network error):** Optionally retry the same jobId on next interval. After N consecutive failures, stop polling and set `errorMessage` (e.g. "Could not check status"). User can reset or retry.
- **State updated:** `processingStatus`, `pollingActive` (when stopped), `errorMessage` (on persistent failure).

### 5.3 GET /result/:jobId

- **When called:** When `processingStatus` becomes `completed` (either from GET /status or GET /result). Called once per job to obtain the processed image URL.
- **Success (200):** Body contains `processedImageUrl` (or equivalent). Frontend stores it and displays the image in the result panel.
- **Failure:** If the job is completed but this request fails, set `errorMessage` (e.g. "Could not load result image"). User can retry (re-call result) or reset.
- **State updated:** `processedImageUrl`, `errorMessage`.

Errors from any endpoint should be surfaced in the **error / retry area** with a short, user-friendly message and a clear next action (Retry or Reset).

---

## 6. Polling Strategy

### 6.1 When Polling Starts

- Immediately after a successful POST /upload response that returns a `jobId`. Only one polling loop per job; do not start polling again for the same jobId unless the user explicitly retries (and the spec defines retry as "restart polling" for that job).

### 6.2 Polling Interval

- Use a fixed interval (e.g. 2 or 3 seconds). No exponential backoff required for the assignment. Interval should be configurable (e.g. constant or env) so reviewers can adjust if needed.

### 6.3 When Polling Stops

- When `processingStatus` is `completed` or `failed`.
- When a maximum duration or number of attempts is reached (see below).
- When the user resets the page state (clear jobId and stop the timer).

### 6.4 Timeout / Termination

- Define a simple cap: e.g. stop after N minutes or M polling attempts. If the cap is reached without a terminal status, stop polling and set an error message (e.g. "Processing is taking longer than expected. Try resetting and uploading again."). Prevents infinite polling.

### 6.5 Temporary Polling Failures

- If a single GET /status (or GET /result) fails (network or 5xx), do not stop polling immediately. Retry on the next interval. If K consecutive requests fail, stop polling and set `errorMessage`. User can retry or reset.

### 6.6 Job Status "failed"

- When the backend returns status `failed`, stop polling, set `processingStatus` to `failed`, set `errorMessage` (e.g. "Processing failed"). Do not call GET /result. User can retry (re-upload) or reset.

### 6.7 Avoiding Duplicate Polling Loops

- Use a single interval or ref that is cleared when stopping. Before starting a new interval, clear any existing one. Guard: only start polling if there is a jobId and polling is not already active (e.g. `pollingActive` false). When starting polling, set `pollingActive` to true; when stopping, set to false. Component unmount should clear the interval so no updates occur after unmount.

---

## 7. File Validation Rules

### 7.1 Allowed File Types

- Restrict to image types that the backend accepts (e.g. `image/jpeg`, `image/png`). Use the `accept` attribute on the file input and/or validate `file.type` before upload. Reject other types with a clear message.

### 7.2 Max File Size

- Apply a reasonable client-side limit (e.g. 5–10 MB) to avoid huge uploads. If the file exceeds the limit, do not send the request; show an error (e.g. "File is too large. Maximum size is X MB.").

### 7.3 Invalid File Handling

- If the user selects a file that fails type or size validation: set `errorMessage` to a short, specific message; do not call POST /upload; do not clear the selected file so the user can correct or choose another. Upload button can remain enabled or be disabled—spec should pick one (e.g. disabled until valid file).

### 7.4 How Validation Errors Appear

- Display the message in the **error / retry area**. Same area used for network and job failures so all errors are in one place. Optionally show a brief inline hint near the file input; avoid duplicate messages.

---

## 8. UI States and Status Messaging

Suggested copy for each state. Wording should be simple and consistent.

| State | Message / UI text |
| ----- | ------------------ |
| No file selected | e.g. "Select an image" or leave file input label as-is; status area empty or "Select a pet image to get started." |
| File ready to upload | e.g. "Ready to upload" or show file name; Upload button enabled. |
| Upload in progress | e.g. "Uploading…"; button disabled or loading. |
| Upload accepted / queued | e.g. "Upload accepted. Processing queued." or "Queued." |
| Processing | e.g. "Processing…" or "Processing your image." |
| Completed | e.g. "Complete." or "Processing complete." |
| Failed (job) | e.g. "Processing failed." with optional "Try again" in error area. |
| Network error | e.g. "Upload failed. Check your connection and try again." or "Could not reach server." |
| Validation error | e.g. "Please select a valid image (JPEG or PNG, max X MB)." |

Status panel should show at most one primary status at a time; avoid stacking multiple status lines unless needed for clarity (e.g. "Queued" then "Processing" then "Complete").

---

## 9. Component Architecture

Proposed structure. Responsibilities are defined so the design stays simple and reviewable.

| Path | Responsibility |
| ---- | -------------- |
| **src/app/page.tsx** | Main page: composes header, upload panel, preview, status panel, result panel, error area. Owns or delegates state (e.g. to a hook). Renders in the order defined in Page Structure. |
| **src/components/ImageUploadPanel.tsx** | File input, optional file name display, Upload button. Receives `selectedFile`, `onFileSelect`, `onUpload`, `uploadRequestState` (or equivalent). Handles disabled/loading state of the button. |
| **src/components/StatusPanel.tsx** | Displays current processing status (queued, processing, completed, failed) and optionally jobId. Receives `processingStatus`, optional `jobId`. Hidden or minimal when no job. |
| **src/components/ImagePreview.tsx** | Shows the original image preview from a URL (object URL or similar). Receives `previewUrl` (or `selectedFile` and derives preview). Handles alt text and empty state. |
| **src/components/ProcessedImagePanel.tsx** | Shows the processed image when status is completed. Receives `processedImageUrl` and optional `processingStatus`. Hidden when no URL or not completed. |
| **src/components/ErrorNotice.tsx** | Displays `errorMessage` and Retry / Reset actions. Receives `errorMessage`, `onRetry`, `onReset`. Hidden when no error. |
| **src/services/api.ts** | Functions that call POST /upload, GET /status/:jobId, GET /result/:jobId. Return parsed JSON or throw on non-2xx / network error. No React state; used by page or hook. |
| **src/types/index.ts** | Shared types: e.g. upload response shape, status response shape, result response shape, processing status union. Keeps API contract in one place. |
| **src/hooks/useImageProcessing.ts** (optional) | Encapsulates state (file, preview, jobId, status, URLs, error, polling), upload handler, polling start/stop, reset, retry. Page uses the hook and passes values/callbacks to components. Reduces page.tsx size and centralizes transition logic. |

Do not over-componentize: e.g. one panel per major block is enough. Small presentational pieces (e.g. a status badge) can live inside the panel component unless reuse is needed.

---

## 10. State Management Strategy

### 10.1 Local State vs Custom Hook

- **Preferred:** Either all state in the page component (`useState`) or a single **custom hook** (e.g. `useImageProcessing`) that returns state and handlers. Both are acceptable; the hook improves testability and keeps the page thin.
- **Recommendation:** Use a custom hook that owns: selectedFile, previewUrl, upload state, jobId, processingStatus, processedImageUrl, errorMessage, pollingActive; and exposes handlers: handleFileSelect, handleUpload, reset, retry. The hook starts/stops polling based on jobId and status. The page calls the hook and passes props to the presentational components.

### 10.2 Why No Global State Library

- There is a single page and a linear flow. No shared state across routes, no deep prop drilling. One job at a time; state is scoped to the upload/processing flow. React local state (or one hook) is sufficient and keeps the assignment simple and reviewable. Global state (Redux, Zustand, etc.) would add indirection without benefit for this scope.

---

## 11. Error Handling UX

| Error | Handling | User action after |
| ----- | --------- | ------------------ |
| **Upload request failure** | Set error message (e.g. "Upload failed. Try again."). Do not start polling. | Retry (resend same file) or Reset and choose another file. |
| **Invalid file selection** | Show validation message in error area; do not call API. | User selects a different file or corrects type/size. |
| **Polling request failure** | After K consecutive failures, stop polling and show message (e.g. "Could not check status."). | Retry (restart polling for same jobId) or Reset. |
| **Backend job failure** | When status is "failed", stop polling, show "Processing failed." | Retry (re-upload same or new file) or Reset. |
| **Missing result image** | When status is completed but GET /result fails or URL missing, show "Could not load result." | Retry (re-fetch result) or Reset. |

Retry and Reset should be explicit buttons or links in the error area. Avoid automatic retries without user action for a take-home assignment so behavior is predictable and reviewable.

---

## 12. Accessibility and Usability Considerations

- **File input:** Use a visible `<label>` associated with the file input (e.g. `htmlFor` and `id`), or an aria-label. Label text should describe the action (e.g. "Choose pet image").
- **Upload button:** Disable when no valid file or when upload is in progress. Use `aria-busy` or similar if appropriate when loading. Button label should be clear ("Upload" or "Process image").
- **Status messaging:** Expose status text in a way that screen readers can announce (e.g. live region or sufficient focus management). Avoid status updates only via color or icon.
- **Images:** Provide meaningful `alt` text for preview and processed image (e.g. "Preview of selected pet image", "Processed result").
- **Keyboard:** Ensure file input and buttons are focusable and activatable via keyboard. Tab order should follow visual order (upload panel → status → result → error actions).

---

## 13. Styling Guidance

- **Layout:** Single-column, centered (e.g. max-width container, margin auto). Main blocks stacked vertically with consistent spacing.
- **Sections:** Use simple card/container styles (border or subtle background) to separate header, upload, preview, status, result, and error. No need for a full design system.
- **Spacing:** Consistent padding and margin between sections (e.g. 1–1.5 rem). Comfortable line height for text.
- **Status:** Use simple status badges or text styles (e.g. muted for "Queued", bold or accent for "Complete"/"Failed"). Minimal visual hierarchy: title > section headings > body text.
- **Modesty:** No elaborate animations, gradients, or custom illustration. Neutral palette and readable fonts are sufficient. The goal is clarity and professionalism, not visual flair.

---

## 14. Testing Considerations for Frontend

If time allows, focus on behavior that proves correctness and prevents regressions:

- **File selection:** Selecting a file sets state and shows preview; clearing or invalid file updates state and error.
- **Upload button:** Disabled when no file or invalid file; disabled (or loading) during upload; enabled again after success or error.
- **Polling:** Starting after successful upload; stopping on completed/failed or timeout; no second loop for the same jobId while one is active.
- **State rendering:** When status is completed, result panel shows image; when failed, error area shows message and retry/reset.
- **Reset:** Reset clears file, jobId, status, result, error, and stops polling; UI matches initial state.
- **API layer:** Mock api.ts in tests; assert correct endpoint and payload for upload; assert polling calls status/result with jobId.

This is a specification of what to test, not test code.

---

## 15. Tradeoffs

Intentional simplifications and their rationale:

- **Polling instead of WebSockets/SSE:** Simpler to implement and reason about; no backend changes; sufficient for a take-home. Tradeoff: slight delay in status updates and extra requests.
- **One-page flow:** No routing, no dashboard, no auth. Keeps scope minimal and review focused on one journey.
- **Local state (or one hook) instead of global store:** State is confined to one flow; no need for cross-route or cross-component sharing. Easier to review and test.
- **Minimal styling:** Avoids design-system and UI library decisions; keeps the assignment about flow, state, and API integration. Reviewers can run and use the app without distraction.
- **Simple retry/reset:** Explicit user actions only; no automatic retries or complex recovery flows. Behavior is predictable and documentable.

---

## 16. Future Improvements

With more time, the following would strengthen the frontend:

- **Drag-and-drop upload:** In addition to file picker; improve discoverability and ease of use.
- **Upload progress bar:** If backend supports progress (e.g. chunked upload), show progress during POST /upload.
- **Event-driven updates:** WebSockets or Server-Sent Events for status so the UI updates without polling and reduces load.
- **Richer error recovery:** Different retry strategies per error type; exponential backoff for polling; clearer distinction between "retry same job" and "upload again".
- **Image metadata:** Show dimensions, file size, or format in preview or result panel.
- **Responsive polish:** Layout and touch targets tuned for small screens; optional image scaling for large results.
- **E2E tests:** Full flow in a browser (e.g. Playwright) against a stub or test backend to validate the entire journey.

These are out of scope for the current specification but document expected direction.
