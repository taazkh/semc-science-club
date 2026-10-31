import Link from "next/link";
import { KineticText } from "./kinetic-text";
import { LetterAccent } from "./editorial-motion";
import type { ReactNode } from "react";
import { ArrowRightIcon, ArrowUpRightIcon } from "./icons";
import { Button } from "./ui/button";
export function PageHeading({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="page-heading shell">
      <Link className="back-link" href="/">
        SEMC Science Club
      </Link>
      <h1>
        <KineticText lines={[title]} />
      </h1>
      <p>{description}</p>
      {children}
    </div>
  );
}
export function EmptyContent({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="empty-content">
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}
export function TextLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Link className="text-link" href={href}>
      {typeof children === "string" ? (
        <LetterAccent text={children} />
      ) : (
        children
      )}
      <ArrowRightIcon size={20} />
    </Link>
  );
}
export function FestivalCTA() {
  return (
    <section className="cta-band shell">
      <div>
        <p>Bring your curiosity.</p>
        <h2>
          <KineticText lines={["Find your place at STEMfest."]} />
        </h2>
      </div>
      <Button asChild>
        <Link href="/stemfest">
          Explore the festival <ArrowUpRightIcon size={20} />
        </Link>
      </Button>
    </section>
  );
}
