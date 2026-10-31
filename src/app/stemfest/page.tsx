import Link from "next/link";
import type { Metadata } from "next";
import { registrationOptions } from "@/lib/server/repository";
import { Programme } from "@/components/programme";
import { Button } from "@/components/ui/button";
import { HeroOrbits } from "@/components/hero-orbits";
import { TextEntrance, HorizontalTextReveal } from "@/components/smooth-text";
import { ProgrammeContextMenu } from "@/components/programme-context-menu";
import { LiquidGlassSurface } from "@/components/liquid-glass-surface";
import { KineticText } from "@/components/kinetic-text";
import StrokeText from "@/components/react-bits/stroke-text";
import {
  FestivalCountdown,
  ParticipationIntro,
  ProgrammeIntro,
} from "@/components/exhibition-extras";
import { Reveal } from "@/components/reveal";
import { MotionAccordion } from "@/components/motion-accordion";
import {
  ArrowUpRightIcon,
  CalendarBlankIcon,
  MapPinIcon,
  UsersThreeIcon,
} from "@/components/icons";
export const metadata: Metadata = { title: "STEMfest 2026" };
export const dynamic = "force-dynamic";
export default async function Festival() {
  const { segments, open, demo } = await registrationOptions();
  return (
    <>
      <section className="festival-page-hero shell">
        <div className="hero-affiliation">
          <Link href="/">
            <TextEntrance
              text="SEMC Science Club presents"
              variant="micro-scale-fade"
            />
          </Link>
          <span className="emboss-marker">
            <TextEntrance
              text="Inter-school science festival"
              variant="fade-through"
            />
          </span>
        </div>
        <div className="festival-masthead">
          <div className="festival-title-block">
            <h1>
              <StrokeText
                text="STEMfest"
                className="festival-stroke-line"
                strokeColor="var(--text)"
                fillColor="var(--text)"
              />
              <StrokeText
                text="2026."
                className="festival-stroke-line"
                strokeColor="var(--accent)"
                fillColor="var(--accent)"
              />
            </h1>
            <p className="festival-opening-line">
              <TextEntrance
                text="16 November. From 8 AM."
                variant="reveal-text"
              />
            </p>
            <div className="festival-actions">
              <Button asChild>
                <a href="#programme">
                  Explore the programme <ArrowUpRightIcon size={20} />
                </a>
              </Button>
              <Link className="festival-registration-link" href="/register">
                {open ? "Register for a challenge" : "Registration information"}
                <ArrowUpRightIcon size={18} />
              </Link>
            </div>
          </div>
          <div className="festival-countdown-surface" data-material="glass">
            <LiquidGlassSurface />
            <FestivalCountdown />
            <p>Projects to build. Problems to solve. Ideas to share.</p>
          </div>
        </div>
        <div className="festival-orbital-background">
          <HeroOrbits />
        </div>
      </section>
      <div className="festival-facts shell">
        <div>
          <CalendarBlankIcon />
          <span>
            16 November 2026
            <small>Opens at 8 AM · Dhaka time</small>
          </span>
        </div>
        <div>
          <MapPinIcon />
          <span>
            SEMC campus<small>Tejgaon, Dhaka-1206</small>
          </span>
        </div>
        <div>
          <UsersThreeIcon />
          <span>
            Inter-school<small>Students from other schools welcome</small>
          </span>
        </div>
      </div>
      <div className="shell festival-statement">
        <HorizontalTextReveal text="Bring your questions. Build your answers. Find your challenge at STEMfest." />
      </div>
      <section id="programme" className="shell section">
        <div className="section-heading">
          <h2>
            <KineticText lines={["Find your challenge."]} />
          </h2>
          <p>
            <ProgrammeIntro>{`Explore ${segments.length} events, formats and per-event fees. Draft rules remain subject to organiser revision.`}</ProgrammeIntro>
          </p>
        </div>
        <ProgrammeContextMenu programmeHref="/stemfest#programme">
          <Programme segments={segments} />
        </ProgrammeContextMenu>
      </section>
      <section className="shell section divisions">
        <div>
          <h2>
            <KineticText lines={["A place for", "different stages."]} />
          </h2>
          <p>
            Check each event’s eligibility. Senior-only events accept Classes
            8–12; Clash Royale also requires age 13 or older.
          </p>
        </div>
        <dl>
          <div>
            <dt>Junior</dt>
            <dd>Classes 3–5</dd>
          </div>
          <div>
            <dt>Intermediate</dt>
            <dd>Classes 6–7</dd>
          </div>
          <div>
            <dt>Senior</dt>
            <dd>Classes 8–12</dd>
          </div>
        </dl>
      </section>
      <section
        id="registration"
        className="shell section registration-guide"
        data-material="glass"
      >
        <LiquidGlassSurface strength={24} spotlight />
        <h2>
          <KineticText lines={["How to take part."]} />
        </h2>
        <div>
          <p className="participation-guide-intro">
            <ParticipationIntro
              lines={[
                "Choose your challenge. Bring your team.",
                "Keep every entry in one application.",
              ]}
            />
          </p>
          <ol className="steps-copy">
            <li>
              <h3>Choose your segments</h3>
              <p>
                Register yourself for individual events and enter your team
                rosters. You can choose multiple segments.
              </p>
            </li>
            <li>
              <h3>Check your total and save</h3>
              <p>
                Individual fees apply per person per segment. Team fees apply
                once per team per segment. Keep your private retrieval link.
              </p>
            </li>
            <li>
              <h3>
                {open && demo
                  ? "Try the simulated payment step"
                  : "Submit bKash payment details"}
              </h3>
              <p>
                {open && demo
                  ? "Use fictional transaction details and a sample screenshot to try the review process. No money is required. Free-only applications skip this step."
                  : "Follow the approved collection instructions when they become available. Enter transaction details and a screenshot for organiser verification. Registration and payment collection are not open yet."}
              </p>
            </li>
            <li>
              <h3>Wait for organiser approval</h3>
              <p>
                Your whole application stays pending while organisers check it.
                A confirmation email follows successful review and approval.
              </p>
            </li>
          </ol>
          <Button asChild>
            <Link href="/register">
              {open ? "Start your registration" : "Go to registration"}{" "}
              <ArrowUpRightIcon size={20} />
            </Link>
          </Button>
        </div>
      </section>
      <section className="shell section faq">
        <h2>
          <KineticText lines={["A few things", "to know."]} />
        </h2>
        <div>
          <MotionAccordion
            items={[
              [
                "Can I enter more than one segment?",
                "Yes. You can include individual and team entries in one application, subject to the final eligibility and schedule.",
              ],
              [
                "Do I need an account?",
                "No. Save the private retrieval link issued with your application. Your reference number alone cannot open your personal details.",
              ],
              [
                "How much does participation cost?",
                "Fees apply separately to each event: ৳100 for most events, ৳200 per team for Project Display and robotics. Clash Royale is free. Each event page lists its format and fee.",
              ],
              [
                "Can I change my application?",
                "After payment details are submitted, contact the organisers for corrections. Any changes that affect fees must be reconciled.",
              ],
              [
                "Are the dates and rules final?",
                "STEMfest opens at 8 AM on 16 November 2026, in Dhaka. The full daily schedule and final segment rules will be announced.",
              ],
            ]}
          />
        </div>
      </section>
    </>
  );
}
