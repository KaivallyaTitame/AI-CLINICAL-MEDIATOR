import Link from "next/link";
import { CASE_TEMPLATES } from "@/lib/templates";

export const metadata = {
  title: "Templates | AI Clinical Mediator",
};

export default function TemplatesPage() {
  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm uppercase tracking-[0.3em] text-slate-500">Use-case shortcuts</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-900">Templates</h1>
        <p className="text-sm text-slate-500">Pre-configured agent rosters, risk scores, and MDT flows for common scenarios.</p>
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        {CASE_TEMPLATES.map((template) => (
          <div key={template.slug} className="rounded-3xl border border-white/60 bg-white p-6 shadow-sm">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-500">{template.caseType}</p>
            <h2 className="mt-2 text-xl font-semibold text-slate-900">{template.name}</h2>
            <p className="mt-2 text-sm text-slate-600">{template.description}</p>
            <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold text-[#1a3557]">
              {template.agents.map((agent) => (
                <span key={agent} className="rounded-full bg-slate-100 px-3 py-1">
                  {agent}
                </span>
              ))}
            </div>
            <div className="mt-4 text-xs text-slate-500">Key risk scores: {template.riskScores.join(", ")}</div>
            <Link
              href={`/cases/new?template=${template.slug}`}
              className="mt-6 inline-flex items-center text-sm font-semibold text-[#1a3557]"
            >
              Launch template →
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
