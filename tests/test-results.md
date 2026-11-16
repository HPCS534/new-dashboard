# Frontend Test Results

## Submission summary

| Field | Value |
|---|---|
| Repository | `HPCS534/new-dashboard @ e68a10a` |
| Environment | Windows, Node.js 24.11.1, npm 11.6.2, Chromium, local Vite frontend |
| Backend | `http://localhost:5153` |
| Backend readiness | `GET /health` returned HTTP 200 |
| Full-suite command | `npm run test:all` |
| Full-suite exit code | `0` for the previous empty-state baseline |
| Populated integration command | `npm run test:integration -- --grep "preserves populated sample and replicate data"` |
| Populated integration exit code | `0` |
| Overall result | PASS for the implemented frontend tests; populated-data integration evidence is included below |

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
| TC-INT-03 | Preserve populated sample and replicate data from the backend | Integration | `npm run test:integration -- --grep "preserves populated sample and replicate data"` | PASS |

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

**Integration total:** 3 passed, 0 failed across the baseline and populated-data runs.

### Data-arrival report

| Boundary required by the assignment | Status | Data unchanged? |
|---|---|---|
| Frontend app → backend API | PASS | The populated sample and both replicates were returned by the real API and matched the expected IDs, counts, statuses, weights, grain boxes, and image metadata. |
| Backend API → database | PASS with backend-seeded evidence | The backend supplied two persisted replicates for `2026WS-IND-001-S01`; the frontend received both records unchanged. Direct database assertions remain owned by backend tests. |
| Backend API → Cloudinary | PASS with seeded image-metadata evidence | Both persisted `imagePublicId` and `imageSecureUrl` values arrived unchanged. The frontend did not upload or independently inspect Cloudinary objects. |

**Populated-data evidence:** The sample contained two replicates. The test verified
`replicateCount: 2`, `goodCount: 1`, the sample status and averages, both replicate
labels, weights, percentages, grades, qualities, confidence values, grain-box
coordinates, `imagePublicId`, and `imageSecureUrl`.

**Bugs found:** An earlier backend configuration returned HTTP 500 for an empty
database. The backend was corrected to return HTTP 200 with an empty list. The
populated-data integration test passed after the backend database was seeded.

**Could not run:** Direct database row assertions and direct Cloudinary object
verification were not run in the frontend repository; those remain backend-owned
checks. The frontend verified the persisted values exposed by the API.

## System tests

System tests exercised the whole available frontend flow as a real user through
Chromium and the running backend.

| TC-ID | Title | Type | Command | Result |
|---|---|---|---|---|
| TC-SYS-01 | Navigate between dashboard views and log out | System/functional | `npm run test:system` | PASS |
| TC-SYS-02 | Verify populated dashboard controls and CSV availability | System/functional | `npm run test:system` | PASS |
| TC-SYS-03 | Review populated sample, filter it, open details, and export CSV | System/functional | `npm run test:system -- --grep "reviews a populated sample"` | PASS |

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
2. Verify the seeded sample row is visible — **PASS**
3. Verify CSV export is enabled — **PASS**
4. Verify the status filter is visible — **PASS**
5. Verify the sample-search control is visible — **PASS**

### TC-SYS-03 steps

1. Sign in — **PASS**
2. Verify the populated sample, selection, and replicate quality chips are visible — **PASS**
3. Search for `IND-001` — **PASS**
4. Filter to Accepted records — **PASS**
5. Open the sample details — **PASS**
6. Verify sample summary values and two photo tabs — **PASS**
7. Verify AI and reviewer image-panel captions — **PASS**
8. Close the details and export CSV — **PASS**
9. Verify the downloaded filename — **PASS**

**System total:** 3 passed, 0 failed.

**Bugs found:** None in the final run.

**Could not run:** Empty-state behavior was not run in this seeded-data session because
the local database intentionally contains populated records. It remains covered by the
previous baseline evidence.

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

