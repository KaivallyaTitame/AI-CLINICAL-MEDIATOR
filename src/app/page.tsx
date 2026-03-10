import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default async function Home() {
  const session = await getSession();
  if (session?.user) {
    redirect("/dashboard");
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-[#0f1b2d] px-6 py-12 text-white">
      <div className="w-full max-w-4xl space-y-8 text-center">
        <p className="text-sm uppercase tracking-[0.3em] text-emerald-300">AI Clinical Mediator</p>
        <h1 className="text-4xl font-semibold leading-tight sm:text-5xl">
          Evidence-weighted AI assistants for multidisciplinary treatment debates
        </h1>
        <p className="mx-auto max-w-2xl text-lg text-slate-200">
          Assign role-based AI specialists to every patient case, stream their debate in real time,
          and surface a transparent consensus report for the MDT to review, challenge, and confirm.
        </p>

        <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Button asChild className="w-full sm:w-auto">
            <Link href="/login">Login to workspace</Link>
          </Button>
          <Button asChild variant="secondary" className="w-full bg-white text-slate-900 sm:w-auto">
            <Link href="/register">Create Doctor Account</Link>
          </Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          {["Parallel Agent Debate", "NCCN / ACC evidence citations", "Locked consensus audit trail"].map((item) => (
            <Card key={item} className="border-white/10 bg-white/10 px-4 py-6 backdrop-blur">
              <p className="text-sm font-medium text-emerald-200">Feature</p>
              <p className="mt-2 text-base font-semibold text-white">{item}</p>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
