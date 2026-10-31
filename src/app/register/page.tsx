import { PageHeading } from "@/components/common";
import { registrationOptions } from "@/lib/server/repository";
import { RegistrationForm } from "@/components/registration-form";
import Link from "next/link";
export const metadata = { title: "Registration" };
export const dynamic = "force-dynamic";
export default async function Register() {
  const data = await registrationOptions();
  return (
    <>
      <PageHeading
        title="Your STEMfest starts here."
        description="Choose your segments. Bring your team. One application, no account."
      />
      <div className="shell">
        {!data.open ? (
          <section className="release-state">
            <div>
              <h2>Good things take a little preparation.</h2>
              <p>
                Registration is not open yet. Explore the programme now; entry
                instructions for 16 November 2026 will appear here.
              </p>
              <Link className="text-link" href="/stemfest#programme">
                Find your event →
              </Link>
            </div>
            <div>
              <h3>Before you enter</h3>
              <p>
                Check your event’s class eligibility, team size and programme
                fee. Final rules and payment collection instructions are still
                being prepared.
              </p>
              <Link className="text-link" href="/contact">
                Contact the organisers →
              </Link>
            </div>
          </section>
        ) : data.demo ? (
          <div className="notice">
            <strong>Test registration.</strong> Use fictional information only.
            These are the actual programme and prices, with draft rules. No
            place is reserved. No money is required.
          </div>
        ) : (
          <div className="notice">
            Your registration stays pending until organisers verify payment and
            approve the whole application.
          </div>
        )}
      </div>
      {data.open && (
        <RegistrationForm segments={data.segments} demo={data.demo} />
      )}
    </>
  );
}
