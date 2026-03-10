<h1 align="center">AI Clinical Mediator</h1>

Multi-agent debate system for hospital MDT teams. Specialist AI personas analyze a patient case in parallel, debate guideline-backed plans, and stream a consensus report for human review and confirmation.

## Tech Stack

- **App Router / Next.js 14** with React Server Components
- **TypeScript** end-to-end
- **Tailwind CSS + shadcn-inspired primitives**
- **NextAuth (JWT strategy)** for clinician auth/roles
- **Prisma + PostgreSQL** for persisted cases and audit trail
- **Anthropic Claude (claude-sonnet-4-20250514)** for agent orchestration
- **React-PDF** for 1-page consensus exports

## Features

1. Doctor register/login with role field and middleware-protected dashboard.
2. Multi-step patient case wizard (labs, comorbidities, risk scores, uploads, specialist opinions).
3. Template launcher for Oncology / Heart Team / Multimorbidity / MDT triage.
4. Streaming `/api/cases/[id]/analyze` endpoint emitting Server-Sent Events as every agent completes.
5. Moderator agent synthesizes conflicts + evidence strength into a consensus JSON document.
6. Case detail page shows debate progress, safety alerts, ranked options, dissenting views, and PDF export.
7. Meeting mode fullscreen UI with agent toggles and lockable MDT confirmation audit log.

## Local Development

### 1. Requirements

- Node.js 20+
- npm 10+
- Docker Desktop (for Postgres)

### 2. Environment

```bash
cp .env.local.example .env.local
# fill in ANTHROPIC_API_KEY and NEXTAUTH_SECRET
```

### 3. Database

```bash
docker compose up -d db
npm install
npm run prisma:generate
npm run prisma:migrate --name init
```

### 4. Seed Doctors (optional quick start)

Run the following in a Node REPL or script:

```ts
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
await prisma.doctor.create({
  data: {
    name: "MDT Surgeon",
    email: "surgeon@example.com",
    role: "Surgeon",
    password: await hashPassword("secret123"),
  },
});
```

### 5. Run the App

```bash
npm run dev
# visit http://localhost:3000
```

## Key Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Next.js dev server |
| `npm run build` / `npm start` | Production build + serve |
| `npm run lint` | ESLint |
| `npm run prisma:migrate` | Create/migrate DB schema |
| `npm run prisma:push` | Push Prisma schema without migration |

## Deployment Notes

- Set `DATABASE_URL`, `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, and `ANTHROPIC_API_KEY` in the hosting environment.
- When deploying on Vercel, use the Edge runtime for API routes that stream events only if Anthropic SDK supports it; otherwise run as Node.js serverless.
- Prisma client instantiation is handled via a singleton to prevent connection exhaustion in serverless/dev.

## Testing the AI Debate Flow

1. Create a case in `/cases/new` (templates page can pre-fill fields).
2. On the case detail page, click **Start Debate**. Progress events stream in real-time.
3. Once consensus is ready, export the PDF and open meeting mode at `/cases/[id]/meeting`.
4. Fill the attending doctor list + final plan, click **Confirm plan** to lock the case.

> **Note:** If `ANTHROPIC_API_KEY` is not set, the system uses deterministic fallback text so UI flows can still be demonstrated without live agent calls.

## Folder Structure

```
src/
  app/
    (auth)/login, register
    (dashboard)/dashboard, cases, templates, meeting
    api/ cases, templates, upload, auth
  components/
    agents/ — streaming panel
    forms/ — case wizard
    meeting/ — meeting mode UI
    report/ — PDF helpers
  lib/
    agents/ — Anthropic orchestrator
    prisma.ts, auth.ts, session.ts, templates.ts, utils.ts
```

## Troubleshooting

- **Prisma errors**: ensure Docker Postgres is running (`docker compose ps`).
- **NextAuth failures**: update `NEXTAUTH_URL` when testing on non-localhost origins.
- **Streaming errors**: check browser console for SSE parsing issues; run `npm run dev` in Node 20+.

## License

Proprietary / Internal prototype. Do not distribute without approval.
