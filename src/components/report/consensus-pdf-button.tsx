"use client";

import { PDFDownloadLink } from "@react-pdf/renderer";
import type { ConsensusReport } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { ConsensusPdf } from "@/lib/pdf";

export function ConsensusPdfButton({ patientId, report }: { patientId: string; report: ConsensusReport }) {
  return (
    <PDFDownloadLink document={<ConsensusPdf patientId={patientId} report={report} />} fileName={`${patientId}-consensus.pdf`}>
      {({ loading }) => <Button disabled={loading}>{loading ? "Preparing PDF…" : "Export PDF"}</Button>}
    </PDFDownloadLink>
  );
}
