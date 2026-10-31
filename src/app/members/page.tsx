import { PageHeading, FestivalCTA } from "@/components/common";
import { getPublicData } from "@/lib/server/repository";
import { MemberDirectory } from "@/components/member-directory";
export const metadata = { title: "Members" };
export const dynamic = "force-dynamic";
export default async function Members() {
  const members = (await getPublicData()).content.filter(
    (c) => c.type === "member" && c.group === "Student council",
  );
  return (
    <>
      <PageHeading
        title="Our student body."
        description="Meet the student council members who help our science club explore, learn and grow."
      />
      <MemberDirectory members={members} />
      <FestivalCTA />
    </>
  );
}
