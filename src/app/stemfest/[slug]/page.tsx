import { notFound } from "next/navigation";
import Link from "next/link";
import { getPublicData } from "@/lib/server/repository";
import { Button } from "@/components/ui/button";
import { ArrowLeftIcon, ArrowUpRightIcon } from "@/components/icons";
import { money } from "@/lib/catalog";
import { KineticText } from "@/components/kinetic-text";
import { ScienceFigure } from "@/components/science-figure";
export const dynamic = "force-dynamic";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const s = (await getPublicData()).segments.find((s) => s.id === slug);
  return { title: s?.name || "Segment not found" };
}
export default async function SegmentPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const s = (await getPublicData()).segments.find((s) => s.id === slug);
  if (!s) notFound();
  return (
    <section className="shell section segment-detail">
      <Link className="text-link" href="/stemfest#programme">
        <ArrowLeftIcon size={18} /> All segments
      </Link>
      <div className="segment-detail-grid">
        <div>
          <span className="muted">{s.category}</span>
          <h1>
            <KineticText lines={[s.name]} />
          </h1>
          <p className="lead">{s.description}</p>
          <div className="notice">
            {s.approved
              ? "Programme details supplied by the organisers."
              : "Proposed programme: this segment and its arrangements are awaiting confirmation."}
          </div>
          <h2>
            {s.rulesStatus === "approved"
              ? "Event rules"
              : "Draft rules—subject to organiser revision."}
          </h2>
          {s.rules ? (
            <ul className="event-rules">
              {s.rules.split(/(?<=[.!?])\s+(?=[A-Z])/).map((rule, index) => (
                <li key={index}>{rule}</li>
              ))}
            </ul>
          ) : (
            <p>
              Detailed participation rules, judging criteria, requirements and
              the schedule will be published once approved by the organisers.
            </p>
          )}
          {s.sources && s.sources.length > 0 && (
            <details>
              <summary>References used for these draft rules</summary>
              <p>
                These local rules draw on the references below. No affiliation
                or official sanction is implied.
              </p>
              <ul>
                {s.sources.map((url) => (
                  <li key={url}>
                    <a href={url} target="_blank" rel="noreferrer">
                      {new URL(url).hostname} guidance
                    </a>
                  </li>
                ))}
              </ul>
            </details>
          )}
          {s.kind === "exhibition" && (
            <p>
              This exhibition is informational. It is not currently available as
              a registration segment.
            </p>
          )}
        </div>
        <aside className="detail-aside">
          <ScienceFigure kind={s.id} interactive />
          <h3>Before you register</h3>
          <dl>
            <div>
              <dt>Eligibility</dt>
              <dd>
                {s.classes.length
                  ? "Classes " + s.classes.join(", ")
                  : "To be confirmed"}
              </dd>
            </div>
            <div>
              <dt>Entry format{s.minAge ? ` · Age ${s.minAge}+` : ""}</dt>
              <dd>
                {s.approved
                  ? s.kind === "team"
                    ? `Exactly ${s.minTeam} members`
                    : s.kind
                  : "To be confirmed"}
              </dd>
            </div>
            <div>
              <dt>Participation fee</dt>
              <dd>
                {s.fee === 0
                  ? "Free"
                  : s.fee !== null
                    ? money(s.fee) + (s.kind === "team" ? "/team" : "/person")
                    : "To be announced"}
              </dd>
            </div>
            <div>
              <dt>Event date</dt>
              <dd>
                16 November 2026<small>Daily schedule to be announced</small>
              </dd>
            </div>
          </dl>
          <Button asChild>
            <Link href="/register">
              View registration <ArrowUpRightIcon size={18} />
            </Link>
          </Button>
        </aside>
      </div>
    </section>
  );
}
