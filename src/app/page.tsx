import Link from "next/link";
import { registrationOptions } from "@/lib/server/repository";
import { ArrowRightIcon, ArrowUpRightIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { TextLink } from "@/components/common";
import { HeroOrbits } from "@/components/hero-orbits";
import { EventExplorer } from "@/components/event-explorer";
import { KineticText } from "@/components/kinetic-text";
import { LiquidGlassSurface } from "@/components/liquid-glass-surface";
import {
  MaskRevealText,
  FocusResolveText,
  TextEntrance,
} from "@/components/smooth-text";
import { ProgrammeContextMenu } from "@/components/programme-context-menu";
import { Reveal } from "@/components/reveal";
import {
  FestivalCountdown,
  MentorMessage,
  ParticipationIntro,
  ProgrammeIntro,
  VelocityStrip,
} from "@/components/exhibition-extras";
import { ParticipationSteps } from "@/components/participation-steps";
export const dynamic = "force-dynamic";
export default async function Home() {
  const { segments, content, open, demo } = await registrationOptions();
  const members = content
    .filter((p) => p.type === "member" && p.group === "Student council")
    .sort((a, b) => (a.position ?? 999) - (b.position ?? 999));
  return (
    <>
      <section className="home-hero shell">
        <div className="hero-affiliation">
          <TextEntrance
            text="BAF Shaheen English Medium College"
            variant="micro-scale-fade"
          />
          <TextEntrance text="Tejgaon, Dhaka" variant="fade-through" />
        </div>
        <div className="hero-main">
          <div className="home-landing-type">
            <h1>
              <MaskRevealText lines={["Science beyond", "the classroom."]} />
            </h1>
            <div className="hero-stage-action">
              <TextLink href="/stemfest#programme">
                Explore STEMfest 2026
              </TextLink>
            </div>
          </div>
          <HeroOrbits verticalOffset={0.08} />
          <div
            className="post-orbit-intro club-introduction"
            data-material="glass"
          >
            <LiquidGlassSurface strength={24} spotlight />
            <p>
              <TextEntrance
                text="We are SEMC Science Club. A place to explore ideas, ask better questions and build something worth sharing."
                variant="depth-parallax-words"
              />
            </p>
          </div>
        </div>
        <div className="festival-invitation" data-material="glass">
          <LiquidGlassSurface />
          <div className="invitation-title">
            <strong>
              <TextEntrance text="STEMfest 2026" variant="per-character-rise" />
            </strong>
            <span className="invitation-date">
              <TextEntrance
                text="16 November · Opens at 8 AM"
                variant="scale-down-fade"
              />
            </span>
          </div>
          <p>
            <FocusResolveText text="An inter-school festival of projects, robotics, olympiads and more." />
          </p>
          <Button asChild>
            <Link href="/stemfest">
              <TextEntrance text="Explore the festival" variant="reveal-text" />{" "}
              <ArrowRightIcon size={20} />
            </Link>
          </Button>
        </div>
      </section>
      <section id="home-programme" className="shell section programme-section">
        <div className="section-heading">
          <h2>
            <KineticText lines={["What will you", "bring to STEMfest?"]} />
          </h2>
          <p>
            <ProgrammeIntro>
              Projects, robotics, olympiads and more. Find an event that makes
              you want to try.
            </ProgrammeIntro>
          </p>
        </div>
        <ProgrammeContextMenu programmeHref="/stemfest#programme">
          <EventExplorer segments={segments} />
        </ProgrammeContextMenu>
        <VelocityStrip segments={segments} />
        <div className="home-countdown">
          <FestivalCountdown />
          <p>
            <TextEntrance
              text="One festival. Your next experiment."
              variant="reveal-text"
            />
          </p>
          <span>
            SEMC campus · Full daily schedule to be announced. Event rules are
            drafts.
          </span>
        </div>
      </section>
      <section className="participation-section shell" data-material="glass">
        <LiquidGlassSurface strength={24} spotlight />
        <div className="participation-grid">
          <div>
            <h2>
              <KineticText lines={["Your idea.", "Your next step."]} />
            </h2>
            <p>
              <ParticipationIntro
                lines={[
                  "Individual challenges and team projects,",
                  "together in one application.",
                ]}
              />
            </p>
            <TextLink href={open ? "/register" : "/stemfest#registration"}>
              {open ? "Start your registration" : "How participation works"}
            </TextLink>
          </div>
          <Reveal>
            <ParticipationSteps />
          </Reveal>
        </div>
        <p className="release-note">
          {open
            ? demo
              ? "Preview registration is open. Use fictional details; no money is required."
              : "Registration is open. Check eligibility and draft event rules before entering."
            : "Registration is closed. Entry instructions will be announced."}
        </p>
      </section>
      <section className="shell section people-preview">
        <div className="section-heading">
          <h2>
            <KineticText lines={["The people", "behind the questions."]} />
          </h2>
          <TextLink href="/members">Meet our members</TextLink>
        </div>
        <Reveal className="people-preview-list">
          {members.slice(0, 3).map((m) => (
            <Link key={m.id} href="/members">
              <span>{m.subtitle}</span>
              <h3>{m.title}</h3>
              <ArrowUpRightIcon size={22} />
            </Link>
          ))}
        </Reveal>
      </section>
      <MentorMessage />
    </>
  );
}
