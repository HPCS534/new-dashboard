# Performance Test Results

## Summary

| Field | Value |
|---|---|
| Test type | Performance |
| Repository commit | `80075f0` |
| Environment | Windows, Chromium, local frontend, local backend `http://localhost:5153` |
| Browser command | `npm run test:performance:browser` |
| API command | `C:\Program Files\k6\k6.exe run tests/performance/api.k6.js` |
| Browser result | PASS |
| API result | PASS |

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
| Iterations | 13,677 | — |
| Error rate | 0% | 0% |
| p50 samples-list duration | 1.65 ms | — |
| p95 samples-list duration | 3.52 ms | < 3000 ms |
| Maximum samples-list duration | 76.79 ms | — |
| HTTP request failure rate | 0% | 0% |

The k6 setup authentication request succeeded. API cold-start time was not measured as a separate metric; the browser run above contains the measured cold-start value.

## Bugs found

None in the browser or API performance runs.

## Not run

None.
