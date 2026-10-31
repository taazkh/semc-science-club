"use client";

import { useId, useMemo, useState } from "react";
import type { ContentItem } from "@/lib/types";
import { SearchField } from "./search-field";
import { ChangingValue } from "./editorial-motion";
import { ArrowUpRightIcon } from "./icons";
import "./members-blocks.css";

export function MemberDirectory({ members }: { members: ContentItem[] }) {
  const [query, setQuery] = useState("");
  const id = useId();
  const search = query.trim().toLowerCase();
  const filtered = useMemo(
    () =>
      members
        .filter(
          (member) =>
            member.group === "Student council" &&
            `${member.title} ${member.subtitle}`.toLowerCase().includes(search),
        )
        .sort((a, b) => (a.position ?? 999) - (b.position ?? 999)),
    [members, search],
  );

  return (
    <section
      className="shell members-section members-blocks"
      aria-labelledby={`${id}-heading`}
    >
      <div className="directory-tools">
        <div className="member-group-heading">
          <h2 id={`${id}-heading`}>Student council</h2>
          <p>Our student council members, in their club roles.</p>
        </div>
        <SearchField
          label="Find a member"
          placeholder="Find a name or role"
          value={query}
          onChange={setQuery}
        />
      </div>
      <p className="directory-count" role="status">
        <ChangingValue value={filtered.length} />{" "}
        {filtered.length === 1 ? "member" : "members"}{" "}
        {search ? "matching your search" : "in our student council"}
      </p>
      {filtered.length > 0 ? (
        <ul className="member-text-list">
          {filtered.map((member) => (
            <li key={member.id}><MemberCaption member={member} /></li>
          ))}
        </ul>
      ) : (
        <p className="notice member-block-empty">
          {search
            ? "No members match that name or role. Try another search."
            : "Introductions will follow school approval."}
        </p>
      )}
    </section>
  );
}

function MemberCaption({ member }: { member: ContentItem }) {
  return (
    <div className="member-block-caption">
      <h3>
        {member.url ? (
          <a className="member-block-link" href={member.url}>
            {member.title} <ArrowUpRightIcon size={18} aria-hidden="true" />
          </a>
        ) : (
          member.title
        )}
      </h3>
      {member.subtitle && (
        <p className="member-block-role">{member.subtitle}</p>
      )}
      {member.body && member.body !== member.subtitle && (
        <details className="member-profile member-block-profile">
          <summary>
            About {member.title.split(" ")[0]} <span aria-hidden="true">+</span>
          </summary>
          <p>{member.body}</p>
        </details>
      )}
    </div>
  );
}

