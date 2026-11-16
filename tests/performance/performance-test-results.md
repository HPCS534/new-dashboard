# Performance Test Results

## Summary

| Field | Value |
|---|---|
| Test type | Performance |
| Repository commit | `e68a10a` |
| Environment | Windows, Chromium, local frontend, local backend `http://localhost:5153` |
| Browser command | `npm run test:performance:browser` |
| API command | `npm run test:performance:api` |
| Browser result | PASS |
| API result | PASS |

## Browser dashboard timing

The browser test measured five complete sign-in-to-dashboard flows with one user. The database contained zero sample records.

| Metric | Result | Target |
|---|---:|---:|
| Users | 1 | — |
| Iterations | 5 | — |
| Error rate | 0% | 0% |
| Cold start | 1298 ms | ≤ 3000 ms |
| p50 | 729 ms | ≤ 3000 ms |
| p95 | 1298 ms | ≤ 3000 ms |
| Maximum | 1298 ms | — |

## API performance

The k6 test ran locally against the authenticated samples endpoint.

Required environment variables:

```text
BACKEND_URL
SUPABASE_URL
SUPABASE_PUBLISHABLE_KEY
TEST_EMAIL
TEST_PASSWORD
```

| Metric | Result | Target |
|---|---:|---:|
| Virtual users | 1 | — |
| Duration | 30 seconds | — |
| Iterations | 17,406 | — |
| Error rate | 0% | 0% |
| p50 samples-list duration | 1.37 ms | — |
| p95 samples-list duration | 2.59 ms | < 3000 ms |
| Maximum samples-list duration | 65.68 ms | — |
| HTTP request failure rate | 0% | 0% |

The k6 setup authentication request succeeded. API cold-start time was not measured as a separate metric; the browser run above contains the measured cold-start value.

## Bugs found

None in the browser or API performance runs.

## Not run

None.
