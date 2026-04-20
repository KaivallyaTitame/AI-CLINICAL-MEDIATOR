"use client";

import { useState, useEffect, type ComponentType } from "react";
import type { ConsensusReport } from "@/lib/types";
import { Button } from "@/components/ui/button";

type PDFDownloadLinkProps = {
  document: React.ReactElement;
  fileName: string;
  children: (state: { loading: boolean }) => React.ReactNode;
};

export function ConsensusPdfButton({ patientId, report }: { patientId: string; report: ConsensusReport }) {
  const [modules, setModules] = useState<{
    PDFDownloadLink: ComponentType<PDFDownloadLinkProps>;
    ConsensusPdf: ComponentType<{ patientId: string; report: ConsensusReport }>;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      import("@react-pdf/renderer"),
      import("@/lib/pdf"),
    ]).then(([renderer, pdf]) => {
      if (!cancelled) {
        setModules({
          PDFDownloadLink: renderer.PDFDownloadLink as unknown as ComponentType<PDFDownloadLinkProps>,
          ConsensusPdf: pdf.ConsensusPdf,
        });
      }
    });
    return () => { cancelled = true; };
  }, []);

  if (!modules) {
    return <Button disabled>Preparing PDF…</Button>;
  }

  const { PDFDownloadLink, ConsensusPdf } = modules;

  return (
    <PDFDownloadLink
      document={<ConsensusPdf patientId={patientId} report={report} />}
      fileName={`${patientId}-consensus.pdf`}
    >
      {({ loading }) => (
        <Button disabled={loading}>{loading ? "Preparing PDF…" : "Export PDF"}</Button>
      )}
    </PDFDownloadLink>
  );
}
