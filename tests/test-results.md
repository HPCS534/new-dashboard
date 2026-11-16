# Frontend Test Results

## Submission summary

| Field | Value |
|---|---|
| Repository | `HPCS534/new-dashboard @ e68a10a` |
| Environment | Windows, Node.js 24.11.1, npm 11.6.2, Chromium, local Vite frontend |
| Backend | `http://localhost:5153` |
| Backend readiness | `GET /health` returned HTTP 200 |
| Full-suite command | `npm run test:all` |
| Full-suite exit code | `0` |
| Overall result | PASS for implemented frontend tests; integration boundary limitations documented below |

The test account and Supabase values were supplied through environment variables. No
credentials were stored in this report or repository.

## Unit tests

| TC-ID | Title | Type | Command | Result |
|---|---|---|---|---|
| TC-UNIT-01 | Quality labels, confidence, replicate suffix, and override marker | Unit | `npm run test:unit` | PASS: 3/3 |
| TC-UNIT-02 | Supported review-status labels and columns | Unit | `npm run test:unit` | PASS: 2/2 |

**Unit total:** 5 passed, 0 failed.

**Bugs found:** None.

**Could not run:** None.

## Integration tests

Integration tests used the real browser frontend, real Supabase authentication, and the
running backend. No frontend mock server or mocked API response was used.

| TC-ID | Title | Type | Command | Result |
|---|---|---|---|---|
| TC-INT-01 | Reject invalid credentials without opening the dashboard | Integration | `npm run test:integration` | PASS |
| TC-INT-02 | Authenticate and load samples from the backend | Integration | `npm run test:integration` | PASS |

### TC-INT-01 steps

1. Open the dashboard login page — **PASS**
2. Submit invalid email and password — **PASS**
3. Verify an authentication alert is shown — **PASS**
4. Verify the dashboard is not opened — **PASS**

### TC-INT-02 steps and connected parts

1. Open the frontend login page — **PASS**
2. Authenticate with the real Supabase test account — **PASS**
3. Frontend sends a real `GET /api/samples` request to the backend — **PASS**
4. Backend returns HTTP 200 — **PASS**
5. Frontend parses the response as a sample list and renders the record-list region — **PASS**

**Integration total:** 2 passed, 0 failed.

### Data-arrival report

| Boundary required by the assignment | Status | Data unchanged? |
|---|---|---|
| Frontend app → backend API | PASS | The HTTP status and empty-array response were received and rendered without transformation errors. No sample records existed, so field-by-field record comparison was not possible. |
| Backend API → database | NOT VERIFIED by this frontend suite | The frontend test does not inspect the database directly. This requires backend integration tests with database assertions. |
| Backend API → Cloudinary | NOT VERIFIED by this frontend suite | The tested endpoint returned an empty sample list and did not retrieve a Cloudinary-backed image. This requires a seeded backend test that verifies image data. |

**Bugs found:** An earlier backend configuration returned HTTP 500 for an empty
database. The backend was corrected to return HTTP 200 with an empty list. The final
frontend integration run passed.

**Could not run:** No frontend integration test could verify API-to-database or
API-to-Cloudinary fidelity because the local database contained zero records and those
internal boundaries are outside the frontend repository.

## System tests

System tests exercised the whole available frontend flow as a real user through
Chromium and the running backend.

| TC-ID | Title | Type | Command | Result |
|---|---|---|---|---|
| TC-SYS-01 | Navigate between dashboard views and log out | System/functional | `npm run test:system` | PASS |
| TC-SYS-02 | Verify empty dashboard state and controls | System/functional | `npm run test:system` | PASS |

### TC-SYS-01 steps

1. Sign in — **PASS**
2. Verify Row view is selected — **PASS**
3. Select Kanban view — **PASS**
4. Verify Kanban view is visible — **PASS**
5. Return to Row view — **PASS**
6. Verify the record list is visible — **PASS**
7. Log out — **PASS**
8. Verify the sign-in button is visible — **PASS**

### TC-SYS-02 steps

1. Sign in — **PASS**
2. Verify the empty-state message — **PASS**
3. Verify CSV export is disabled with no records — **PASS**
4. Verify the status filter is visible — **PASS**
5. Verify the sample-search control is visible — **PASS**

**System total:** 2 passed, 0 failed.

**Bugs found:** None in the final run.

**Could not run:** Populated-record user flows were not run because the local
database contained zero sample records.

## Performance tests

Performance tests measured speed rather than correctness. Correctness assertions were
used only to exclude failed requests from the timing results.

| TC-ID | Title | Type | Command | Result |
|---|---|---|---|---|
| TC-PERF-01 | Measure repeated dashboard sign-in and list-load timing | Browser performance | `npm run test:performance:browser` | PASS |
| TC-PERF-02 | Measure authenticated samples API latency | API performance | `npm run test:performance:api` | PASS |

### TC-PERF-01 browser timing

| Metric | Result |
|---|---:|
| Users | 1 |
| Iterations | 5 |
| Cold start | 1298 ms |
| p50 | 729 ms |
| p95 | 1298 ms |
| Maximum | 1298 ms |
| Error rate | 0% |

### TC-PERF-02 k6 API timing

| Metric | Result |
|---|---:|
| Virtual users | 1 |
| Duration | 30 seconds |
| Iterations | 17,406 |
| p50 | 1.37 ms |
| p95 | 2.59 ms |
| Maximum | 65.68 ms |
| Error rate | 0% |
| HTTP request failure rate | 0% |

**Bugs found:** None in the final browser or API performance runs.

**Could not run:** Multi-user load, stress, and soak profiles were not run. The
current performance scope is a one-user baseline.

## Compliance assessment

| Assignment instruction | Status |
|---|---|
| Unit tests | Covered and passed |
| Integration tests with at least two real parts and no mocks | Partially covered: frontend-to-API is real; API-to-database and API-to-Cloudinary fidelity require backend-side tests |
| Report whether data arrived unchanged | Reported; no records were available for field-level comparison |
| System tests written as user steps with pass/fail results | Covered |
| k6 API performance | Covered |
| Browser dashboard timing | Covered |
| p50, p95, maximum, error percentage, users, and cold start | Reported |
| Extensive testing requested by the leader | Baseline is complete; populated-data integration/system tests and multi-user performance profiles remain recommended |

