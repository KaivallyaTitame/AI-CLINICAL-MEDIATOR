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
  patientId: z.string().optional(),
  age: z.coerce.number().int().min(0).max(120),
  sex: z.string().min(1),
  weight: z.coerce.number().min(0).max(500).optional(),
  diagnosis: z.string().min(5),
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
