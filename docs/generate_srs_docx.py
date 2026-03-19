from __future__ import annotations

from html import escape
from pathlib import Path
import zipfile

base_dir = Path(__file__).resolve().parent
output_path = base_dir / "AI-Clinical-Mediator-SRS.docx"

paragraphs = [
    {"text": "AI Clinical Mediator \u2013 Software Requirements Specification", "style": "Title"},
    {"text": "Version 1.0 | 18 Mar 2026", "style": "Subtitle"},
    {"text": ""},
    {"text": "Document Control", "style": "Heading1"},
    {"text": "Author: Cascade (AI assistant) supporting KaivallyaTitame/AI-CLINICAL-MEDIATOR."},
    {"text": "Stakeholders: Clinical Informatics Lead, Engineering Lead, Compliance Officer."},
    {"text": "Status: Draft for internal review."},
    {"text": "Distribution: Proprietary \u2013 do not circulate outside the hospital innovation program."},
    {"text": ""},
    {"text": "1. Introduction", "style": "Heading1"},
    {"text": "1.1 Purpose", "style": "Heading2"},
    {"text": "This Software Requirements Specification (SRS) defines functional, non-functional, and interface requirements for the AI Clinical Mediator platform that assists hospital MDT teams with AI-guided debates and consensus reporting."},
    {"text": "1.2 Scope", "style": "Heading2"},
    {"text": "The scope covers the clinician-facing Next.js web experience, authentication, patient case intake, AI agent orchestration, consensus review, meeting mode, and supporting APIs, data, and deployment concerns."},
    {"text": "1.3 Definitions & Acronyms", "style": "Heading2"},
    {"text": "- MDT: Multidisciplinary Team responsible for high-risk patient decisions."},
    {"text": "- Case wizard: Multi-step intake workflow gathering demographics, labs, imaging, uploads, and specialist notes."},
    {"text": "- Agent: An AI persona (surgeon, oncologist, pharmacologist, etc.) invoked through Anthropic/OpenRouter via runDebate."},
    {"text": "- Consensus report: JSON structure capturing evidence-backed agreement, dissent, ranked options, and safety alerts."},
    {"text": "1.4 References", "style": "Heading2"},
    {"text": "- README.md and docs/PROJECT_DOCUMENTATION.md for architectural and operational context."},
    {"text": "- Prisma schema and NextAuth configuration under src/lib for data contracts and auth flows."},
    {"text": "- Regulatory references: HIPAA Security Rule, local hospital audit policies."},
    {"text": ""},
    {"text": "2. Overall Description", "style": "Heading1"},
    {"text": "2.1 Product Perspective", "style": "Heading2"},
    {"text": "AI Clinical Mediator is a web-native clinical decision support tool built with Next.js App Router, Prisma ORM, and Anthropic-powered agents. It operates alongside existing EMR workflows by providing an authenticated workspace for case preparation, AI debate visualization, and decision logging."},
    {"text": "2.2 Product Functions", "style": "Heading2"},
    {"text": "- F01: Manage clinician registration, login, and role-aware sessions via NextAuth (JWT strategy)."},
    {"text": "- F02: Capture structured patient case data through a guided wizard with template presets for Oncology, Heart Team, Multimorbidity, and MDT triage."},
    {"text": "- F03: Invoke specialist AI agents in parallel, stream intermediate progress through Server-Sent Events, and escalate moderator synthesis."},
    {"text": "- F04: Render consensus insights with dissent tracking, ranked treatment options, safety alerts, and PDF exports."},
    {"text": "- F05: Provide meeting mode with attendance logging, final plan confirmation, and immutable audit trail."},
    {"text": "2.3 User Classes and Characteristics", "style": "Heading2"},
    {"text": "- Attending clinicians (Surgeon, Oncologist, Cardiologist, Pharmacologist) \u2013 require rapid case insight, can start debates, and confirm plans."},
    {"text": "- MDT coordinators \u2013 curate case data, launch templates, monitor debate completion, and export summaries."},
    {"text": "- Observers / Fellows \u2013 read-only access for training or compliance review."},
    {"text": "2.4 Operating Environment", "style": "Heading2"},
    {"text": "- Browser: Chromium, Safari, and Firefox (latest two releases) with WebSockets/SSE enabled."},
    {"text": "- Server runtime: Node.js 20+, Next.js 14 App Router, hosted on Vercel or containerized infrastructure."},
    {"text": "- Database: PostgreSQL 14+ accessible through Prisma with connection pooling (e.g., pgBouncer)."},
    {"text": "2.5 Design Constraints", "style": "Heading2"},
    {"text": "- Must comply with HIPAA/PHI handling, enforce HTTPS, and support audit logging for every case mutation."},
    {"text": "- SSE streaming over /api/cases/[id]/analyze must remain responsive under hospital network latency (<5s heartbeat)."},
    {"text": "- Deterministic fallback text required when Anthropic/OpenRouter keys are absent to preserve demo workflows."},
    {"text": "- Deployment must support environment secrets (ANTHROPIC_API_KEY, NEXTAUTH_SECRET, DATABASE_URL)."},
    {"text": "2.6 Assumptions & Dependencies", "style": "Heading2"},
    {"text": "- Anthropic/OpenRouter availability for real agent responses; otherwise fallback copy is acceptable for UI verification."},
    {"text": "- Hospital network permits outbound HTTPS to AI providers through approved proxies."},
    {"text": "- Dockerized PostgreSQL instance or managed equivalent is provisioned prior to go-live."},
    {"text": "- Clinicians possess valid credentials issued by the hospital IAM system."},
    {"text": ""},
    {"text": "3. System Features", "style": "Heading1"},
    {"text": "3.1 SF-1 \u2013 Clinician Authentication & Authorization", "style": "Heading2"},
    {"text": "Description: Secure clinician identity lifecycle leveraging NextAuth Credentials provider, bcrypt hashing, and role claims embedded in JWT tokens."},
    {"text": "Primary Actors: Clinicians, coordinators."},
    {"text": "Triggers: Registration, login, session refresh."},
    {"text": "Functional Requirements", "style": "Heading3"},
    {"text": "- FR-1.1: The system shall collect name, email, role, and strong password (min 12 chars, mixed case) during onboarding."},
    {"text": "- FR-1.2: Passwords shall be hashed with bcrypt (>=10 rounds) before persistence."},
    {"text": "- FR-1.3: Successful login shall issue a JWT session containing clinician id and role for downstream authorization checks."},
    {"text": "- FR-1.4: Session renewal shall occur transparently for active users; idle sessions >30 minutes shall require reauthentication."},
    {"text": "- FR-1.5: Role-based access control shall restrict dashboard, meeting mode, and write APIs to authorized roles only."},
    {"text": "3.2 SF-2 \u2013 Patient Case Intake Wizard", "style": "Heading2"},
    {"text": "Description: Multi-step responsive wizard that captures demographics, vitals, labs, risk scores, specialist opinions, and uploads."},
    {"text": "Functional Requirements", "style": "Heading3"},
    {"text": "- FR-2.1: Wizard shall autosave draft inputs per step to prevent data loss on refresh."},
    {"text": "- FR-2.2: Template selection shall pre-populate default agents, risk scores, and meeting metadata."},
    {"text": "- FR-2.3: Inputs shall be validated client and server side via zod schemas; invalid fields show inline guidance."},
    {"text": "- FR-2.4: File uploads (PDF, DICOM summaries, images) shall be virus-scanned and stored as secure blobs linked to the case."},
    {"text": "- FR-2.5: Specialist views array shall support at least 5 entries, each with name, specialty, and opinion text."},
    {"text": "3.3 SF-3 \u2013 Template Launcher & Case Library", "style": "Heading2"},
    {"text": "Description: Provide curated templates (Oncology, Heart Team, Multimorbidity, General MDT) and searchable case tables."},
    {"text": "Functional Requirements", "style": "Heading3"},
    {"text": "- FR-3.1: Template catalog shall display description, case type, meeting type, default agents, and risk scores."},
    {"text": "- FR-3.2: Selecting a template shall create a new case with pre-set metadata while allowing clinician edits before submission."},
    {"text": "- FR-3.3: Dashboard list shall support filtering by status (pending, analyzing, consensus_ready, confirmed) and sort by created date."},
    {"text": "- FR-3.4: Case detail view shall expose patient id, diagnosis, timeline, and CTA to start debate once intake is complete."},
    {"text": "3.4 SF-4 \u2013 AI Debate Orchestration", "style": "Heading2"},
    {"text": "Description: Execute multi-agent analysis through runDebate, streaming intermediate events to the UI via Server-Sent Events."},
    {"text": "Functional Requirements", "style": "Heading3"},
    {"text": "- FR-4.1: Invoking POST /api/cases/[id]/analyze shall validate session, ensure case not confirmed, and lock status=\"analyzing\"."},
    {"text": "- FR-4.2: The system shall resolve agent roster from template slug or case type fallback list."},
    {"text": "- FR-4.3: Each agent invocation shall iterate through MODEL_CHAIN with retry handling for 404/429 responses and surface failures in SSE."},
    {"text": "- FR-4.4: Moderator synthesis shall only begin after all agent promises resolve; consensus JSON must conform to ConsensusReport type."},
    {"text": "- FR-4.5: On success, patientCase shall persist agentResponses, consensusReport, and transition to status=\"consensus_ready\"; on error revert to pending."},
    {"text": "3.5 SF-5 \u2013 Consensus Review & Export", "style": "Heading2"},
    {"text": "Description: Render debate results, highlight conflicts, and provide PDF/print exports for documentation."},
    {"text": "Functional Requirements", "style": "Heading3"},
    {"text": "- FR-5.1: Case detail page shall visualize agent cards with confidence, recommendations, and evidence snippets."},
    {"text": "- FR-5.2: Consensus panel shall display recommendation, confidence score, evidence strength, treatment options, safety alerts, and dissenting views."},
    {"text": "- FR-5.3: React-PDF export shall generate a one-page summary with hospital branding, timestamp, attending list, and signature slots."},
    {"text": "- FR-5.4: Clinicians shall acknowledge safety alerts before confirming plan."},
    {"text": "3.6 SF-6 \u2013 Meeting Mode & Audit Trail", "style": "Heading2"},
    {"text": "Description: Fullscreen meeting UI that captures attendees, final decisions, and locks confirmed cases."},
    {"text": "Functional Requirements", "style": "Heading3"},
    {"text": "- FR-6.1: Meeting mode shall present debate summary with toggles per agent and ability to pin key talking points."},
    {"text": "- FR-6.2: Attendance form shall require at least one surgeon and one medical oncologist for Oncology templates; validation rules are template-aware."},
    {"text": "- FR-6.3: Confirming plan shall update patientCase.status to \"confirmed\", append audit log entries, and disable re-analysis."},
    {"text": "- FR-6.4: Meeting log shall be immutable; edits create new entries with timestamps and editor identity."},
    {"text": "3.7 SF-7 \u2013 Operations, Observability, and Compliance", "style": "Heading2"},
    {"text": "Description: Provide runtime monitoring, configuration, and compliance hooks."},
    {"text": "Functional Requirements", "style": "Heading3"},
    {"text": "- FR-7.1: System shall emit structured logs for authentication, case lifecycle events, agent failures, and moderator errors."},
    {"text": "- FR-7.2: Secrets management shall leverage environment variables injected by the hosting platform; secrets must never be logged."},
    {"text": "- FR-7.3: Administrators shall be able to download CSV reports of confirmed cases filtered by date range."},
    {"text": "- FR-7.4: Feature flags shall allow disabling live agent calls and forcing deterministic responses for demos/testing."},
    {"text": ""},
    {"text": "4. External Interface Requirements", "style": "Heading1"},
    {"text": "4.1 User Interface", "style": "Heading2"},
    {"text": "- Responsive Next.js App Router pages with shadcn-inspired primitives, dark-on-light palette, and accessibility targets (WCAG 2.1 AA)."},
    {"text": "- Dashboard cards summarize pending, consensus ready, and confirmed counts with CTA to create cases."},
    {"text": "- Case wizard employs progress indicator, contextual help, and autosave cues."},
    {"text": "- Debate view streams agent progress with skeleton loaders, toasts for failures, and sticky consensus summary."},
    {"text": "4.2 API Interfaces", "style": "Heading2"},
    {"text": "- POST /api/auth/[...nextauth]: Handles credential login/logout via NextAuth."},
    {"text": "- GET/POST /api/cases: CRUD for patient cases (authenticated)."},
    {"text": "- POST /api/cases/[id]/analyze: Launches AI debate; responds as text/event-stream."},
    {"text": "- GET /api/templates: Returns available case templates with agent metadata."},
    {"text": "- POST /api/upload: Secure file upload endpoint with MIME validation (future iteration)."},
    {"text": "4.3 Data Interfaces", "style": "Heading2"},
    {"text": "- Prisma ORM mediates all PostgreSQL access; referential integrity enforced through schema.prisma."},
    {"text": "- File attachments stored in cloud blob storage (S3-compatible) with signed URLs persisted in the database."},
    {"text": "4.4 Authentication & Authorization Interfaces", "style": "Heading2"},
    {"text": "- NextAuth Credentials provider with bcrypt verification and JWT callbacks (see src/lib/auth.ts)."},
    {"text": "- Middleware restricts /dashboard, /cases, /meeting routes to authenticated users; unauthenticated requests redirect to /login."},
    {"text": "- Session object exposes user.id and user.role for component-level guards."},
    {"text": "4.5 Error Handling & Notifications", "style": "Heading2"},
    {"text": "- API errors return JSON with message and HTTP status codes (401, 404, 409, 500)."},
    {"text": "- UI shall surface toast notifications for debate failures, validation errors, and status transitions."},
    {"text": "- SSE stream emits \"agent_failed\" and \"error\" events with descriptive payloads."},
    {"text": ""},
    {"text": "5. System Architecture", "style": "Heading1"},
    {"text": "5.1 Logical Components", "style": "Heading2"},
    {"text": "- Next.js App Router (RSC + client components) for UI, wizard, debate visualization, and meeting mode."},
    {"text": "- API layer (app/api) hosting authentication, case CRUD, file upload, and analyze routes."},
    {"text": "- Prisma data layer managing Doctor, PatientCase, AgentResponse, ConsensusReport, MeetingLog, and Attachment entities."},
    {"text": "- AI orchestration layer (src/lib/agents) handling agent prompts, retries, moderator synthesis, and event fan-out."},
    {"text": "- React-PDF export service generating single-page summaries."},
    {"text": "5.2 Deployment View", "style": "Heading2"},
    {"text": "- Recommended topology: Vercel or containerized Next.js server + managed PostgreSQL (e.g., Neon, Supabase) + secrets manager."},
    {"text": "- Optional worker tier for long-running debates if future load requires offloading from API route."},
    {"text": "5.3 Technology Stack", "style": "Heading2"},
    {"text": "- Frontend: Next.js 14, React 19, Tailwind CSS, shadcn primitives."},
    {"text": "- Backend: Next.js API routes, NextAuth, Prisma, PostgreSQL, Multer for uploads."},
    {"text": "- AI: Anthropic Claude via OpenRouter SDK (MODEL_CHAIN fallback list)."},
    {"text": "- Tooling: TypeScript, ESLint, Docker Compose for local Postgres."},
    {"text": "5.4 Diagram 1: System Context", "style": "Heading2"},
    {"text": "                +-------------------+", "preserve": True},
    {"text": "                | Clinician Browser |", "preserve": True},
    {"text": "                +---------+---------+", "preserve": True},
    {"text": "                          |  HTTPS (RSC + SSE)", "preserve": True},
    {"text": "                +---------v---------+", "preserve": True},
    {"text": "                |   Next.js App     |", "preserve": True},
    {"text": "                | (UI + API routes) |", "preserve": True},
    {"text": "                +----+--------+-----+", "preserve": True},
    {"text": "                     |        |", "preserve": True},
    {"text": "             Prisma ORM   NextAuth JWT", "preserve": True},
    {"text": "                     |        |", "preserve": True},
    {"text": "          +----------v-+   +-v-------------------+", "preserve": True},
    {"text": "          | PostgreSQL |   | Hospital IAM / SSO? |", "preserve": True},
    {"text": "          +----------+-+   +---------------------+", "preserve": True},
    {"text": "                     |", "preserve": True},
    {"text": "          +----------v-----------+", "preserve": True},
    {"text": "          | Anthropic/OpenRouter |", "preserve": True},
    {"text": "          |   Agent Services     |", "preserve": True},
    {"text": "          +----------------------+", "preserve": True},
    {"text": "5.5 Diagram 2: Logical Component Interaction", "style": "Heading2"},
    {"text": "[Clinician UI] -> start debate CTA", "preserve": True},
    {"text": "    -> [Analyze API] validates session & case state", "preserve": True},
    {"text": "    -> [runDebate] resolves agents & invokes OpenRouter", "preserve": True},
    {"text": "    -> [Prisma] persists status updates + responses", "preserve": True},
    {"text": "    -> [SSE Stream] emits agent_started/completed/moderator events", "preserve": True},
    {"text": "    -> [UI] updates progress, consensus, and alerts", "preserve": True},
    {"text": ""},
    {"text": "6. Data Design", "style": "Heading1"},
    {"text": "6.1 Entity Overview", "style": "Heading2"},
    {"text": "- Doctor: id (UUID), name, email (unique), role (enum), password hash, createdAt."},
    {"text": "- PatientCase: id, patientId, age, sex, weight, diagnosis, caseType, meetingType, comorbidities[], medications[], labResults JSON, imagingSummary, biopsyResults, riskScores JSON, specialistViews JSON, templateSlug, uploads JSON, status, createdAt, updatedAt."},
    {"text": "- AgentResponse: agent, recommendation, confidence_score, key_evidence[], risks_identified[], treatment_conflicts_flagged[], consensus_position."},
    {"text": "- ConsensusReport: consensus_recommendation, confidence_score, evidence_strength, treatment_options_ranked[], agent_agreement_summary, safety_alerts[], dissenting_views[], time_sensitivity, suggested_next_steps[], unavailable_agents[]."},
    {"text": "- MeetingLog: caseId FK, attendees[], finalPlan, lockedBy, lockedAt."},
    {"text": "- Attachment: id, caseId FK, filename, mimetype, storageUrl, uploadedBy, checksum."},
    {"text": "6.2 Data Relationships", "style": "Heading2"},
    {"text": "- Doctor 1..n PatientCase (creator/owner)."},
    {"text": "- PatientCase 1..n Attachment."},
    {"text": "- PatientCase 1..1 ConsensusReport (embedded JSON)."},
    {"text": "- PatientCase 1..n MeetingLog entries."},
    {"text": "6.3 Data Retention & Governance", "style": "Heading2"},
    {"text": "- Retain confirmed cases for >=7 years (regulatory)."},
    {"text": "- Provide soft deletion for draft cases; confirmed cases immutable."},
    {"text": "- Encrypt data at rest via managed Postgres and storage provider; enforce TLS in transit."},
    {"text": ""},
    {"text": "7. Non-Functional Requirements", "style": "Heading1"},
    {"text": "- Performance: Dashboard list (<=25 rows) shall load <2s over 50th percentile network; debate SSE heartbeat every 2s max."},
    {"text": "- Scalability: Support 50 concurrent debates by horizontally scaling Next.js server or offloading to background workers."},
    {"text": "- Availability: Target 99.5% monthly uptime with graceful degradation when AI provider unavailable."},
    {"text": "- Security: Enforce HTTPS, HTTPOnly cookies, bcrypt hashing, rate limiting on auth endpoints, and audit logging for PHI access."},
    {"text": "- Compliance: Maintain traceability between requirements and implementation; support export for regulatory review."},
    {"text": "- Usability: Support keyboard navigation, screen readers, and color contrast ratio >=4.5:1."},
    {"text": "- Maintainability: Codebase documented via README + docs; linting and type checks required in CI; feature flags for AI integrations."},
    {"text": "- Observability: Centralized logging with correlation ids per case/debate; expose metrics (debate duration, agent failures)."},
    {"text": ""},
    {"text": "8. Behavioral Diagrams & Scenarios", "style": "Heading1"},
    {"text": "8.1 Diagram 3: High-Level Use Case", "style": "Heading2"},
    {"text": "           +-----------------+", "preserve": True},
    {"text": "           |   Clinician     |", "preserve": True},
    {"text": "           +---------+-------+", "preserve": True},
    {"text": "                     |", "preserve": True},
    {"text": "        [Login/Register]\u2014\u2014>", "preserve": True},
    {"text": "                     |", "preserve": True},
    {"text": "        [Create/Import Case]\u2014\u2014>", "preserve": True},
    {"text": "                     |", "preserve": True},
    {"text": "        [Start Debate]\u2014\u2014>", "preserve": True},
    {"text": "                     |", "preserve": True},
    {"text": "        [Review Consensus]\u2014\u2014>", "preserve": True},
    {"text": "                     |", "preserve": True},
    {"text": "        [Meeting Mode & Confirm]\u2014\u2014>", "preserve": True},
    {"text": "                     |", "preserve": True},
    {"text": "        [Export PDF / Audit]\u2014\u2014>", "preserve": True},
    {"text": "8.2 Diagram 4: Start Debate Sequence", "style": "Heading2"},
    {"text": "Clinician UI -> /cases/[id]: Click \"Start Debate\"", "preserve": True},
    {"text": "UI -> API /api/cases/[id]/analyze: POST payload id", "preserve": True},
    {"text": "API -> Session middleware: authorize user", "preserve": True},
    {"text": "API -> Prisma: set status=analyzing", "preserve": True},
    {"text": "API -> runDebate: build payload & resolve agents", "preserve": True},
    {"text": "runDebate -> OpenRouter: invoke agent models (with retries)", "preserve": True},
    {"text": "runDebate -> SSE stream: emit agent_started/completed", "preserve": True},
    {"text": "runDebate -> Moderator model: synthesize consensus", "preserve": True},
    {"text": "API -> Prisma: persist agentResponses + consensusReport + status=consensus_ready", "preserve": True},
    {"text": "SSE -> UI: emit complete event", "preserve": True},
    {"text": "UI: update dashboard, unlock meeting mode", "preserve": True},
    {"text": "8.3 Diagram 5: Data Flow Overview", "style": "Heading2"},
    {"text": "[Clinician Input] -> [Next.js Forms] -> [Prisma DTO] -> [PostgreSQL]", "preserve": True},
    {"text": "[PostgreSQL Case] -> [runDebate Payload] -> [AI Agents] -> [Responses JSON] -> [ConsensusReport]", "preserve": True},
    {"text": "[ConsensusReport] -> [UI Rendering] -> [React-PDF Export] -> [Regulatory Archive]", "preserve": True},
    {"text": ""},
    {"text": "9. Implementation Plan & Future Enhancements", "style": "Heading1"},
    {"text": "- Phase 1: Harden authentication, finalize Prisma schema, build case wizard MVP."},
    {"text": "- Phase 2: Integrate real Anthropic/OpenRouter keys, optimize SSE reliability, implement meeting mode."},
    {"text": "- Phase 3: Add EHR integrations (FHIR), scheduling/notifications, advanced analytics, offline/mobile support."},
    {"text": ""},
    {"text": "10. Acceptance Criteria & Traceability", "style": "Heading1"},
    {"text": "- Each functional requirement FR-x.y maps to corresponding user stories and automated tests (unit/integration/end-to-end)."},
    {"text": "- Definition of Done includes: code reviewed, lint/type checks pass, tests updated, documentation (README/docs/SRS) refreshed."},
    {"text": "- Critical path: authentication, case intake, debate orchestration, consensus visualization, meeting lock must be demonstrated end-to-end."},
    {"text": ""},
    {"text": "11. Appendices", "style": "Heading1"},
    {"text": "Appendix A \u2013 Open Issues", "style": "Heading2"},
    {"text": "- Need decision on long-term storage for uploads (S3 vs on-prem)."},
    {"text": "- Determine if hospital IAM (SAML/OIDC) should replace credentials provider."},
    {"text": "- Clarify regulatory reviewer workflow for signed PDFs."},
    {"text": "Appendix B \u2013 Risks", "style": "Heading2"},
    {"text": "- AI provider outage could delay debates; mitigation: caching of prior consensus, deterministic fallback copy."},
    {"text": "- Data quality risk if labs/comorbidities manually entered; mitigation: validation rules, optional FHIR import."},
    {"text": "- Change management risk for clinicians; mitigation: training mode with sandbox data."},
]


