import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { Button } from "@/components/ui/button";

const NAV_LINKS = [
  { href: "/dashboard", label: "Cases" },
  { href: "/cases/new", label: "New Case" },
  { href: "/templates", label: "Templates" },
];

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const session = await getSession();
  if (!session?.user) {
    redirect("/login");
  }

  return (
    <div className="grid min-h-screen grid-cols-[260px_1fr] bg-[#f2f4f8]">
      <aside className="flex flex-col gap-6 border-r border-slate-200 bg-white/90 p-6">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-slate-500">AI MDT</p>
          <h2 className="text-lg font-semibold text-slate-900">Clinical Mediator</h2>
        </div>
        <nav className="space-y-2">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="block rounded-xl px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto rounded-2xl bg-slate-900/90 px-4 py-5 text-sm text-white">
          <p className="text-xs uppercase tracking-[0.3em] text-emerald-300">Session</p>
          <p className="mt-2 font-semibold">{session.user.name}</p>
          <p className="text-slate-300">{session.user.role}</p>
          <form action="/api/auth/signout" method="post" className="mt-4">
            <Button variant="ghost" className="w-full bg-white/10 text-white hover:bg-white/20" type="submit">
              Sign out
            </Button>
          </form>
        </div>
      </aside>
      <main className="max-h-screen overflow-y-auto p-8">{children}</main>
    </div>
  );
}
