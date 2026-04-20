import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { ConsensusReport } from "@/lib/types";

const styles = StyleSheet.create({
  page: { padding: 24, fontSize: 11, color: "#0f172a" },
  title: { fontSize: 18, marginBottom: 12 },
  section: { marginBottom: 10 },
  heading: { fontSize: 12, marginBottom: 4, color: "#1a3557" },
  line: { marginBottom: 3 },
});

function toStr(val: unknown): string {
  if (typeof val === "string") return val;
  if (val == null) return "";
  if (typeof val === "object") {
    const obj = val as Record<string, unknown>;
    return (obj.level ?? obj.name ?? obj.description ?? obj.option ?? obj.summary ?? JSON.stringify(val)) as string;
  }
  return String(val);
}

function toArray(val: unknown): string[] {
  if (Array.isArray(val)) return val.map(toStr);
  if (typeof val === "string" && val.length) return [val];
  return [];
}

export function ConsensusPdf({ patientId, report }: { patientId: string; report: ConsensusReport }) {
  const alerts = toArray(report.safety_alerts);
  const steps = toArray(report.suggested_next_steps);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>AI Clinical Mediator Consensus Summary</Text>
        <View style={styles.section}>
          <Text style={styles.heading}>Patient</Text>
          <Text style={styles.line}>{patientId}</Text>
        </View>
        <View style={styles.section}>
          <Text style={styles.heading}>Recommendation</Text>
          <Text style={styles.line}>{toStr(report.consensus_recommendation)}</Text>
          <Text style={styles.line}>Confidence: {report.confidence_score}/100</Text>
          <Text style={styles.line}>Evidence: {toStr(report.evidence_strength)}</Text>
        </View>
        {alerts.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.heading}>Safety Alerts</Text>
            {alerts.map((alert, i) => (
              <Text key={i} style={styles.line}>{alert}</Text>
            ))}
          </View>
        )}
        {steps.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.heading}>Next Steps</Text>
            {steps.map((step, i) => (
              <Text key={i} style={styles.line}>{step}</Text>
            ))}
          </View>
        )}
      </Page>
    </Document>
  );
}