def paragraph_xml(entry: dict[str, str | bool | None]) -> str:
    text = entry.get("text", "") or ""
    style = entry.get("style")
    preserve = bool(entry.get("preserve"))

    if not text:
        return "<w:p/>"

    attrs = " xml:space=\"preserve\"" if preserve or text.startswith(" ") or text.endswith(" ") else ""
    run = f"<w:r><w:t{attrs}>{escape(text)}</w:t></w:r>"
    if style:
        return f"<w:p><w:pPr><w:pStyle w:val=\"{style}\"/></w:pPr>{run}</w:p>"
    return f"<w:p>{run}</w:p>"


def build_document_xml(paragraphs: list[dict[str, str | bool | None]]) -> str:
    body_content = "\n".join(paragraph_xml(p) for p in paragraphs)
    sect_pr = (
        "<w:sectPr>"
        "<w:pgSz w:w=\"12240\" w:h=\"15840\"/>"
        "<w:pgMar w:top=\"1440\" w:right=\"1440\" w:bottom=\"1440\" w:left=\"1440\" w:header=\"720\" w:footer=\"720\" w:gutter=\"0\"/>"
        "<w:cols w:space=\"720\"/>"
        "<w:docGrid w:linePitch=\"360\"/>"
        "</w:sectPr>"
    )
    return (
        "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>"
        "<w:document xmlns:wpc=\"http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas\""
        " xmlns:mc=\"http://schemas.openxmlformats.org/markup-compatibility/2006\""
        " xmlns:o=\"urn:schemas-microsoft-com:office:office\""
        " xmlns:r=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships\""
        " xmlns:m=\"http://schemas.openxmlformats.org/officeDocument/2006/math\""
        " xmlns:v=\"urn:schemas-microsoft-com:vml\""
        " xmlns:wp14=\"http://schemas.microsoft.com/office/word/2010/wordprocessingDrawing\""
        " xmlns:wp=\"http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing\""
        " xmlns:w10=\"urn:schemas-microsoft-com:office:word\""
        " xmlns:w=\"http://schemas.openxmlformats.org/wordprocessingml/2006/main\""
        " xmlns:w14=\"http://schemas.microsoft.com/office/word/2010/wordml\""
        " xmlns:wpg=\"http://schemas.microsoft.com/office/word/2010/wordprocessingGroup\""
        " xmlns:wpi=\"http://schemas.microsoft.com/office/word/2010/wordprocessingInk\""
        " xmlns:wne=\"http://schemas.microsoft.com/office/word/2006/wordml\""
        " xmlns:wps=\"http://schemas.microsoft.com/office/word/2010/wordprocessingShape\""
        " mc:Ignorable=\"w14 wp14\">"
        f"<w:body>{body_content}{sect_pr}</w:body></w:document>"
    )


content_types_xml = (
    "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>"
    "<Types xmlns=\"http://schemas.openxmlformats.org/package/2006/content-types\">"
    "<Default Extension=\"rels\" ContentType=\"application/vnd.openxmlformats-package.relationships+xml\"/>"
    "<Default Extension=\"xml\" ContentType=\"application/xml\"/>"
    "<Override PartName=\"/word/document.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml\"/>"
    "</Types>"
)

rels_xml = (
    "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>"
    "<Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\">"
    "<Relationship Id=\"rId1\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument\" Target=\"word/document.xml\"/>"
    "</Relationships>"
)


def build_docx() -> None:
    document_xml = build_document_xml(paragraphs)
    with zipfile.ZipFile(output_path, "w", compression=zipfile.ZIP_DEFLATED) as docx:
        docx.writestr("[Content_Types].xml", content_types_xml)
        docx.writestr("_rels/.rels", rels_xml)
        docx.writestr("word/document.xml", document_xml)
    print(f"SRS document written to {output_path}")


if __name__ == "__main__":
    build_docx()
