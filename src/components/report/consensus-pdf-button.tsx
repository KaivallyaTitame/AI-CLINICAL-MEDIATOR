"use client";

import dynamic from "next/dynamic";
import type { ConsensusReport } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { ConsensusPdf } from "@/lib/pdf";

const PDFDownloadLink = dynamic(
  () => import("@react-pdf/renderer").then(mod => mod.PDFDownloadLink),
  { ssr: false }
);

export function ConsensusPdfButton({ patientId, report }: { patientId: string; report: ConsensusReport }) {
  return (
    <PDFDownloadLink document={<ConsensusPdf patientId={patientId} report={report} />} fileName={`${patientId}-consensus.pdf`}>
      {({ loading }) => <Button disabled={loading}>{loading ? "Preparing PDF…" : "Export PDF"}</Button>}
    </PDFDownloadLink>
  );
}
