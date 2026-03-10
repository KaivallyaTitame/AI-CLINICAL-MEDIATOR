import { ReactNode } from "react";

export function MeetingLayout({ header, children }: { header: ReactNode; children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-slate-900 text-white">
      <header className="border-b border-white/10 bg-black/30 px-8 py-6">
        {header}
      </header>
      <main className="flex-1 overflow-y-auto px-8 py-6">{children}</main>
    </div>
  );
}
