<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# HealthGuard

This repository contains the HealthGuard web app and API.

## Tech Stack

- Frontend: Vite, React, TypeScript
- Backend: Express, TypeScript
- Data/Auth: Supabase

## Run Locally

**Prerequisites:** Node.js 18+ and Supabase project credentials.

### Frontend

1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy [.env.example](.env.example) to `.env.local` and set:
   ```bash
   VITE_SUPABASE_URL=
   VITE_SUPABASE_ANON_KEY=
   VITE_API_URL=http://127.0.0.1:3001/api
   ```
3. Run the app:
   ```bash
   npm run dev
   ```

### Backend

1. Install dependencies:
   ```bash
   cd server
   npm install
   ```
2. Copy [server/.env.example](server/.env.example) to `server/.env` and set:
   ```bash
   SUPABASE_URL=
   SUPABASE_SERVICE_KEY=
   PORT=3000
   ```
3. Run the API:
   ```bash
   npm run dev
   ```

## Verify

```bash
npm run build
cd server && npm run build
```
