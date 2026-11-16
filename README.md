# Record Checking Dashboard

React and TypeScript dashboard for reviewing grain-record submissions and AI-generated grain detections.

## What it does

- Authenticates users with Supabase email/password authentication.
- Loads samples with their related replicate photos from the backend API.
- Displays one row/card per sample in a searchable, sortable table or a Kanban board.
- Groups all photos for a sample together and shows each photo's quality, grade, and confidence.
- Filters samples by status: All, Review, Accepted, Has rejected, or Has retraining.
- Opens record details with capture metadata, quality measurements, and image overlays.
- Shows AI-predicted and reviewer-confirmed grain bounding boxes.
- Updates photo review status through the backend API, including Kanban drag-and-drop.
- Supports manually overriding a photo's quality classification.
- Exports all records to CSV through the backend API.
- Supports image zoom while preserving the current viewport.

## Requirements

- Node.js 20 or newer
- npm
- Access to the configured Supabase project
- A running instance of the records backend

## Local setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create a `.env` file in the project root:

   ```env
   VITE_BACKEND_URL=https://your-backend.example.com
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=your-supabase-publishable-key
   ```

   `VITE_BACKEND_URL` is used by the Vite development proxy and by production builds. The Supabase URL and publishable key are used by the browser to sign users in. Do not put secret keys, service-role keys, or passwords in this file.

3. Start the development server:

   ```bash
   npm run dev
   ```

   Open the URL printed by Vite, usually `http://localhost:5173`.

## Available scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start Vite with hot module replacement |
| `npm run build` | Type-check and create a production build |
| `npm run lint` | Run Oxlint |
| `npm run preview` | Serve the production build locally |
| `npm run test:unit` | Run unit tests |
| `npm run test:integration` | Run browser/API integration tests |
| `npm run test:system` | Run system tests |
| `npm run test:performance:browser` | Run browser performance tests |
| `npm run test:performance:api` | Run k6 API performance tests |
| `npm run test:all` | Run unit, integration, system, browser performance, and API performance suites |

`npm run test:all` requires the local backend, valid `TEST_EMAIL` and `TEST_PASSWORD`
credentials, the frontend Supabase variables, and k6 on `PATH`.

Run the build and linter before opening a pull request:

```bash
npm run lint
npm run build
```

## Backend API

The frontend expects these authenticated endpoints:

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/api/samples` | Load grouped samples and their replicate photos |
| `GET` | `/api/replicates/export` | Download a server-generated CSV containing all records |
| `PATCH` | `/api/replicates/:id/status` | Update a photo's review status |
| `PATCH` | `/api/replicates/:id/override` | Set or remove a manual photo-quality override |

Requests include the current Supabase access token in the Authorization header. The backend must validate that token and enforce access control; the frontend login screen is not a substitute for server-side authorization.

During development, Vite proxies `/api` requests to `VITE_BACKEND_URL`. In a production build, requests use `VITE_BACKEND_URL` directly.

## Project structure

```text
src/
├── App.tsx                 Dashboard views, filtering, sorting, and record details
├── AuthGate.tsx            Supabase sign-in screen and session gate
├── api.ts                  Authenticated backend requests
├── export.ts               CSV export helpers
├── supabase.ts             Supabase client configuration
├── types.ts                Record and grain-box types
└── components/
    ├── Quality.tsx         Photo-quality and confidence display helpers
    ├── StatusPicker.tsx    Review-status controls
    └── status.ts           Review-status labels and columns
```

## Authentication and configuration

Supabase manages the browser session. Users must have an account in the configured Supabase project and sign in with their email and password. Logging out clears the local Supabase session.

All `VITE_*` variables are embedded in the browser bundle. Only use browser-safe values, such as a Supabase publishable key. Keep backend secrets and service-role credentials on the server.
