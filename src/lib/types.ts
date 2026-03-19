export type DoctorRole =
  | "Surgeon"
  | "Oncologist"
  | "Radiologist"
  | "Cardiologist"
  | "General Physician"
  | "Pharmacologist"
  | "Endocrinologist";

export type CaseStatus = "pending" | "analyzing" | "consensus_ready" | "confirmed";

export type AgentResponse = {
  agent: string;
  recommendation: string;
  confidence_score: number;
  key_evidence: string[];
  risks_identified: string[];
  treatment_conflicts_flagged: string[];
  consensus_position: string;
  error?: string;
};

export type RankedTreatmentOption = {
  option: string;
  score: number;
  rationale: string;
  citations: string[];
};

export type ConsensusReport = {
  consensus_recommendation: string;
  confidence_score: number;
  evidence_strength: "High" | "Moderate" | "Low";
  treatment_options_ranked: RankedTreatmentOption[];
  agent_agreement_summary: string;
  safety_alerts: string[];
  dissenting_views: string[];
  time_sensitivity: "Urgent" | "Standard" | "Elective";
  suggested_next_steps: string[];
  unavailable_agents?: string[];
};

export type PatientCasePayload = {
  patientId: string;
  age: number;
  sex: string;
  weight?: number;
  diagnosis: string;
  icd10Code?: string;
  caseType: string;
  comorbidities: string[];
  medications: string[];
  labResults: Record<string, string>;
  imagingSummary?: string;
  biopsyResults?: string;
  riskScores: Record<string, string>;
  specialistViews: Array<{ specialist: string; opinion: string }>;
  meetingType: string;
  templateSlug?: string;
  uploads?: Array<{ name: string; type: string; content: string }>;
};
