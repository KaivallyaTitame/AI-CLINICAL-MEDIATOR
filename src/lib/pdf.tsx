import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { ConsensusReport } from "@/lib/types";

const styles = StyleSheet.create({
  page: { padding: 24, fontSize: 11, color: "#0f172a" },
  title: { fontSize: 18, marginBottom: 12 },
  section: { marginBottom: 10 },
  heading: { fontSize: 12, marginBottom: 4, color: "#1a3557" },
  line: { marginBottom: 3 },
});

export function ConsensusPdf({ patientId, report }: { patientId: string; report: ConsensusReport }) {
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
          <Text style={styles.line}>{report.consensus_recommendation}</Text>
          <Text style={styles.line}>Confidence: {report.confidence_score}/100</Text>
          <Text style={styles.line}>Evidence: {report.evidence_strength}</Text>
        </View>
        <View style={styles.section}>
          <Text style={styles.heading}>Safety Alerts</Text>
          {report.safety_alerts.map((alert) => (
            <Text key={alert} style={styles.line}>{alert}</Text>
          ))}
        </View>
        <View style={styles.section}>
          <Text style={styles.heading}>Next Steps</Text>
          {report.suggested_next_steps.map((step) => (
            <Text key={step} style={styles.line}>{step}</Text>
          ))}
        </View>
      </Page>
    </Document>
  );
}
