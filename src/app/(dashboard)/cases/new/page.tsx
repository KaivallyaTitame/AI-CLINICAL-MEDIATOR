import { CaseWizard } from "@/components/forms/case-wizard";

export const metadata = {
  title: "New Patient Case | AI Clinical Mediator",
};

export default function NewCasePage() {
  return (
    <div className="space-y-6">
      <CaseWizard />
    </div>
  );
}
