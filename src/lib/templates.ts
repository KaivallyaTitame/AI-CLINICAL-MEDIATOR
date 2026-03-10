export const CASE_TEMPLATES = [
  {
    slug: "oncology-borderline-treatment",
    name: "Oncology: Borderline Treatment",
    description: "Complex oncology board discussion with surgery, medical oncology, and radiation trade-offs.",
    caseType: "Oncology",
    meetingType: "Tumor Board",
    agents: ["AI Surgeon", "AI Oncologist", "AI Radiation Oncologist"],
    riskScores: ["ECOG", "TNM Stage"],
  },
  {
    slug: "heart-team",
    name: "Heart Team: Stent vs. Surgery",
    description: "Structured interventional vs surgical review for revascularization planning.",
    caseType: "Cardiology",
    meetingType: "Heart Team",
    agents: ["AI Interventional Cardiologist", "AI Cardiac Surgeon", "AI Clinical Pharmacologist"],
    riskScores: ["SYNTAX Score", "STS Score"],
  },
  {
    slug: "multimorbidity-safety-review",
    name: "Multimorbidity Safety Review",
    description: "Medication and organ-function safety review across specialties.",
    caseType: "Multimorbidity",
    meetingType: "Multimorbidity Review",
    agents: ["AI Oncologist", "AI Cardiologist", "AI Clinical Pharmacologist", "AI Endocrinologist"],
    riskScores: ["eGFR", "HbA1c", "LVEF"],
  },
  {
    slug: "mdt-meeting-prep",
    name: "MDT Meeting Prep (Triage)",
    description: "Broad triage template that auto-selects relevant specialists from the case type.",
    caseType: "General MDT",
    meetingType: "General MDT",
    agents: ["AI General Physician"],
    riskScores: ["Auto-detected"],
  },
] as const;

export function getTemplateBySlug(slug?: string | null) {
  return CASE_TEMPLATES.find((template) => template.slug === slug) ?? null;
}
