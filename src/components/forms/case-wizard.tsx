"use client";

import { type MouseEvent, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { patientCaseSchema } from "@/lib/validation";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { getTemplateBySlug } from "@/lib/templates";
import type { PatientCasePayload } from "@/lib/types";

const COMORBIDITIES = ["Diabetes", "Heart Disease", "Hypertension", "CKD", "COPD", "Obesity", "Hyperlipidemia"];
const CASE_TYPES = ["Oncology", "Cardiology", "Multimorbidity", "General MDT"];
const MEETING_TYPES = ["Tumor Board", "Heart Team", "Multimorbidity Review", "General MDT"];

type CaseWizardValues = z.infer<typeof patientCaseSchema>;

const STEPS = ["Patient Profile", "Risk & Labs", "Opinion & Files"] as const;

const STEP_FIELD_MAP: Record<(typeof STEPS)[number], Array<keyof CaseWizardValues>> = {
  "Patient Profile": ["age", "sex", "diagnosis", "caseType", "meetingType"],
  "Risk & Labs": [],
  "Opinion & Files": [],
};

export function CaseWizard() {
  const router = useRouter();
  const params = useSearchParams();
  const templateSlug = params.get("template");
  const template = getTemplateBySlug(templateSlug);

  const [step, setStep] = useState(0);
  const [labEntries, setLabEntries] = useState<Array<{ key: string; value: string }>>([]);
  const [riskEntries, setRiskEntries] = useState<Array<{ key: string; value: string }>>(
    template ? template.riskScores.map((label) => ({ key: label, value: "" })) : [],
  );
  const [specialistViews, setSpecialistViews] = useState<Array<{ specialist: string; opinion: string }>>([]);
  const [uploadRefs, setUploadRefs] = useState<Array<{ name: string; type: string; content: string }>>([]);
  const [medicationsInput, setMedicationsInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resolver = zodResolver(patientCaseSchema) as Resolver<CaseWizardValues>;

  const form = useForm<CaseWizardValues>({
    resolver,
    defaultValues: {
      patientId: "",
      age: 60,
      sex: "Male",
      weight: 70,
      diagnosis: template?.description ?? "",
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

  useEffect(() => {
    const existing = form.getValues("medications");
    if (existing.length) {
      setMedicationsInput(existing.join(", "));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleUpload(file: File) {
    const data = new FormData();
    data.append("file", file);
    const response = await fetch("/api/upload", { method: "POST", body: data });
    if (response.ok) {
      const result = await response.json();
      setUploadRefs((prev) => [...prev, result]);
    }
  }

  async function submit(values: CaseWizardValues) {
    setSubmitting(true);
    setError(null);

    const payload: PatientCasePayload = {
      ...values,
      patientId: values.patientId || undefined,
      labResults: Object.fromEntries(labEntries.filter((entry) => entry.key && entry.value).map((entry) => [entry.key, entry.value])),
      riskScores: Object.fromEntries(riskEntries.filter((entry) => entry.key && entry.value).map((entry) => [entry.key, entry.value])),
      specialistViews: specialistViews.filter((view) => view.specialist && view.opinion),
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
    const fields = STEP_FIELD_MAP[currentStep];
    if (fields.length) {
      const isValid = await form.trigger(fields);
      if (!isValid) {
        return;
      }
    }
    setStep((prev) => Math.min(prev + 1, STEPS.length - 1));
  };

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm uppercase tracking-[0.3em] text-slate-500">Case intake</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-900">New patient case</h1>
        {template ? <p className="text-sm text-slate-500">Template: {template.name}</p> : null}
      </div>

      <div className="flex gap-3">
        {STEPS.map((label, index) => (
          <div key={label} className={`flex-1 rounded-full border px-4 py-2 text-center text-sm ${index === step ? "border-[#1a3557] text-[#1a3557]" : "border-slate-200 text-slate-500"}`}>
            {label}
          </div>
        ))}
      </div>

      <form onSubmit={form.handleSubmit(submit)} className="space-y-6">
        {currentStep === "Patient Profile" && (
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-sm font-medium text-slate-700">Patient ID (optional)</label>
              <Input {...form.register("patientId")} placeholder="Auto-generated if blank" />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Age</label>
              <Input type="number" {...form.register("age", { valueAsNumber: true })} />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Sex</label>
              <Select {...form.register("sex")}>
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
              <label className="text-sm font-medium text-slate-700">Primary diagnosis</label>
              <Textarea rows={3} {...form.register("diagnosis")} />
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
        )}

        {currentStep === "Risk & Labs" && (
          <div className="space-y-6">
            <div>
              <label className="text-sm font-medium text-slate-700">Current medications (comma separated)</label>
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
                }}
              />
            </div>

            <div className="rounded-2xl border border-slate-200 p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Lab results</h3>
                <Button type="button" variant="ghost" onClick={() => setLabEntries((prev) => [...prev, { key: "", value: "" }])}>
                  + Add lab
                </Button>
              </div>
              <div className="mt-4 space-y-3">
                {labEntries.map((entry, index) => (
                  <div key={index} className="grid gap-2 md:grid-cols-[1fr_1fr_auto]">
                    <Input
                      placeholder="Marker"
                      value={entry.key}
                      onChange={(event) =>
                        setLabEntries((prev) => prev.map((item, idx) => (idx === index ? { ...item, key: event.target.value } : item)))
                      }
                    />
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

            <div className="rounded-2xl border border-slate-200 p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Risk scores</h3>
                <Button type="button" variant="ghost" onClick={() => setRiskEntries((prev) => [...prev, { key: "", value: "" }])}>
                  + Add risk score
                </Button>
              </div>
              <div className="mt-4 space-y-3">
                {riskEntries.map((entry, index) => (
                  <div key={index} className="grid gap-2 md:grid-cols-[1fr_1fr_auto]">
                    <Input
                      placeholder="Risk metric"
                      value={entry.key}
                      onChange={(event) =>
                        setRiskEntries((prev) => prev.map((item, idx) => (idx === index ? { ...item, key: event.target.value } : item)))
                      }
                    />
                    <Input
                      placeholder="Value"
                      value={entry.value}
                      onChange={(event) =>
                        setRiskEntries((prev) => prev.map((item, idx) => (idx === index ? { ...item, value: event.target.value } : item)))
                      }
                    />
                    <Button type="button" variant="ghost" onClick={() => setRiskEntries((prev) => prev.filter((_, idx) => idx !== index))}>
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {currentStep === "Opinion & Files" && (
          <div className="space-y-6">
            <div>
              <label className="text-sm font-medium text-slate-700">Imaging summary</label>
              <Textarea rows={4} {...form.register("imagingSummary")} />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Biopsy / Pathology</label>
              <Textarea rows={4} {...form.register("biopsyResults")} />
            </div>

            <div className="rounded-2xl border border-slate-200 p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Referring specialist opinions</h3>
                <Button type="button" variant="ghost" onClick={() => setSpecialistViews((prev) => [...prev, { specialist: "", opinion: "" }])}>
                  + Add opinion
                </Button>
              </div>
              <div className="mt-4 space-y-3">
                {specialistViews.map((entry, index) => (
                  <div key={index} className="space-y-2 rounded-xl border border-slate-200 p-3">
                    <Input
                      placeholder="Specialist"
                      value={entry.specialist}
                      onChange={(event) =>
                        setSpecialistViews((prev) =>
                          prev.map((item, idx) => (idx === index ? { ...item, specialist: event.target.value } : item)),
                        )
                      }
                    />
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
          <Button type="button" variant="ghost" disabled={step === 0} onClick={handleBack}>
            Back
          </Button>
          {step < STEPS.length - 1 ? (
            <Button type="button" onClick={handleNext}>
              Next
            </Button>
          ) : (
            <Button type="submit" disabled={submitting}>
              {submitting ? "Submitting…" : "Create case"}
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}
