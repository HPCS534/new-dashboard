# Performance Test Results

## Summary

| Field | Value |
|---|---|
| Test type | Performance |
| Repository commit | `80075f0` |
| Environment | Windows, Chromium, local frontend, local backend `http://localhost:5153` |
| Browser command | `npm run test:performance:browser` |
| API command | `k6 run tests/performance/api.k6.js` |
| Browser result | PASS |
| API result | UNVERIFIED |

## Browser dashboard timing

The browser test measured five complete sign-in-to-dashboard flows with one user. The database contained zero sample records.

| Metric | Result | Target |
|---|---:|---:|
| Users | 1 | — |
| Iterations | 5 | — |
| Error rate | 0% | 0% |
| Cold start | 1248 ms | ≤ 3000 ms |
| p50 | 681 ms | ≤ 3000 ms |
| p95 | 1248 ms | ≤ 3000 ms |
| Maximum | 1248 ms | — |

## API performance

The k6 script is present at `tests/performance/api.k6.js`, but k6 was unavailable in the test environment. No API performance result is claimed.

Required environment variables:

```text
BACKEND_URL
SUPABASE_URL
SUPABASE_PUBLISHABLE_KEY
TEST_EMAIL
TEST_PASSWORD
```

## Bugs found

None in the browser performance run.

## Not run

k6 API performance was not run because the `k6` command was unavailable. Install k6, then run the documented API command and append its p50, p95, maximum, user count, cold-start, and error-rate results.
