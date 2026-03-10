# AI Clinical Mediator

## 1. Project Overview
AI Clinical Mediator is a multi-agent clinical decision support platform designed for hospital Multidisciplinary Team (MDT) meetings. Specialist AI personas analyze a patient case in parallel, debate guideline-backed interventions, and produce a structured consensus report that clinicians can review, annotate, and confirm. The system blends secure clinician workflows (auth, audit trail, meeting logs) with real-time AI orchestration to accelerate complex care planning.

## 2. Why This Project Was Created
Modern hospitals conduct MDT/Heart Team boards multiple times per week, but each meeting requires extensive manual preparation—collecting labs, compiling imaging summaries, and aligning specialists on the latest evidence. This project was built to automate case preparation, surface high-fidelity guideline insights, and reduce decision latency when multiple specialties must co-sign a treatment plan.

## 3. Problem Statement
Clinical teams lack a unified, interactive workspace where AI can reason alongside humans about high-risk cases. Existing EMR add-ons offer static checklists or single-model summaries, leaving surgeons and oncologists to reconcile conflicting recommendations manually. The absence of real-time debate tooling limits both the speed and quality of MDT conclusions.

## 4. Problems in the Current System
1. **Fragmented data collection** – Labs, imaging, pathology, and specialist notes reside in separate silos, increasing prep time.
2. **Single-perspective AI** – Most CDS tools produce one-shot suggestions without highlighting dissenting views or evidence gaps.
3. **Opaque decision trail** – Many MDT decisions are captured in free text without structured audits, making retrospective review difficult.
4. **Limited collaboration tooling** – Live debates are not captured or visualized for absent clinicians, and meeting decisions are not locked with clear accountability.
5. **Manual export burden** – Generating PDFs or summaries for regulatory compliance requires repetitive formatting work.

## 5. How the Project Solves These Problems
- **Multi-agent debate engine** (`/api/cases/[id]/analyze`) runs Anthropic Claude personas (surgeon, interventional cardiologist, pharmacologist, etc.) concurrently, exposing agreement and dissent in real time.
- **Structured intake wizard** captures demographics, labs, risk scores, uploads, and prior opinions so the AI agents receive a complete context package.
- **Consensus moderator** synthesizes conflicts, evidence strength, safety alerts, and ranked options into a JSON document rendered on the case page and exportable via React-PDF.
- **NextAuth-secured dashboard** enforces clinician roles, while Prisma + PostgreSQL persist audit trails and meeting confirmations.
- **Meeting mode** provides a fullscreen UI with agent toggles and lockable MDT confirmation log, creating a traceable decision history.

## 6. Key Features
1. Role-based clinician authentication and onboarding.
2. Template-driven case wizard for Oncology, Heart Team, Multimorbidity, and general MDT triage scenarios.
3. Real-time Server-Sent Events streaming debate progress per agent.
4. Moderator agent summarizing conflicts, evidence strength, safety alerts, and suggested next steps.
5. Case detail dashboard with dissent tracking, ranked treatment options, and PDF export.
6. Meeting mode with attendance capture, final plan confirmation, and audit lock.
7. Deterministic fallback responses when Anthropic API is unavailable, ensuring demo stability.

## 7. Target Users
- **Cardiothoracic and vascular surgeons** needing rapid evaluation of surgical candidacy.
- **Medical and radiation oncologists** coordinating multimodal cancer care.
- **Interventional cardiologists and electrophysiologists** weighing PCI vs. CABG strategies.
- **Clinical pharmacists and endocrinologists** auditing drug interactions and metabolic risks.
- **Hospital MDT coordinators and quality officers** responsible for documentation, compliance, and meeting facilitation.

## 8. Technologies Used
- **Next.js 14 App Router** with React Server Components for the web experience.
- **TypeScript** end-to-end for type safety.
- **Tailwind CSS + shadcn-inspired primitives** for UI composition.
- **NextAuth (JWT strategy)** for secure clinician authentication.
- **Prisma ORM + PostgreSQL** deployed via Docker for case persistence and audit trails.
- **Anthropic Claude (claude-sonnet-4-20250514)** via `@anthropic-ai/sdk` for agent orchestration.
- **React-PDF** for 1-page consensus exports.

## 9. Expected Benefits
- **Faster MDT preparation** through structured intake and automated evidence retrieval.
- **Higher-quality decisions** driven by transparent debates that expose risk trade-offs and dissenting views.
- **Improved compliance** via immutable audit logs, meeting confirmations, and standardized PDF summaries.
- **Scalable expertise** because AI personas cover multiple specialties even when human experts are unavailable.
- **Operational efficiency** by reducing manual data collation and documentation overhead.

## 10. Future Improvements
1. **EHR integration** (FHIR, HL7) to auto-ingest demographic and lab data directly from hospital systems.
2. **Scheduling & notifications** so MDT members receive reminders and can join debates asynchronously.
3. **Explainable AI overlays** highlighting which guideline citations drove each recommendation.
4. **Adaptive agent rosters** that swap personas based on case metadata and prior outcomes.
5. **Advanced analytics** on debate outcomes, surgeon adoption, and patient follow-up to close the feedback loop.
6. **Offline-ready mobile client** for bedside review and rapid plan confirmation.

## 11. Conclusion
AI Clinical Mediator transforms the traditional MDT workflow by coupling structured clinician input with multi-agent AI debate, ensuring every complex case benefits from comprehensive, evidence-backed collaboration. The platform is engineered for real-world hospital deployments where auditability, security, and clinician trust are paramount.
