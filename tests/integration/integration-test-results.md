# Integration Test Results

## Summary

| Field | Value |
|---|---|
| Test type | Integration |
| Repository commit | `80075f0` |
| Frontend | Local Vite server |
| Backend | `http://localhost:5153` |
| Database state | Empty local database |
| Command | `npm run test:integration` |
| Result | PASS |

## Results

| TC-ID | Test | Expected | Actual | Result |
|---|---|---|---|---|
| TC-INT-01 | Reject invalid credentials | Login error and no dashboard access | Error shown and logout control absent | PASS |
| TC-INT-02 | Load samples after authentication | `GET /api/samples` returns HTTP 200 | HTTP 200; empty list rendered | PASS |

**Totals:** 2 passed, 0 failed.

## Boundaries exercised

- Browser dashboard to local backend API
- Supabase test-account authentication to the dashboard
- Authenticated `GET /api/samples`
- Empty database response handling

## Bugs found

The initial local backend configuration returned HTTP 500 for an empty sample database. The backend environment was corrected; the endpoint now returns a successful empty list.

## Not run

None.

Credentials are supplied through environment variables and are not stored in this report or repository.
