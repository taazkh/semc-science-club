import { PageHeading } from "@/components/common";
export const metadata = { title: "Privacy" };
export default function Privacy() {
  return (
    <>
      <PageHeading
        title="Your registration information."
        description="Registration is closed. Here is how application information will be handled when entries open."
      />
      <section className="shell article section">
        <h2>What the form collects</h2>
        <p>
          Participant names, schools, classes, team rosters and the contact
          person’s email and phone number help organisers manage entries. bKash
          transaction details and a private screenshot help them reconcile
          payment. Age is collected where an event has a minimum age. The site
          never asks for a bKash PIN or OTP.
        </p>
        <h2>Who can access it</h2>
        <p>
          Authorised organisers can review applications. Your private retrieval
          link opens your own record and submitted screenshot. Content editors
          cannot access payment screenshots. A reference number alone does not
          provide access.
        </p>
        <h2>Private application rehearsal</h2>
        <p>
          Invited testers must use fictional information only. Rehearsal
          applications and screenshots are stored in our test database and
          private file storage. They do not reserve a place at the festival.
          Testers should never send money. Organisers can delete test
          applications and their screenshots.
        </p>
        <h2>Before registration opens</h2>
        <p>
          The school must confirm the responsible contact, retention period,
          correction process and any required guardian consent. The final
          privacy notice will be published here before real participant
          information is collected.
        </p>
      </section>
    </>
  );
}
