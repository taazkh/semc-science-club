# SEMC Science Club

A school science-club website for BAF Shaheen English Medium College, with STEMfest 2026 as its main event. This repository is a source-code showcase of the website and its registration and organiser workflows. It does not contain participant records, payment proofs, credentials or personal profile photographs.

## What the project includes

- Public Home, STEMfest, event-detail, student-council Members and Contact pages.
- A programme of 17 segments, searchable and filterable by category, class and format.
- Original illustrative science diagrams and an orbital background, with bounded animation lifecycles and reduced-motion fallbacks.
- Individual and team registration, eligibility checks, server-calculated fees, participant reuse and local draft restoration.
- Private registration recovery, status tracking and payment-proof handling.
- An organiser workspace for application review, member and programme editing, access control and delayed deletion with cancellation.

The current registration mode uses **simulated payments**. This project does not collect actual money. Programme rules and the Home quotation copy include drafts; the quotation text should not be treated as verified statements by the named teachers. Profile photographs and stored sample registrations have been removed for this public source release.

## Implementation

Built with Next.js, React and TypeScript. Styling uses CSS and Tailwind; interface motion uses Motion, selected GSAP components and a WebGL orbital scene. Supabase provides the connected authentication, database and storage adapters. A separate SQLite adapter supports local demonstrations without service credentials.

The code implements server-side validation and pricing, role and session checks, private proof access and row-level database policies. These are implementation choices, not a claim of independent security certification or production readiness for another organisation. Review configuration, policies and event details before adapting it to real registrations.

Development included AI assistance with design exploration, implementation, debugging and documentation, alongside project-specific direction, review and iteration. Third-party component adaptations are credited in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). No attendance, impact or usage figures are claimed here.

## Run locally

Use **Node.js 24** and **pnpm 11**; the exact package-manager version is recorded in `package.json`.

```sh
pnpm install --frozen-lockfile
```

Copy `.env.example` to `.env.local`. Leave the service-key fields empty for a local demonstration; never commit a populated environment file.

```sh
node scripts/redesign-preview.mjs dev
```

Open <http://127.0.0.1:3004>. The isolated runner uses local demonstration storage and does not require Supabase credentials. At `/admin/login`, choose **Enter demo workspace** to inspect the local organiser interface. The local application list starts empty; no sample registrations or payment proofs are supplied. Local submissions made while exploring the form remain local.

For a production-build local preview:

```sh
node scripts/redesign-preview.mjs build
node scripts/redesign-preview.mjs start
```

For ordinary development on port 3000, use `pnpm dev` with the example's local demonstration settings. Connected Supabase operation requires your own project, migrations and authentication/storage configuration. Credentials and live registration activation are deliberately not supplied by this repository.

## Checks

```sh
pnpm typecheck
pnpm test
pnpm build
```

Tests cover pricing, validation, registration drafts, payment-submission handling, pending deletion, animation recovery and renderer lifecycles. Synthetic values in tests are fixtures, not exported participant applications. A passing test suite does not establish full device coverage or a security audit.

## Source map

| Path | Purpose |
| --- | --- |
| `src/app/` | Public pages, organiser pages and API routes |
| `src/components/` | Interface, forms, diagrams and motion |
| `src/lib/domain.ts` | Registration and pricing rules |
| `src/lib/server/` | Authentication, sessions and storage adapters |
| `supabase/migrations/` | Database structure, policies and transactional functions |
| `tests/` | Automated regression tests |
| `public/brand/`, `public/fonts/` | Project artwork and self-hosted fonts |

## Licence and assets

Original project code is covered by the repository's [MIT licence](LICENSE). Third-party components, dependencies and fonts retain their own licences; see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) and the notices included with their source. The supplied school and club artwork is excluded from the MIT grant and remains subject to its owners' rights. This repository is an application showcase, not a redistributable component library.
