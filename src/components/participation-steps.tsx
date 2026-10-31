import { MotionAccordion } from "./motion-accordion";
const steps = [
  [
    "Find your event",
    "Explore the programme and check class eligibility, entry format and fee.",
  ],
  [
    "Make your entry",
    "Enter solo, or provide the required team roster. Multiple segments can share one application.",
  ],
  [
    "Save your private link",
    "Keep your private retrieval link to add payment details when collection opens and follow organiser review.",
  ],
  [
    "Follow the review",
    "Organisers check your application and payment. A confirmation email follows successful review and approval.",
  ],
];

export function ParticipationSteps() {
  return (
    <div className="participation-disclosures">
      <MotionAccordion
        items={steps.map(([a, b]) => [a, b] as const)}
        initialOpen={0}
      />
    </div>
  );
}
