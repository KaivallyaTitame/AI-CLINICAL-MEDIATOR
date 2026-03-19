"use client";

import { type MouseEvent, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { patientCaseSchema } from "@/lib/validation";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { getTemplateBySlug } from "@/lib/templates";
import type { PatientCasePayload } from "@/lib/types";
import type { ComputedRiskScore, DrugInteraction, ExtractedCaseData } from "@/lib/validation";

const COMORBIDITIES = ["Diabetes", "Heart Disease", "Hypertension", "CKD", "COPD", "Obesity", "Hyperlipidemia"];
const CASE_TYPES = ["Oncology", "Cardiology", "Multimorbidity", "General MDT"];
const MEETING_TYPES = ["Tumor Board", "Heart Team", "Multimorbidity Review", "General MDT"];

type CaseWizardValues = z.infer<typeof patientCaseSchema>;

const STEPS = ["Patient Profile", "Risk & Labs", "Opinion & Files"] as const;

const STEP_FIELD_MAP: Record<(typeof STEPS)[number], Array<keyof CaseWizardValues>> = {
  "Patient Profile": ["patientId", "age", "sex", "diagnosis"],
  "Risk & Labs": [],
  "Opinion & Files": [],
};

// --- Tooltip component ---
function Tooltip({ text }: { text: string }) {
  const [show, setShow] = useState(false);
  return (
    <span className="relative ml-1 inline-block cursor-help" onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-slate-200 text-[10px] font-bold text-slate-600">i</span>
      {show && (
        <span className="absolute bottom-6 left-1/2 z-50 w-60 -translate-x-1/2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 shadow-lg">
          {text}
        </span>
      )}
    </span>
  );
}

// --- Confidence dot component ---
function ConfidenceDot({ score }: { score: number }) {
  const color = score > 0.85 ? "bg-emerald-500" : score >= 0.6 ? "bg-amber-400" : "bg-rose-500";
  const label = `${Math.round(score * 100)}%`;
  return (
    <span className="group relative ml-1 inline-block">
      <span className={`inline-block h-2.5 w-2.5 rounded-full ${color}`} />
      <span className="absolute bottom-4 left-1/2 z-50 hidden -translate-x-1/2 whitespace-nowrap rounded bg-slate-800 px-2 py-1 text-[10px] text-white group-hover:block">
        Confidence: {label}
      </span>
    </span>
  );
}

export function CaseWizard() {
  const router = useRouter();
  const params = useSearchParams();
  const templateSlug = params.get("template");
  const template = getTemplateBySlug(templateSlug);

  const [step, setStep] = useState(0);
  const [labEntries, setLabEntries] = useState<Array<{ key: string; value: string; ai?: boolean }>>([]);
  const [riskScores, setRiskScores] = useState<ComputedRiskScore[]>([]);
  const [riskLoading, setRiskLoading] = useState(false);
  const [specialistViews, setSpecialistViews] = useState<Array<{ specialist: string; opinion: string; ai?: boolean; source?: string }>>([]);
  const [uploadRefs, setUploadRefs] = useState<Array<{ name: string; type: string; content: string }>>([]);
  const [medicationsInput, setMedicationsInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [validationBanner, setValidationBanner] = useState<string | null>(null);
  const [shakeFields, setShakeFields] = useState(false);
  const [stepsCompleted, setStepsCompleted] = useState<boolean[]>([false, false, false]);

  // Speech-to-text state
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  // ICD-10 state
  const [icd10Query, setIcd10Query] = useState("");
  const [icd10Results, setIcd10Results] = useState<Array<{ code: string; description: string }>>([]);
  const [showIcd10Dropdown, setShowIcd10Dropdown] = useState(false);
  const [icd10Error, setIcd10Error] = useState(false);

  // Drug interaction state
  const [interactions, setInteractions] = useState<DrugInteraction[]>([]);
  const [interactionsLoading, setInteractionsLoading] = useState(false);
  const [interactionsChecked, setInteractionsChecked] = useState(false);
  const interactionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Lab upload state
  const [labUploadLoading, setLabUploadLoading] = useState(false);

  // Imaging/Biopsy upload state
  const [imagingUploadLoading, setImagingUploadLoading] = useState(false);
  const [biopsyUploadLoading, setBiopsyUploadLoading] = useState(false);
  const [imagingSource, setImagingSource] = useState<string | null>(null);
  const [biopsySource, setBiopsySource] = useState<string | null>(null);

  // Specialist upload state
  const [specialistUploadLoading, setSpecialistUploadLoading] = useState(false);

  // Master upload state
  const [masterFiles, setMasterFiles] = useState<File[]>([]);
  const [masterExtracting, setMasterExtracting] = useState(false);
  const [masterProgress, setMasterProgress] = useState(0);
  const [extractedConfidence, setExtractedConfidence] = useState<ExtractedCaseData["confidence"] | null>(null);
  const [autoFilledFields, setAutoFilledFields] = useState<string[]>([]);
  const [showExtractedReview, setShowExtractedReview] = useState(false);

  // Autosave state
  const [draftSaved, setDraftSaved] = useState(false);
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resolver = zodResolver(patientCaseSchema) as Resolver<CaseWizardValues>;

  const form = useForm<CaseWizardValues>({
    resolver,
    defaultValues: {
      patientId: "",
      age: 60,
      sex: "Male",
      weight: 70,
      diagnosis: template?.description ?? "",
      icd10Code: "",
      caseType: template?.caseType ?? "Oncology",
      meetingType: template?.meetingType ?? "Tumor Board",
      comorbidities: [],
      medications: [],
      labResults: {},
      imagingSummary: "",
      biopsyResults: "",
      riskScores: {},
      specialistViews: [],
      templateSlug: template?.slug,
      uploads: [],
    },
  });

  const watchedValues = form.watch();

  // Speech-to-text toggle (must be after form declaration)
  const toggleSpeechRecognition = useCallback(() => {
    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setToast("Speech recognition is not supported in this browser.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.continuous = true;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = Array.from(event.results)
        .map((r) => r[0].transcript)
        .join(" ");
      const current = form.getValues("diagnosis") || "";
      const separator = current && !current.endsWith(" ") ? " " : "";
      form.setValue("diagnosis", current + separator + transcript.trim(), { shouldDirty: true, shouldValidate: true });
    };

    recognition.onerror = () => {
      setIsListening(false);
      setToast("Microphone error — check browser permissions.");
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }, [isListening, form]);

  // --- Toast helper ---
  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  }, []);

  useEffect(() => {
    const existing = form.getValues("medications");
    if (existing.length) {
      setMedicationsInput(existing.join(", "));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Autosave (30s debounce) ---
  useEffect(() => {
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = setTimeout(() => {
      setDraftSaved(true);
      setTimeout(() => setDraftSaved(false), 3000);
    }, 30000);
    return () => { if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current); };
  }, [watchedValues, labEntries, specialistViews]);

  // --- ICD-10 autocomplete ---
  useEffect(() => {
    if (icd10Query.length < 3) {
      setIcd10Results([]);
      setShowIcd10Dropdown(false);
      setIcd10Error(false);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://clinicaltables.nlm.nih.gov/api/icd10cm/v3/search?terms=${encodeURIComponent(icd10Query)}&maxList=8`,
          { signal: controller.signal },
        );
        if (!res.ok) throw new Error("API error");
        const data = await res.json();
        const codes: string[] = data[1] ?? [];
        const descriptions: string[] = (data[3] ?? []).map((row: string[]) => row[0] ?? "");
        setIcd10Results(codes.map((code, i) => ({ code, description: descriptions[i] ?? "" })));
        setShowIcd10Dropdown(codes.length > 0);
        setIcd10Error(false);
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setIcd10Error(true);
          setIcd10Results([]);
          setShowIcd10Dropdown(false);
        }
      }
    }, 300);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [icd10Query]);

  // --- Drug interaction checker (600ms debounce) ---
  const checkInteractions = useCallback(
    (meds: string[]) => {
      if (interactionTimerRef.current) clearTimeout(interactionTimerRef.current);
      if (meds.length < 2) {
        setInteractions([]);
        setInteractionsChecked(false);
        return;
      }
      interactionTimerRef.current = setTimeout(async () => {
        setInteractionsLoading(true);
        try {
          const res = await fetch("/api/cases/check-interactions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ medications: meds }),
          });
          const data = await res.json();
          if (data.success) {
            setInteractions(data.data ?? []);
          } else {
            setInteractions([]);
            if (data.fallback) showToast(data.error || "Interaction check unavailable");
          }
          setInteractionsChecked(true);
        } catch {
          showToast("Could not check drug interactions");
        } finally {
          setInteractionsLoading(false);
        }
      }, 600);
    },
    [showToast],
  );

  // --- AI Risk Assessment ---
  const computeRiskScores = useCallback(async () => {
    const diagnosis = form.getValues("diagnosis");
    const labs = Object.fromEntries(labEntries.filter((e) => e.key && e.value).map((e) => [e.key, e.value]));
    if (!diagnosis || Object.keys(labs).length < 2) return;
    setRiskLoading(true);
    try {
      const res = await fetch("/api/cases/compute-risk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          diagnosis,
          labs,
          age: form.getValues("age"),
          sex: form.getValues("sex"),
          medications: form.getValues("medications"),
          caseType: form.getValues("caseType"),
        }),
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setRiskScores(data.data);
      } else {
        if (data.fallback) showToast(data.error || "Risk computation unavailable");
      }
    } catch {
      showToast("Could not compute risk scores");
    } finally {
      setRiskLoading(false);
    }
  }, [form, labEntries, showToast]);

  // Auto-trigger risk assessment when diagnosis filled + 2+ labs
  useEffect(() => {
    const diagnosis = watchedValues.diagnosis;
    const filledLabs = labEntries.filter((e) => e.key && e.value).length;
    if (diagnosis && diagnosis.length >= 5 && filledLabs >= 2 && riskScores.length === 0 && !riskLoading) {
      computeRiskScores();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchedValues.diagnosis, labEntries]);

  // --- File upload helpers ---
  async function handleUpload(file: File) {
    const data = new FormData();
    data.append("file", file);
    const response = await fetch("/api/upload", { method: "POST", body: data });
    if (response.ok) {
      const result = await response.json();
      setUploadRefs((prev) => [...prev, result]);
    }
  }

  async function extractDocuments(files: File[], scope: string): Promise<{ success: boolean; data: ExtractedCaseData | null; fallback?: boolean; error?: string }> {
    const formData = new FormData();
    for (const file of files) formData.append("files", file);
    formData.append("scope", scope);
    formData.append("caseType", form.getValues("caseType"));
    const res = await fetch("/api/cases/extract-documents", { method: "POST", body: formData });
    return res.json();
  }

  // --- Lab PDF upload ---
  async function handleLabPdfUpload(file: File) {
    setLabUploadLoading(true);
    try {
      const result = await extractDocuments([file], "labs");
      if (result.success && result.data?.labs?.length) {
        const newEntries = result.data.labs.map((lab) => ({
          key: `${lab.name} (${lab.unit})`,
          value: `${lab.value}${lab.referenceRange ? ` [ref: ${lab.referenceRange}]` : ""}`,
          ai: true,
        }));
        setLabEntries((prev) => [...prev, ...newEntries]);
        showToast(`Extracted ${newEntries.length} lab entries from ${file.name}`);
      } else {
        showToast("Could not extract labs — please add manually.");
      }
    } catch {
      showToast("Could not extract labs — please add manually.");
    } finally {
      setLabUploadLoading(false);
    }
  }

  // --- Imaging PDF upload ---
  async function handleImagingUpload(file: File) {
    const current = form.getValues("imagingSummary");
    if (current && current.trim().length > 0) {
      if (!window.confirm("Replace current text with extracted content? This cannot be undone.")) return;
    }
    setImagingUploadLoading(true);
    try {
      const result = await extractDocuments([file], "imaging");
      if (result.success && result.data?.imagingSummary) {
        form.setValue("imagingSummary", result.data.imagingSummary, { shouldDirty: true });
        setImagingSource(file.name);
        showToast("Imaging summary extracted successfully");
      } else {
        showToast("Could not extract imaging summary — please enter manually.");
      }
    } catch {
      showToast("Could not extract imaging summary — please enter manually.");
    } finally {
      setImagingUploadLoading(false);
    }
  }

  // --- Biopsy PDF upload ---
  async function handleBiopsyUpload(file: File) {
    const current = form.getValues("biopsyResults");
    if (current && current.trim().length > 0) {
      if (!window.confirm("Replace current text with extracted content? This cannot be undone.")) return;
    }
    setBiopsyUploadLoading(true);
    try {
      const result = await extractDocuments([file], "biopsy");
      if (result.success && result.data?.biopsyPathology) {
        form.setValue("biopsyResults", result.data.biopsyPathology, { shouldDirty: true });
        setBiopsySource(file.name);
        showToast("Pathology data extracted successfully");
      } else {
        showToast("Could not extract pathology data — please enter manually.");
      }
    } catch {
      showToast("Could not extract pathology data — please enter manually.");
    } finally {
      setBiopsyUploadLoading(false);
    }
  }

  // --- Specialist referral letter upload ---
  async function handleSpecialistUpload(file: File) {
    setSpecialistUploadLoading(true);
    try {
      const result = await extractDocuments([file], "specialistOpinion");
      if (result.success && result.data?.specialistOpinions?.length) {
        const newViews = result.data.specialistOpinions.map((op) => ({
          specialist: op.specialty || "Unknown Specialty",
          opinion: `${op.clinicianName ? `Dr. ${op.clinicianName}: ` : ""}${op.summary}`,
          ai: true,
          source: file.name,
        }));
        setSpecialistViews((prev) => [...prev, ...newViews]);
        showToast(`Extracted ${newViews.length} specialist opinion(s) from ${file.name}`);
      } else {
        showToast("Could not extract specialist opinions — please add manually.");
      }
    } catch {
      showToast("Could not extract specialist opinions — please add manually.");
    } finally {
      setSpecialistUploadLoading(false);
    }
  }

  // --- Master document extraction ---
  async function handleMasterExtract() {
    if (!masterFiles.length) return;
    setMasterExtracting(true);
    setMasterProgress(10);
    showToast("AI is reading your documents — you can fill other fields while waiting");

    const interval = setInterval(() => {
      setMasterProgress((prev) => Math.min(prev + 8, 90));
    }, 500);

    try {
      const result = await extractDocuments(masterFiles, "all");
      clearInterval(interval);
      setMasterProgress(100);

      if (result.success && result.data) {
        const d = result.data;
        const filled: string[] = [];

        if (d.primaryDiagnosis) { form.setValue("diagnosis", d.primaryDiagnosis, { shouldDirty: true }); filled.push("Diagnosis"); }
        if (d.icd10Code) { form.setValue("icd10Code", d.icd10Code, { shouldDirty: true }); setIcd10Query(d.icd10Code); filled.push("ICD-10 Code"); }
        if (d.patientAge) { form.setValue("age", d.patientAge, { shouldDirty: true }); filled.push("Age"); }
        if (d.patientSex) { form.setValue("sex", d.patientSex, { shouldDirty: true }); filled.push("Sex"); }
        if (d.medications?.length) {
          form.setValue("medications", d.medications, { shouldDirty: true });
          setMedicationsInput(d.medications.join(", "));
          filled.push("Medications");
        }
        if (d.labs?.length) {
          const newLabs = d.labs.map((lab) => ({
            key: `${lab.name} (${lab.unit})`,
            value: `${lab.value}${lab.referenceRange ? ` [ref: ${lab.referenceRange}]` : ""}`,
            ai: true,
          }));
          setLabEntries((prev) => [...prev, ...newLabs]);
          filled.push("Labs");
        }
        if (d.imagingSummary) { form.setValue("imagingSummary", d.imagingSummary, { shouldDirty: true }); setImagingSource("Uploaded documents"); filled.push("Imaging Summary"); }
        if (d.biopsyPathology) { form.setValue("biopsyResults", d.biopsyPathology, { shouldDirty: true }); setBiopsySource("Uploaded documents"); filled.push("Biopsy/Pathology"); }
        if (d.specialistOpinions?.length) {
          const views = d.specialistOpinions.map((op) => ({
            specialist: op.specialty || "Unknown Specialty",
            opinion: `${op.clinicianName ? `Dr. ${op.clinicianName}: ` : ""}${op.summary}`,
            ai: true,
            source: "Uploaded documents",
          }));
          setSpecialistViews((prev) => [...prev, ...views]);
          filled.push("Specialist Opinions");
        }

        setExtractedConfidence(d.confidence);
        setAutoFilledFields(filled);
        setShowExtractedReview(true);
        showToast(`Auto-filled ${filled.length} fields from ${masterFiles.length} document(s)`);
      } else {
        showToast(result.error || "Extraction failed — please fill fields manually");
      }
    } catch {
      clearInterval(interval);
      showToast("Extraction failed — please fill fields manually");
    } finally {
      setMasterExtracting(false);
      setTimeout(() => setMasterProgress(0), 2000);
    }
  }

  // --- Per-step progress calculation ---
  const step1RequiredFields: Array<keyof CaseWizardValues> = ["patientId", "age", "sex", "diagnosis"];
  const step1Filled = step1RequiredFields.filter((f) => {
    const v = watchedValues[f];
    if (typeof v === "string") return v.length > 0;
    if (typeof v === "number") return true;
    return false;
  }).length;
  const step1Percent = Math.round((step1Filled / step1RequiredFields.length) * 100);
  const step2HasLab = labEntries.filter((e) => e.key && e.value).length >= 1;
  const step2Percent = step2HasLab ? 100 : 0;
  const step3Percent = 100;
  const stepPercents = [step1Percent, step2Percent, step3Percent];
  const currentStepPercent = stepPercents[step];

  async function submit(values: CaseWizardValues) {
    setSubmitting(true);
    setError(null);

    const riskObj = Object.fromEntries(riskScores.map((r) => [r.name, `${r.value} (${r.tier})`]));

    const payload: PatientCasePayload = {
      ...values,
      labResults: Object.fromEntries(labEntries.filter((entry) => entry.key && entry.value).map((entry) => [entry.key, entry.value])),
      riskScores: riskObj,
      specialistViews: specialistViews.filter((view) => view.specialist && view.opinion).map((v) => ({ specialist: v.specialist, opinion: v.opinion })),
      uploads: uploadRefs,
    };

    const response = await fetch("/api/cases", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    setSubmitting(false);

    if (!response.ok) {
      setError("Unable to create case. Please review required fields.");
      return;
    }

    const result = await response.json();
    router.push(`/cases/${result.id}`);
  }

  const currentStep = STEPS[step];

  const handleBack = () => {
    setStep((prev) => Math.max(prev - 1, 0));
  };

  const handleNext = async (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    setValidationBanner(null);
    const fields = STEP_FIELD_MAP[currentStep];
    if (fields.length) {
      const isValid = await form.trigger(fields);
      if (!isValid) {
        setValidationBanner("Please complete all required fields before continuing");
        setShakeFields(true);
        setTimeout(() => setShakeFields(false), 500);
        const firstErrorField = fields.find((f) => form.formState.errors[f]);
        if (firstErrorField) {
          const el = document.querySelector(`[name="${firstErrorField}"]`);
          el?.scrollIntoView({ behavior: "smooth", block: "center" });
        }
        return;
      }
    }
    setStepsCompleted((prev) => {
      const next = [...prev];
      next[step] = true;
      return next;
    });
    setStep((prev) => Math.min(prev + 1, STEPS.length - 1));
  };

  const handleStepClick = (targetStep: number) => {
    if (targetStep < step) {
      setStep(targetStep);
    }
    if (targetStep > step && stepsCompleted[step]) {
      setStep(targetStep);
    }
  };

  const riskTierColor = (tier: string) => {
    if (tier === "Low") return "border-emerald-400 bg-emerald-50";
    if (tier === "Intermediate") return "border-amber-400 bg-amber-50";
    return "border-rose-400 bg-rose-50";
  };

  const riskTierBadge = (tier: string) => {
    if (tier === "Low") return "border-emerald-200 bg-emerald-100 text-emerald-800";
    if (tier === "Intermediate") return "border-amber-200 bg-amber-100 text-amber-800";
    return "border-rose-200 bg-rose-100 text-rose-800";
  };

  const interactionBorder = (severity: string) => {
    if (severity === "Major") return "border-l-4 border-l-rose-500";
    if (severity === "Moderate") return "border-l-4 border-l-orange-400";
    return "border-l-4 border-l-amber-400";
  };

  const dynamicTitle = (() => {
    const ct = watchedValues.caseType;
    const mt = watchedValues.meetingType;
    if (ct && mt) return `New ${ct} Case \u2014 ${mt}`;
    if (ct) return `New ${ct} Case`;
    return "New patient case";
  })();

  return (
    <div className="space-y-8">
      {/* Toast notification */}
      {toast && (
        <div className="fixed right-6 top-6 z-50 animate-pulse rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm text-slate-800 shadow-lg">
          {toast}
        </div>
      )}

      {/* Draft saved indicator */}
      {draftSaved && (
        <div className="fixed bottom-6 right-6 z-50 rounded-lg bg-slate-800 px-3 py-2 text-xs text-emerald-300 shadow">
          Draft saved &#10003;
        </div>
      )}

      <div>
        <p className="text-sm uppercase tracking-[0.3em] text-slate-500">Case intake</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-900">{dynamicTitle}</h1>
        {template ? <p className="text-sm text-slate-500">Template: {template.name}</p> : null}
      </div>

      {/* Segmented step progress bar */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>Step {step + 1} of {STEPS.length} &mdash; {STEPS[step]}</span>
          <span>{currentStepPercent}% complete</span>
        </div>
        <div className="flex gap-1">
          {STEPS.map((_, i) => (
            <div key={i} className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-[#1a3557] transition-all duration-500"
                style={{ width: i < step ? "100%" : i === step ? `${stepPercents[i]}%` : "0%" }}
              />
            </div>
          ))}
        </div>
      </div>

      {/* === MASTER UPLOAD ZONE === */}
      <div
        className="rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 p-8 text-center transition hover:border-[#1a3557] hover:bg-blue-50/30"
        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          const files = Array.from(e.dataTransfer.files);
          setMasterFiles((prev) => [...prev, ...files].slice(0, 10));
        }}
      >
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-200 text-slate-500">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
        </div>
        <p className="text-sm font-semibold text-slate-700">Drop patient documents here to auto-fill the form</p>
        <p className="mt-1 text-xs text-slate-500">Lab reports, imaging reports, referral letters, discharge summaries</p>
        <div className="mt-2 flex items-center justify-center gap-2">
          {["PDF", "DOCX", "JPG", "PNG"].map((fmt) => (
            <span key={fmt} className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-medium text-slate-600">{fmt}</span>
          ))}
        </div>
        <label className="mt-3 inline-block cursor-pointer rounded-lg bg-white px-4 py-2 text-sm font-medium text-[#1a3557] shadow-sm transition hover:bg-slate-100">
          Browse files
          <input
            type="file"
            multiple
            accept=".pdf,.docx,.jpg,.jpeg,.png"
            className="hidden"
            onChange={(e) => {
              const files = Array.from(e.target.files ?? []);
              setMasterFiles((prev) => [...prev, ...files].slice(0, 10));
            }}
          />
        </label>

        {masterFiles.length > 0 && (
          <div className="mt-4 space-y-2">
            {masterFiles.map((f, i) => (
              <div key={`${f.name}-${i}`} className="flex items-center justify-between rounded-lg bg-white px-3 py-2 text-xs shadow-sm">
                <span className="truncate text-slate-700">{f.name} ({(f.size / 1024).toFixed(0)} KB)</span>
                <button type="button" className="text-slate-400 hover:text-rose-500" onClick={() => setMasterFiles((prev) => prev.filter((_, idx) => idx !== i))}>
                  &times;
                </button>
              </div>
            ))}
            <Button type="button" disabled={masterExtracting} onClick={handleMasterExtract} className="mt-2 w-full">
              {masterExtracting ? "Extracting..." : "Extract & Auto-fill All Fields"}
            </Button>
          </div>
        )}

        {masterProgress > 0 && (
          <div className="mt-3">
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
              <div className="h-full rounded-full bg-[#1a3557] transition-all duration-300" style={{ width: `${masterProgress}%` }} />
            </div>
            <p className="mt-1 text-[10px] text-slate-500">Document Intelligence Agent scanning files... (Powered by Nous Hermes 3 405B)</p>
          </div>
        )}
      </div>

      {/* Extracted data review panel */}
      {showExtractedReview && autoFilledFields.length > 0 && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <button type="button" className="flex w-full items-center justify-between text-sm font-semibold text-emerald-800" onClick={() => setShowExtractedReview((prev) => !prev)}>
            Review Extracted Data ({autoFilledFields.length} fields)
            <span className="text-xs">&#9660;</span>
          </button>
          <div className="mt-3 space-y-1">
            {autoFilledFields.map((field) => (
              <div key={field} className="flex items-center gap-2 text-xs text-emerald-700">
                {extractedConfidence && (
                  <ConfidenceDot score={extractedConfidence.overall} />
                )}
                <span>{field}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Step indicator — circles + connectors */}
      <div className="flex w-full items-start justify-between">
        {STEPS.map((label, index) => {
          const isCompleted = stepsCompleted[index] || index < step;
          const isCurrent = index === step;
          const canClick = isCompleted || (index < step);
          return (
            <div key={label} className="flex flex-1 flex-col items-center">
              <div className="flex w-full items-center">
                {index > 0 && (
                  <div className={`h-0.5 flex-1 ${isCompleted || isCurrent ? "bg-[#1a3557]" : "bg-slate-200"}`} />
                )}
                <button
                  type="button"
                  disabled={!canClick && !isCurrent}
                  onClick={() => canClick && handleStepClick(index)}
                  className={`relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold transition-all ${
                    isCompleted
                      ? "border-[#1a3557] bg-[#1a3557] text-white cursor-pointer hover:opacity-90"
                      : isCurrent
                        ? "border-[#1a3557] bg-[#1a3557] text-white scale-110 shadow-lg"
                        : "border-slate-300 bg-white text-slate-400 cursor-default"
                  }`}
                >
                  {isCompleted && !isCurrent ? (
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  ) : (
                    index + 1
                  )}
                </button>
                {index < STEPS.length - 1 && (
                  <div className={`h-0.5 flex-1 ${isCompleted ? "bg-[#1a3557]" : "bg-slate-200"}`} />
                )}
              </div>
              <p className={`mt-2 text-center text-xs ${
                isCurrent ? "font-bold text-[#1a3557]" : isCompleted ? "font-medium text-slate-800" : "text-slate-400"
              }`}>
                {label}{isCompleted && !isCurrent ? " \u2713" : ""}
              </p>
            </div>
          );
        })}
      </div>

      {/* Validation banner */}
      {validationBanner && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
          {validationBanner}
        </div>
      )}

      <form onSubmit={form.handleSubmit(submit)} className="space-y-6">
        {currentStep === "Patient Profile" && (
          <div className={`rounded-2xl border border-slate-200 bg-white p-6 shadow-sm ${shakeFields ? "animate-shake" : ""}`}>
            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <label className="text-sm font-medium text-slate-700">Patient ID <span className="text-rose-500">*</span></label>
                <Input
                  {...form.register("patientId")}
                  placeholder="e.g. PT-2026-0042"
                  className={form.formState.errors.patientId ? "border-rose-400 ring-1 ring-rose-300" : ""}
                />
                {form.formState.errors.patientId && (
                  <p className="mt-1 text-xs text-rose-600">{form.formState.errors.patientId.message}</p>
                )}
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Age <span className="text-rose-500">*</span></label>
                <Input
                  type="number"
                  {...form.register("age", { valueAsNumber: true })}
                  className={form.formState.errors.age ? "border-rose-400 ring-1 ring-rose-300" : ""}
                />
                {form.formState.errors.age && (
                  <p className="mt-1 text-xs text-rose-600">{form.formState.errors.age.message}</p>
                )}
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Sex <span className="text-rose-500">*</span></label>
                <Select
                  {...form.register("sex")}
                  className={form.formState.errors.sex ? "border-rose-400 ring-1 ring-rose-300" : ""}
                >
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Weight (kg)</label>
                <Input type="number" step="0.1" {...form.register("weight", { valueAsNumber: true })} />
              </div>
              <div className="md:col-span-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-slate-700">Primary diagnosis <span className="text-rose-500">*</span></label>
                  <button
                    type="button"
                    onClick={toggleSpeechRecognition}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                      isListening
                        ? "bg-rose-100 text-rose-700 animate-pulse"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                    title={isListening ? "Stop recording" : "Dictate diagnosis"}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                      <line x1="12" x2="12" y1="19" y2="22" />
                    </svg>
                    {isListening ? "Listening…" : "Dictate"}
                  </button>
                </div>
                <Textarea
                  rows={3}
                  {...form.register("diagnosis")}
                  placeholder={isListening ? "Listening — speak now…" : "Describe the primary diagnosis"}
                  className={`mt-1 ${form.formState.errors.diagnosis ? "border-rose-400 ring-1 ring-rose-300" : ""} ${isListening ? "ring-2 ring-rose-300 border-rose-300" : ""}`}
                />
                {form.formState.errors.diagnosis && (
                  <p className="mt-1 text-xs text-rose-600">{form.formState.errors.diagnosis.message}</p>
                )}
              </div>
              {/* ICD-10 Code Field */}
              <div className="relative md:col-span-2">
                <label className="text-sm font-medium text-slate-700">
                  ICD-10 Code
                  <Tooltip text="International Classification of Diseases code. Start typing to search the NLM database for matching codes." />
                </label>
                <Input
                  value={icd10Query}
                  placeholder="Type to search ICD-10 codes (e.g. I21, C34)"
                  className={`transition-colors ${icd10Query ? "bg-white" : "bg-slate-50"} focus:bg-white`}
                  onChange={(e) => {
                    setIcd10Query(e.target.value);
                    form.setValue("icd10Code", e.target.value, { shouldDirty: true });
                  }}
                  onFocus={() => icd10Results.length > 0 && setShowIcd10Dropdown(true)}
                  onBlur={() => setTimeout(() => setShowIcd10Dropdown(false), 200)}
                />
                {showIcd10Dropdown && icd10Results.length > 0 && (
                  <div className="absolute z-40 mt-1 max-h-48 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg">
                    {icd10Results.map((item) => (
                      <button
                        key={item.code}
                        type="button"
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          setIcd10Query(item.code);
                          form.setValue("icd10Code", item.code, { shouldDirty: true });
                          if (!form.getValues("diagnosis") || form.getValues("diagnosis").length < 5) {
                            form.setValue("diagnosis", item.description, { shouldDirty: true });
                          }
                          setShowIcd10Dropdown(false);
                          setIcd10Error(false);
                        }}
                      >
                        <span className="font-mono text-xs font-semibold text-[#1a3557]">{item.code}</span>
                        <span className="text-xs text-slate-600">{item.description}</span>
                      </button>
                    ))}
                  </div>
                )}
                {icd10Error && (
                  <p className="mt-1 text-xs text-amber-600">ICD-10 lookup unavailable &mdash; enter code manually</p>
                )}
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Case type</label>
                <Select {...form.register("caseType")}>
                  {CASE_TYPES.map((type) => (
                    <option key={type}>{type}</option>
                  ))}
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Meeting type</label>
                <Select {...form.register("meetingType")}>
                  {MEETING_TYPES.map((type) => (
                    <option key={type}>{type}</option>
                  ))}
                </Select>
              </div>
              <div className="md:col-span-2">
                <label className="text-sm font-medium text-slate-700">Comorbidities</label>
                <div className="flex flex-wrap gap-2">
                  {COMORBIDITIES.map((condition) => (
                    <label key={condition} className="flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1 text-sm">
                      <input
                        type="checkbox"
                        value={condition}
                        {...form.register("comorbidities")}
                        className="rounded"
                      />
                      {condition}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {currentStep === "Risk & Labs" && (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-8">
            {/* Medications with drug interaction checker */}
            <div>
              <label className="text-sm font-medium text-slate-700">
                Current medications (comma separated)
                <Tooltip text="Enter all current medications. When 2 or more drugs are listed, the AI pharmacology agent will automatically check for interactions." />
              </label>
              <Input
                placeholder="Aspirin, Metformin"
                value={medicationsInput}
                onChange={(event) => {
                  const value = event.target.value;
                  setMedicationsInput(value);
                  const parsed = value
                    .split(",")
                    .map((item) => item.trim())
                    .filter((item) => item.length);
                  form.setValue("medications", parsed, { shouldDirty: true });
                  checkInteractions(parsed);
                }}
              />

              {/* Drug interactions panel */}
              {interactionsLoading && (
                <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
                  <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-slate-300 border-t-[#1a3557]" />
                  Checking drug interactions...
                </div>
              )}

              {!interactionsLoading && interactionsChecked && interactions.length === 0 && (
                <p className="mt-2 text-xs text-emerald-600">&#10003; No interactions detected</p>
              )}

              {interactions.length > 0 && (
                <div className="mt-3 space-y-2 rounded-xl border border-slate-200 p-3">
                  <p className="text-xs font-semibold text-slate-700">Drug Interactions</p>
                  {interactions.map((ix, i) => (
                    <div key={i} className={`rounded-lg bg-white p-3 ${interactionBorder(ix.severity)}`}>
                      <p className="text-sm text-slate-800">
                        <span className="mr-1">&#9888;</span>
                        <strong>{ix.drug1}</strong> + <strong>{ix.drug2}</strong> &mdash; {ix.description}
                      </p>
                      <Badge className={
                        ix.severity === "Major" ? "mt-1 border-rose-200 bg-rose-50 text-rose-700" :
                        ix.severity === "Moderate" ? "mt-1 border-orange-200 bg-orange-50 text-orange-700" :
                        "mt-1 border-amber-200 bg-amber-50 text-amber-700"
                      }>{ix.severity}</Badge>
                    </div>
                  ))}
                  <p className="text-[10px] text-slate-400">AI-generated — verify with a clinical pharmacist before acting</p>
                </div>
              )}
            </div>

            {/* Lab results */}
            <div className="rounded-2xl border border-slate-200 p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Lab results</h3>
                <div className="flex gap-2">
                  <label className={`inline-flex cursor-pointer items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${labUploadLoading ? "bg-slate-100 text-slate-400" : "bg-blue-50 text-blue-700 hover:bg-blue-100"}`}>
                    {labUploadLoading ? (
                      <><span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-blue-300 border-t-blue-600" /> Extracting...</>
                    ) : (
                      "Upload Lab Report PDF"
                    )}
                    <input
                      type="file"
                      accept=".pdf"
                      className="hidden"
                      disabled={labUploadLoading}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleLabPdfUpload(file);
                        e.target.value = "";
                      }}
                    />
                  </label>
                  <Button type="button" variant="ghost" onClick={() => setLabEntries((prev) => [...prev, { key: "", value: "" }])}>
                    + Add lab
                  </Button>
                </div>
              </div>
              <div className="mt-4 space-y-3">
                {labEntries.map((entry, index) => (
                  <div key={index} className="grid gap-2 md:grid-cols-[1fr_1fr_auto]">
                    <div className="flex items-center gap-1">
                      <Input
                        placeholder="Marker"
                        value={entry.key}
                        onChange={(event) =>
                          setLabEntries((prev) => prev.map((item, idx) => (idx === index ? { ...item, key: event.target.value } : item)))
                        }
                      />
                      {entry.ai && <Badge className="border-blue-200 bg-blue-50 text-blue-700">AI</Badge>}
                    </div>
                    <Input
                      placeholder="Value"
                      value={entry.value}
                      onChange={(event) =>
                        setLabEntries((prev) => prev.map((item, idx) => (idx === index ? { ...item, value: event.target.value } : item)))
                      }
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setLabEntries((prev) => prev.filter((_, idx) => idx !== index))}
                    >
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            {/* AI Risk Assessment Panel */}
            <div className="rounded-2xl border border-slate-200 p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">
                  AI Risk Assessment
                  <Tooltip text="Risk scores are automatically computed by AI based on the patient's diagnosis, labs, age, sex, and medications. Scores are clinically relevant to the case type." />
                </h3>
                <Button type="button" variant="ghost" disabled={riskLoading} onClick={computeRiskScores}>
                  {riskLoading ? (
                    <><span className="mr-1 inline-block h-3 w-3 animate-spin rounded-full border-2 border-slate-300 border-t-[#1a3557]" /> Computing...</>
                  ) : (
                    "Recompute \u21BB"
                  )}
                </Button>
              </div>

              {riskScores.length === 0 && !riskLoading && (
                <p className="mt-3 text-xs text-slate-400">Fill diagnosis and at least 2 lab entries to auto-compute risk scores.</p>
              )}

              {riskScores.length > 0 && (
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {riskScores.map((score, index) => (
                    <div key={index} className={`rounded-xl border-2 p-4 ${riskTierColor(score.tier)}`}>
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-slate-900">{score.name}</p>
                        <Badge className={riskTierBadge(score.tier)}>{score.tier}</Badge>
                      </div>
                      <p className="mt-1 text-lg font-bold text-slate-800">{score.value}</p>
                      <p className="mt-1 text-xs text-slate-600">{score.rationale}</p>
                      <button
                        type="button"
                        className="mt-2 text-[10px] text-slate-400 hover:text-slate-600"
                        onClick={() => {
                          const newValue = window.prompt(`Override value for ${score.name}:`, score.value);
                          if (newValue !== null) {
                            setRiskScores((prev) => prev.map((s, i) => (i === index ? { ...s, value: newValue } : s)));
                          }
                        }}
                      >
                        &#9998; Edit
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {riskScores.length > 0 && (
                <p className="mt-3 text-[10px] text-slate-400">Computed by Nous Hermes 3 405B via OpenRouter</p>
              )}
            </div>
          </div>
        )}

        {currentStep === "Opinion & Files" && (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-8">
            {/* Imaging summary + upload */}
            <div>
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-slate-700">Imaging summary</label>
                <label className={`inline-flex cursor-pointer items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${imagingUploadLoading ? "bg-slate-100 text-slate-400" : "bg-blue-50 text-blue-700 hover:bg-blue-100"}`}>
                  {imagingUploadLoading ? (
                    <><span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-blue-300 border-t-blue-600" /> Extracting...</>
                  ) : (
                    "Upload Imaging Report PDF"
                  )}
                  <input
                    type="file"
                    accept=".pdf"
                    className="hidden"
                    disabled={imagingUploadLoading}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleImagingUpload(file);
                      e.target.value = "";
                    }}
                  />
                </label>
              </div>
              <Textarea rows={4} {...form.register("imagingSummary")} />
              {imagingSource && <p className="mt-1 text-[10px] text-slate-400">Extracted from: {imagingSource} via Nous Hermes 3 405B</p>}
            </div>

            {/* Biopsy / Pathology + upload */}
            <div>
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-slate-700">Biopsy / Pathology</label>
                <label className={`inline-flex cursor-pointer items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${biopsyUploadLoading ? "bg-slate-100 text-slate-400" : "bg-blue-50 text-blue-700 hover:bg-blue-100"}`}>
                  {biopsyUploadLoading ? (
                    <><span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-blue-300 border-t-blue-600" /> Extracting...</>
                  ) : (
                    "Upload Pathology Report PDF"
                  )}
                  <input
                    type="file"
                    accept=".pdf"
                    className="hidden"
                    disabled={biopsyUploadLoading}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleBiopsyUpload(file);
                      e.target.value = "";
                    }}
                  />
                </label>
              </div>
              <Textarea rows={4} {...form.register("biopsyResults")} />
              {biopsySource && <p className="mt-1 text-[10px] text-slate-400">Extracted from: {biopsySource} via Nous Hermes 3 405B</p>}
            </div>

            {/* Specialist opinions + upload */}
            <div className="rounded-2xl border border-slate-200 p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Referring specialist opinions</h3>
                <div className="flex gap-2">
                  <label className={`inline-flex cursor-pointer items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${specialistUploadLoading ? "bg-slate-100 text-slate-400" : "bg-blue-50 text-blue-700 hover:bg-blue-100"}`}>
                    {specialistUploadLoading ? (
                      <><span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-blue-300 border-t-blue-600" /> Extracting...</>
                    ) : (
                      "Upload Referral Letter PDF"
                    )}
                    <input
                      type="file"
                      accept=".pdf"
                      className="hidden"
                      disabled={specialistUploadLoading}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleSpecialistUpload(file);
                        e.target.value = "";
                      }}
                    />
                  </label>
                  <Button type="button" variant="ghost" onClick={() => setSpecialistViews((prev) => [...prev, { specialist: "", opinion: "" }])}>
                    + Add opinion
                  </Button>
                </div>
              </div>
              <div className="mt-4 space-y-3">
                {specialistViews.map((entry, index) => (
                  <div key={index} className="space-y-2 rounded-xl border border-slate-200 p-3">
                    <div className="flex items-center gap-2">
                      <Input
                        placeholder="Specialist"
                        value={entry.specialist}
                        onChange={(event) =>
                          setSpecialistViews((prev) =>
                            prev.map((item, idx) => (idx === index ? { ...item, specialist: event.target.value } : item)),
                          )
                        }
                      />
                      {entry.ai && <Badge className="border-blue-200 bg-blue-50 text-blue-700">AI</Badge>}
                    </div>
                    <Textarea
                      rows={3}
                      placeholder="Opinion summary"
                      value={entry.opinion}
                      onChange={(event) =>
                        setSpecialistViews((prev) =>
                          prev.map((item, idx) => (idx === index ? { ...item, opinion: event.target.value } : item)),
                        )
                      }
                    />
                    {entry.source && <p className="text-[10px] text-slate-400">From: {entry.source}</p>}
                    <Button type="button" variant="ghost" onClick={() => setSpecialistViews((prev) => prev.filter((_, idx) => idx !== index))}>
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">Upload imaging/biopsy files</label>
              <Input
                type="file"
                multiple
                onChange={async (event) => {
                  const files = event.target.files;
                  if (!files) return;
                  for (const file of Array.from(files)) {
                    await handleUpload(file);
                  }
                }}
              />
              <p className="mt-2 text-sm text-slate-500">Uploaded: {uploadRefs.length}</p>
            </div>
          </div>
        )}

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <div className="flex justify-between">
          {step > 0 ? (
            <Button type="button" variant="ghost" onClick={handleBack}>
              Back
            </Button>
          ) : (
            <div />
          )}
          {step < STEPS.length - 1 ? (
            <Button type="button" disabled={masterExtracting} onClick={handleNext}>
              Next
            </Button>
          ) : (
            <Button type="submit" disabled={submitting || masterExtracting}>
              {submitting ? "Submitting\u2026" : "Create case"}
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}
