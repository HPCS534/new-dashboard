# Record checking dashboard

## Temporary frontend password

The dashboard is now hidden behind a password screen. Set a password in the untracked `.env` file, then restart the Vite server:

```env
VITE_DASHBOARD_PASSWORD=your-temporary-password
```

`.env.example` shows the complete local environment format. A successful entry is remembered only for the current browser tab/session; closing the tab requires the password again.

This is deliberately a temporary UI gate, not real protection. Values beginning with `VITE_` are shipped to the browser and can be inspected by a determined viewer. The app also needs its API to enforce access before sensitive records are considered protected.

## Backend integration later

1. Create `POST /api/auth/login` that accepts `{ "password": "..." }`, validates a server-side password hash, and returns an opaque session cookie (`HttpOnly`, `Secure`, `SameSite`) or a short-lived access token. Rate-limit failed attempts.
2. Require that session/token on every existing records, images, and update-status endpoint. Do not rely on the frontend gate or the current API key alone.
3. Change `PasswordGate.tsx` so submit calls `/api/auth/login`; unlock only after a successful response. For cookie sessions, use `credentials: "include"` in API fetches. For tokens, keep them in memory where possible and attach `Authorization: Bearer <token>`.
4. Add `POST /api/auth/logout`, clear the session/token in the UI, and redirect back to the password screen on `401` or `403` responses.

Until then, set `VITE_DASHBOARD_PASSWORD` locally as described above.

# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.
