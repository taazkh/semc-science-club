import { PageHeading, EmptyContent } from "@/components/common";
import { MapPinIcon, EnvelopeIcon, ArrowUpRightIcon } from "@/components/icons";
import { getPublicData } from "@/lib/server/repository";
export const metadata = { title: "Contact" };
export const dynamic = "force-dynamic";
export default async function Contact() {
  const { festival, content } = await getPublicData();
  return (
    <>
      <PageHeading
        title="Find us. Get in touch."
        description="Questions about the club or STEMfest? This is where to find the organisers."
      />
      <section className="shell contact-grid section">
        <div>
          <MapPinIcon size={32} />
          <h2>Find us at SEMC.</h2>
          <p>
            BAF Shaheen English Medium College
            <br />
            Tejgaon, Dhaka-1206
            <br />
            Bangladesh
          </p>
          <a
            className="text-link"
            href="https://www.google.com/maps/search/?api=1&query=BAF+Shaheen+English+Medium+College+Tejgaon+Dhaka"
            target="_blank"
            rel="noreferrer"
          >
            Open location search <ArrowUpRightIcon size={18} />
          </a>
        </div>
        <div>
          <EnvelopeIcon size={32} />
          <h2>Contact the organisers.</h2>
          {festival.contactEmail ? (
            <p>
              <a href={"mailto:" + festival.contactEmail}>
                {festival.contactEmail}
              </a>
            </p>
          ) : (
            <p>Contact details will be announced.</p>
          )}
          {festival.contactPhone && (
            <p>
              <a href={"tel:" + festival.contactPhone}>
                {festival.contactPhone}
              </a>
            </p>
          )}
          <p className="muted">
            For registration corrections, keep your reference ready. Do not
            share your private retrieval link publicly.
          </p>
        </div>
      </section>
      <section className="shell section sponsors">
        <h2>Made possible, together.</h2>
        <p>Our sponsors and supporters.</p>
        {content.some((c) => c.type === "sponsor") ? (
          <div className="sponsor-list">
            {content
              .filter((c) => c.type === "sponsor")
              .map((c) => (
                <div key={c.id}>
                  {c.image && (
                    <img src={c.image} alt="" width="160" height="80" />
                  )}
                  <h3>{c.title}</h3>
                  <p>{c.subtitle}</p>
                  {c.url && (
                    <a href={c.url} rel="noreferrer" target="_blank">
                      Visit sponsor
                    </a>
                  )}
                </div>
              ))}
          </div>
        ) : (
          <EmptyContent title="Sponsors will be announced.">
            Confirmed sponsors and supporters will be recognised here.
          </EmptyContent>
        )}
      </section>
    </>
  );
}
