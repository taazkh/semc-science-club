import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import "./motion-polish.css";
import "./exhibition.css";
import "./refinements.css";
import "./october-redesign.css";
import "@/components/editorial-controls.css";
import "@/components/programme-context-menu.css";
import "./glass-corrections.css";
import { revealBootstrap } from "@/lib/redesign/reveal-bootstrap";
import { initialLoadingBootstrap } from "@/lib/redesign/initial-loading";
import { InitialLoadingScreen } from "@/components/initial-loading-screen";
import { FeedbackToasts } from "@/components/feedback-toast";
import {
  MotionFeedback,
  MotionPreferences,
} from "@/components/motion-feedback";
import { EditorialMotion } from "@/components/editorial-motion";
import { Navigation } from "@/components/navigation";
import Link from "next/link";
import { ArrowRightIcon } from "@/components/icons";
import { testAccessRequired } from "@/lib/access-token";
import { LeaveTestAccess } from "@/components/test-access-form";
const outfit = localFont({
  src: "../../public/fonts/outfit/outfit-latin-wght-normal.woff2",
  variable: "--font-outfit",
  display: "swap",
  weight: "100 900",
});
export const metadata: Metadata = {
  title: {
    default: "SEMC Science Club | STEMfest 2026",
    template: "%s | SEMC Science Club",
  },
  description:
    "Science beyond the classroom. Explore SEMC Science Club and its inter-school STEMfest, on 16 November 2026 in Dhaka.",
  robots: { index: false, follow: false },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      data-theme="dark"
      data-scroll-behavior="smooth"
      suppressHydrationWarning
      className={outfit.variable}
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: initialLoadingBootstrap + revealBootstrap,
          }}
        />
      </head>
      <body>
        <MotionPreferences>
          <InitialLoadingScreen />
          <MotionFeedback />
          <FeedbackToasts />
          <EditorialMotion />
          <a className="skip-link" href="#main">
            Skip to content
          </a>
          <Navigation />
          <main id="main" tabIndex={-1}>
            {children}
          </main>
          <footer className="footer">
            <div className="shell">
              <div className="footer-top">
                <div>
                  <Link href="/" className="footer-wordmark">
                    SEMC<span>Science Club</span>
                  </Link>
                  <p>
                    BAF Shaheen English Medium College
                    <br />
                    Tejgaon, Dhaka-1206, Bangladesh
                  </p>
                </div>
                <div className="footer-invitation">
                  <p>There’s more to discover.</p>
                  <Link href="/stemfest">
                    Explore STEMfest <ArrowRightIcon size={30} />
                  </Link>
                </div>
              </div>
              <div className="footer-bottom">
                <span>© {new Date().getFullYear()} SEMC Science Club</span>
                <nav aria-label="Footer">
                  <Link href="/contact">Contact</Link>
                  <Link href="/status">Application status</Link>
                  <Link href="/privacy">Privacy</Link>
                  <Link href="/admin">Organiser access</Link>
                  <a
                    href="https://skiper-ui.com"
                    target="_blank"
                    rel="noreferrer"
                  >
                    UI credits · Skiper
                  </a>
                  {testAccessRequired() && <LeaveTestAccess />}
                </nav>
              </div>
            </div>
          </footer>
        </MotionPreferences>
      </body>
    </html>
  );
}
