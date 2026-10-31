"use client";
import { SearchField } from "./search-field";
import { useState } from "react";
import type { Segment } from "@/lib/types";
import { groupSegments } from "@/lib/programme-groups";
import { EventExplorer } from "./event-explorer";
import { ChangingValue } from "./editorial-motion";
import { AnimatedDropdown } from "./ui/animated-dropdown";
import RubberSegment from "./react-bits/rubber-segment";

export function Programme({ segments }: { segments: Segment[] }) {
  const [category, setCategory] = useState("All segments");
  const [query, setQuery] = useState("");
  const [format, setFormat] = useState("all");
  const [schoolClass, setSchoolClass] = useState("");
  const categories = [
    "All segments",
    ...groupSegments(segments).map((g) => g.category),
  ];
  const visible = segments.filter(
    (s) =>
      (category === "All segments" || s.category === category) &&
      (format === "all" || s.kind === format) &&
      (!schoolClass || s.classes.includes(Number(schoolClass))) &&
      s.name.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <>
      <div className="programme-tools">
        <div className="programme-category-scroll">
          <RubberSegment
            items={categories}
            value={category}
            onChange={setCategory}
            aria-label="Programme categories"
            draggable={false}
            equalSlots={false}
            trackColor="var(--surface)"
            thumbColor="var(--accent)"
            textColor="var(--text)"
            activeTextColor="var(--ink)"
          />
        </div>
        <SearchField
          label="Search segments"
          placeholder="Find a segment"
          value={query}
          onChange={setQuery}
        />
      </div>
      <details className="programme-filter-disclosure">
        <summary>
          Refine by class or entry format <span aria-hidden="true">+</span>
        </summary>
        <div className="programme-refinements">
          <AnimatedDropdown
            label="Your class"
            value={schoolClass}
            onChange={setSchoolClass}
            options={[
              { value: "", label: "Any class" },
              ...Array.from({ length: 10 }, (_, index) => ({
                value: String(index + 3),
                label: `Class ${index + 3}`,
              })),
            ]}
          />
          <AnimatedDropdown
            label="Entry format"
            value={format}
            onChange={setFormat}
            options={[
              { value: "all", label: "All formats" },
              { value: "individual", label: "Individual" },
              { value: "team", label: "Team" },
              { value: "exhibition", label: "Exhibition" },
            ]}
          />
          <button
            className="text-link"
            type="button"
            onClick={() => {
              setCategory("All segments");
              setQuery("");
              setFormat("all");
              setSchoolClass("");
            }}
          >
            Reset filters
          </button>
        </div>
      </details>
      <p className="programme-result" role="status">
        <ChangingValue value={visible.length} />{" "}
        {visible.length === 1 ? "event" : "events"}
        {category === "All segments" ? " to explore" : ` in ${category}`}
      </p>
      {visible.length ? (
        <EventExplorer segments={visible} full />
      ) : (
        <p>No segments match. Try another search or category.</p>
      )}
    </>
  );
}
