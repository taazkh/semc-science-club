import { redirect, notFound } from "next/navigation";
import { DomainError } from "@/lib/domain";
import { registrationOptions } from "@/lib/server/repository";
import { requireRehearsalAccess } from "@/lib/server/rehearsal";
import { RegistrationForm } from "@/components/registration-form";
import { PageHeading } from "@/components/common";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Private participant rehearsal",
  robots: { index: false, follow: false },
};
export default async function Rehearsal() {
  try {
    await requireRehearsalAccess();
  } catch (error) {
    if (error instanceof DomainError && error.status === 401)
      redirect("/access?next=/rehearsal");
    if (error instanceof DomainError && error.status === 403) notFound();
    throw error;
  }
  const data = await registrationOptions(true);
  return (
    <>
      <PageHeading
        title="Try your STEMfest entry."
        description="Private participant rehearsal"
      />
      <p className="shell rehearsal-note">
        Use fictional information. This rehearsal reserves no place and collects
        no money.
      </p>
      {data.open ? (
        <RegistrationForm segments={data.segments} demo rehearsal />
      ) : (
        <p className="shell notice">The rehearsal is currently closed.</p>
      )}
    </>
  );
}
