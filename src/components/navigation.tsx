"use client";
import Link from "next/link";
import { LiquidGlassSurface } from "./liquid-glass-surface";
import { usePathname } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ListIcon, XIcon, ArrowRightIcon } from "./icons";
import { motion, useReducedMotion } from "motion/react";
import SpecularButton from "./react-bits/specular-button";
const links = [
  ["/", "Home"],
  ["/stemfest", "STEMfest 2026"],
  ["/members", "Members"],
  ["/contact", "Contact"],
];
export function Navigation() {
  const path = usePathname();
  const publicRoute =
    path === "/" ||
    path === "/stemfest" ||
    path.startsWith("/stemfest/") ||
    path === "/members" ||
    path === "/contact" ||
    path === "/privacy";
  const reduced = useReducedMotion();
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState<string | null>(null);
  const [mobile, setMobile] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const headerRef = useRef<HTMLElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const [marker, setMarker] = useState<{ x: number; width: number } | null>(
    null,
  );
  useLayoutEffect(() => {
    const nav = navRef.current;
    if (!nav || mobile) {
      setMarker(null);
      return;
    }
    const measure = () => {
      const active = nav.querySelector<HTMLAnchorElement>(
        'a[aria-current="page"]',
      );
      if (!active) {
        setMarker(null);
        return;
      }
      const rect = active.getBoundingClientRect();
      setMarker({
        x: rect.left - nav.getBoundingClientRect().left,
        width: rect.width,
      });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(nav);
    document.fonts.addEventListener("loadingdone", measure);
    return () => {
      observer.disconnect();
      document.fonts.removeEventListener("loadingdone", measure);
    };
  }, [path, mobile]);
  useEffect(() => {
    const media = matchMedia("(max-width: 850px)");
    const update = () => {
      setMobile(media.matches);
      if (!media.matches) setOpen(false);
    };
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    if (!open) return;
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        toggleRef.current?.focus();
      }
    };
    const outside = (event: PointerEvent) => {
      if (!headerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", key);
    document.addEventListener("pointerdown", outside);
    return () => {
      document.removeEventListener("keydown", key);
      document.removeEventListener("pointerdown", outside);
    };
  }, [open]);
  return (
    <header className="site-header" ref={headerRef}>
      <div className="shell nav-wrap" data-material="glass">
        <LiquidGlassSurface radius={18} strength={32} />
        <Link href="/" className="brand" aria-label="SEMC Science Club home">
          <img
            src="/brand/semc-science-club.png"
            width="48"
            height="48"
            alt=""
          />
          <span>
            SEMC<span>Science Club</span>
          </span>
        </Link>
        <div className="nav-controls">
          <button
            className="menu-toggle"
            ref={toggleRef}
            aria-label={open ? "Close navigation" : "Open navigation"}
            aria-expanded={open}
            aria-controls="main-nav"
            onClick={() => setOpen(!open)}
          >
            <span
              className={open ? "menu-glyph is-open" : "menu-glyph"}
              aria-hidden="true"
            >
              <ListIcon size={24} />
              <XIcon size={24} />
            </span>
          </button>
        </div>
        <nav
          ref={navRef}
          id="main-nav"
          aria-label="Main navigation"
          inert={mobile && !open}
          className={open ? "nav-links is-open" : "nav-links"}
        >
          {links.map(([href, label]) => (
            <Link
              key={href}
              href={href}
              aria-current={
                path === href || (href !== "/" && path.startsWith(href))
                  ? "page"
                  : undefined
              }
              onClick={() => setOpen(false)}
              onPointerEnter={() => setHovered(href)}
              onPointerLeave={() => setHovered(null)}
              onFocus={() => setHovered(href)}
              onBlur={() => setHovered(null)}
            >
              {hovered === href && (
                <motion.i
                  className="nav-hover-plate"
                  aria-hidden="true"
                  initial={false}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.18 }}
                />
              )}
              <span className="nav-label">{label}</span>
              {(mobile || !marker) &&
                (path === href || (href !== "/" && path.startsWith(href))) && (
                  <i aria-hidden="true" className="nav-current-marker" />
                )}
            </Link>
          ))}
          {publicRoute ? (
            <SpecularButton
              href="/register"
              className="nav-action"
              size="sm"
              radius={6}
              onClick={() => setOpen(false)}
            >
              Registration <ArrowRightIcon size={17} />
            </SpecularButton>
          ) : (
            <Link
              href="/register"
              className="nav-action"
              onClick={() => setOpen(false)}
            >
              Registration <ArrowRightIcon size={17} />
            </Link>
          )}
          {!mobile && marker && (
            <motion.i
              aria-hidden="true"
              className="nav-current-marker"
              initial={false}
              style={{
                width: 1,
                right: "auto",
                transformOrigin: "left center",
              }}
              animate={{ x: marker.x, scaleX: marker.width }}
              transition={{ duration: reduced ? 0 : 0.22 }}
            />
          )}
        </nav>
      </div>
    </header>
  );
}
