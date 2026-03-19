import { z } from "zod";

export const specialistOpinionSchema = z.object({
  specialist: z.string().min(1, "Specialist is required"),
  opinion: z.string().min(1, "Opinion is required"),
});

export const uploadReferenceSchema = z.object({
  name: z.string().min(1),
  type: z.string().min(1),
  content: z.string().min(1),
});

export const patientCaseSchema = z.object({
  patientId: z
    .string()
    .min(1, "Patient ID is required")
    .max(20, "Patient ID must be at most 20 characters")
    .regex(/^[a-zA-Z0-9-]+$/, "Only alphanumeric characters and hyphens allowed"),
  age: z.coerce.number().int().min(0).max(120),
  sex: z.string().min(1),
  weight: z.coerce.number().min(0).max(500).optional(),
  diagnosis: z.string().min(5),
  icd10Code: z.string().optional(),
  caseType: z.string().min(1),
  comorbidities: z.array(z.string()).default([]),
  medications: z.array(z.string()).default([]),
  labResults: z.record(z.string(), z.string()).default({}),
  imagingSummary: z.string().optional(),
  biopsyResults: z.string().optional(),
  riskScores: z.record(z.string(), z.string()).default({}),
  specialistViews: z.array(specialistOpinionSchema).default([]),
  meetingType: z.string().min(1),
  templateSlug: z.string().optional(),
  uploads: z.array(uploadReferenceSchema).default([]),
});

export const extractedLabSchema = z.object({
  name: z.string(),
  value: z.string(),
  unit: z.string(),
  referenceRange: z.string().nullable(),
});

export const extractedConfidenceSchema = z.object({
  primaryDiagnosis: z.number().min(0).max(1),
  medications: z.number().min(0).max(1),
  labs: z.number().min(0).max(1),
  imagingSummary: z.number().min(0).max(1),
  biopsyPathology: z.number().min(0).max(1),
  specialistOpinions: z.number().min(0).max(1),
  overall: z.number().min(0).max(1),
});

export const extractedSpecialistOpinionSchema = z.object({
  specialty: z.string(),
  clinicianName: z.string().nullable(),
  summary: z.string(),
});

export const extractedCaseDataSchema = z.object({
  primaryDiagnosis: z.string().nullable(),
  icd10Code: z.string().nullable(),
  patientAge: z.number().nullable(),
  patientSex: z.enum(["Male", "Female", "Other"]).nullable(),
  medications: z.array(z.string()),
  labs: z.array(extractedLabSchema),
  imagingSummary: z.string().nullable(),
  biopsyPathology: z.string().nullable(),
  specialistOpinions: z.array(extractedSpecialistOpinionSchema),
  riskFactors: z.array(z.string()),
  confidence: extractedConfidenceSchema,
  sourceDocuments: z.array(z.string()),
  extractionWarnings: z.array(z.string()),
});

export type ExtractedCaseData = z.infer<typeof extractedCaseDataSchema>;

export const riskScoreSchema = z.object({
  name: z.string(),
  value: z.string(),
  tier: z.enum(["Low", "Intermediate", "High"]),
  rationale: z.string(),
});

export const riskScoresResponseSchema = z.array(riskScoreSchema);

export type ComputedRiskScore = z.infer<typeof riskScoreSchema>;

export const drugInteractionSchema = z.object({
  drug1: z.string(),
  drug2: z.string(),
  severity: z.enum(["Major", "Moderate", "Minor"]),
  description: z.string(),
});

export const drugInteractionsResponseSchema = z.array(drugInteractionSchema);

export type DrugInteraction = z.infer<typeof drugInteractionSchema>;

export const registerSchema = z.object({
  name: z.string().min(2),
  email: z.email(),
  password: z.string().min(8),
  role: z.string().min(1),
});

export const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(8),
});

export const confirmCaseSchema = z.object({
  confirmedBy: z.array(z.string().min(1)).min(1),
  finalPlan: z.string().min(5),
});
