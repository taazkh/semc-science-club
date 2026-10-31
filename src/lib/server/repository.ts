import { readableAudit } from "../audit-display";
import "server-only";
import { unlink } from "node:fs/promises";
import path from "node:path";
import {
  createHash,
  randomUUID,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import {
  isDemo,
  isTestMode,
  isPreview,
  liveEnabled,
  supabaseConfigured,
  demoAllowed,
} from "./config";
import { db, docs, readDoc, saveDoc, transaction, audit } from "./demo-db";
import { service } from "./supabase";
import {
  initialFestival,
  proposedSegments,
  demoSegments,
  initialMembers,
} from "../catalog";
import {
  DomainError,
  festivalReady,
  priceEntries,
  priceCorrection,
  transition,
} from "../domain";
import type {
  Admin,
  Application,
  Audit,
  ContentItem,
  Festival,
  PublicData,
  Segment,
  PaymentProof,
} from "../types";
import { registrationSchema } from "../validation";
import {
  parsePaymentSubmission,
  samePaymentDetails,
} from "../payment-submission";
import { environmentSettings } from "./environment";
export const digest = (v: string) =>
  createHash("sha256").update(v).digest("hex");
function ensureDemo() {
  if (!demoAllowed())
    throw new DomainError(
      "Demo storage is restricted to a local preview.",
      403,
    );
}
function check(error: unknown) {
  if (error) {
    const e = error as { message?: string; code?: string };
    throw new DomainError(
      e.code === "23505"
        ? "These details are already associated with an application."
        : e.message || "The data service could not complete this request.",
      409,
    );
  }
}
export async function getPublicData(): Promise<PublicData> {
  if (isDemo()) {
    ensureDemo();
    return {
      festival: readDoc<Festival>("festival", "2026")!,
      segments: docs<Segment>("segment")
        .filter((s) => s.active !== false)
        .sort((a, b) => (a.position ?? 0) - (b.position ?? 0)),
      content: docs<ContentItem>("content").filter((c) => c.published),
      demo: true,
      liveEnabled: false,
    };
  }
  if (!supabaseConfigured())
    return {
      festival: initialFestival,
      segments: proposedSegments,
      content: initialMembers as ContentItem[],
      demo: false,
      liveEnabled: false,
    };
  const s = service();
  const [f, segments, content] = await Promise.all([
    s.from("festival_config").select("data").eq("id", "2026").single(),
    s.from("segments").select("data").order("position"),
    s.from("content").select("data").eq("published", true),
  ]);
  check(f.error);
  check(segments.error);
  check(content.error);
  return {
    festival: f.data!.data,
    segments: segments
      .data!.map((r) => r.data)
      .filter((s: Segment) => s.active !== false)
      .sort((a: Segment, b: Segment) => (a.position ?? 0) - (b.position ?? 0)),
    content: content.data!.map((r) => r.data),
    demo: isTestMode(),
    liveEnabled: liveEnabled(),
  };
}
export async function registrationOptions(rehearsal = false) {
  if (rehearsal) {
    const { requireRehearsalAccess } = await import("./rehearsal");
    await requireRehearsalAccess();
  }
  const data = await getPublicData();
  if (!isDemo() && !supabaseConfigured()) return { ...data, open: false };
  const setting = await environmentSettings();
  const previewOpen =
    isTestMode() &&
    setting.mode === "preview" &&
    setting.registrationEnabled &&
    (isDemo() || process.env.PREVIEW_REGISTRATION_ENABLED === "true");
  return {
    ...data,
    segments: data.segments,
    open:
      process.env.PUBLIC_RELEASE_STATE === "closed" && !rehearsal
        ? false
        : previewOpen ||
          (!isTestMode() &&
            setting.registrationEnabled &&
            data.liveEnabled &&
            festivalReady(data.festival)),
  };
}
export async function quoteApplication(raw: unknown, rehearsal = false) {
  const input = registrationSchema.pick({ entries: true }).parse(raw);
  const options = await registrationOptions(rehearsal);
  if (!options.open) throw new DomainError("Registration is not open.", 403);
  return priceEntries(input.entries, options.segments, options.demo);
}
export async function createApplication(raw: unknown, rehearsal = false) {
  const input = registrationSchema.parse(raw);
  const options = await registrationOptions(rehearsal);
  if (!options.open)
    throw new DomainError("Live registration is not open yet.", 403);
  const priced = priceEntries(input.entries, options.segments, options.demo);
  if (input.expectedTotal !== undefined && priced.total !== input.expectedTotal)
    throw new DomainError(
      "Fees changed while you were reviewing. Go back and review the updated total.",
      409,
    );
  const tokenHash = digest(input.token);
  const requestHash = digest(JSON.stringify(input));
  const application: Application = {
    id: randomUUID(),
    reference:
      (isTestMode() ? "TEST" : "SEMC") +
      "-26-" +
      randomBytes(5).toString("hex").toUpperCase(),
    createdAt: new Date().toISOString(),
    consentAt: new Date().toISOString(),
    contact: input.contact,
    ...priced,
    paymentStatus: priced.total === 0 ? "not_required" : "unsubmitted",
    isTest: isTestMode(),
    proofRequired: true,
    submittedAt: priced.total === 0 ? new Date().toISOString() : null,
    reviewDueAt:
      priced.total === 0
        ? new Date(Date.now() + 172800000).toISOString()
        : null,
    approvalStatus: "pending",
    emailSentAt: null,
    reconciliationRequired: false,
  };
  if (isDemo()) {
    ensureDemo();
    return transaction(() => {
      const old = db()
        .prepare(
          "SELECT data,request_hash FROM applications WHERE idempotency_key=?",
        )
        .get(input.idempotencyKey) as
        { data: string; request_hash: string } | undefined;
      if (old) {
        if (old.request_hash !== requestHash)
          throw new DomainError(
            "This submission key was already used for different details. Start a new application.",
            409,
          );
        return JSON.parse(old.data) as Application;
      }
      db()
        .prepare("INSERT INTO applications VALUES(?,?,?,?,?,?)")
        .run(
          application.id,
          application.reference,
          tokenHash,
          input.idempotencyKey,
          requestHash,
          JSON.stringify(application),
        );
      audit("participant", "application-created", application.id, null, {
        reference: application.reference,
      });
      return application;
    });
  }
  const { data, error } = await service().rpc("create_application", {
    p_application: application,
    p_token_hash: tokenHash,
    p_idempotency: input.idempotencyKey,
    p_request_hash: requestHash,
  });
  check(error);
  return data as Application;
}
export async function retrieveApplication(
  reference: string,
  token: string,
): Promise<Application> {
  if (!/^[a-f0-9]{64}$/.test(token))
    throw new DomainError(
      "The reference or private retrieval key is incorrect.",
      404,
    );
  await environmentSettings();
  const hash = digest(token);
  if (isDemo()) {
    ensureDemo();
    const r = db()
      .prepare("SELECT data,token_hash FROM applications WHERE reference=?")
      .get(reference) as { data: string; token_hash: string } | undefined;
    if (
      !r ||
      r.token_hash.length !== hash.length ||
      !timingSafeEqual(Buffer.from(r.token_hash), Buffer.from(hash))
    )
      throw new DomainError(
        "The reference or private retrieval key is incorrect.",
        404,
      );
    return JSON.parse(r.data);
  }
  const { data, error } = await service().rpc("retrieve_application", {
    p_reference: reference,
    p_token_hash: hash,
  });
  check(error);
  if (!data)
    throw new DomainError(
      "The reference or private retrieval key is incorrect.",
      404,
    );
  return data;
}
export async function submitPayment(
  reference: string,
  token: string,
  raw: unknown,
) {
  const submittedAt = new Date().toISOString();
  const simulated = isTestMode();
  let payment = parsePaymentSubmission(raw, simulated, submittedAt);
  const a = await retrieveApplication(reference, token);
  if (a.total === 0)
    throw new DomainError("This application does not need a payment.");
  if (a.proofRequired) {
    const { requireReadyProof } = await import("./payment-proofs");
    await requireReadyProof(a.id, payment.proofId);
  }
  if (new Date(payment.paidAt).getTime() > Date.now() + 300000)
    throw new DomainError("Payment time cannot be in the future.");
  if (payment.amount !== a.total)
    throw new DomainError(
      "Enter the full application total. Contact organisers about any payment difference.",
    );
  if (simulated && a.payment && samePaymentDetails(a.payment, payment))
    payment = a.payment;
  if (isDemo()) {
    ensureDemo();
    return transaction(() => {
      const current = JSON.parse(
        (
          db()
            .prepare("SELECT data FROM applications WHERE id=?")
            .get(a.id) as { data: string }
        ).data,
      ) as Application;
      if (current.payment) {
        if (
          (simulated && samePaymentDetails(current.payment, payment)) ||
          JSON.stringify(current.payment) === JSON.stringify(payment)
        )
          return current;
        throw new DomainError(
          "Payment details are already submitted. Contact organisers for corrections.",
          409,
        );
      }
      const dup = db()
        .prepare("SELECT application_id FROM payments WHERE transaction_id=?")
        .get(payment.transactionId);
      if (dup)
        throw new DomainError(
          "This transaction ID is already attached to an application. Contact organisers.",
          409,
        );
      db()
        .prepare("INSERT INTO payments VALUES(?,?)")
        .run(payment.transactionId, a.id);
      current.payment = payment;
      current.paymentStatus = "submitted";
      current.submittedAt = submittedAt;
      current.reviewDueAt = new Date(Date.now() + 172800000).toISOString();
      db()
        .prepare("UPDATE applications SET data=? WHERE id=?")
        .run(JSON.stringify(current), a.id);
      audit("participant", "payment-submitted", a.id, null, payment);
      return current;
    });
  }
  const { data, error } = await service().rpc("submit_payment", {
    p_reference: reference,
    p_token_hash: digest(token),
    p_payment: payment,
  });
  check(error);
  return data as Application;
}
// Supabase projects normally cap one response at 1,000 rows. Iterate so
// organiser views and CSV exports include the entire expected festival cohort.
async function allApplications() {
  const records: { data: Application }[] = [];
  const client = service();
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await client
      .from("applications")
      .select("data")
      .order("created_at", { ascending: false })
      .order("id")
      .range(offset, offset + 499);
    check(error);
    records.push(...((data || []) as { data: Application }[]));
    if (!data || data.length < 500) break;
  }
  return { data: records, error: null };
}
export async function adminData(admin: Admin) {
  const canReview = ["owner", "organiser"].includes(admin.role);
  if (isDemo()) {
    ensureDemo();
    return {
      pendingDeletions: canReview
        ? docs<{ id: string }>("application-deletion")
        : [],
      applications: canReview
        ? (
            db()
              .prepare("SELECT data FROM applications ORDER BY rowid DESC")
              .all() as { data: string }[]
          ).map((r) => JSON.parse(r.data) as Application)
        : [],
      content: docs<ContentItem>("content"),
      segments: docs<Segment>("segment"),
      festival: readDoc<Festival>("festival", "2026")!,
      permissions: [
        {
          user_id: admin.id,
          email: admin.email,
          role: admin.role,
          active: true,
        },
      ],
    };
  }
  const s = service();
  const results = await Promise.all([
    canReview ? allApplications() : Promise.resolve({ data: [], error: null }),
    s.from("content").select("data"),
    s.from("segments").select("data").order("position"),
    s.from("festival_config").select("data").eq("id", "2026").single(),
    admin.role === "owner"
      ? s.from("admin_permissions").select("user_id,email,role,active")
      : Promise.resolve({ data: [], error: null }),
  ]);
  results.forEach((r) => check(r.error));
  const pending = canReview
    ? await s.from("application_deletions").select("id")
    : { data: [], error: null };
  // The original deployed schema remains readable until the forward migration is applied.
  if (pending.error && !["42P01", "PGRST205"].includes(pending.error.code))
    check(pending.error);
  return {
    pendingDeletions: pending.data || [],
    applications: results[0].data!.map((r: { data: Application }) => r.data),
    content: results[1].data!.map((r: { data: ContentItem }) => r.data),
    segments: results[2].data!.map((r: { data: Segment }) => r.data),
    festival: results[3].data!.data as Festival,
    permissions: results[4].data,
  };
}
export async function reviewApplication(
  admin: Admin,
  id: string,
  action: string,
  payload: Record<string, unknown>,
) {
  if (isDemo()) {
    ensureDemo();
    return transaction(() => {
      const r = db()
        .prepare("SELECT data FROM applications WHERE id=?")
        .get(id) as { data: string } | undefined;
      if (!r) throw new DomainError("Application not found.", 404);
      const before = JSON.parse(r.data) as Application;
      if (action === "correct") {
        const c = payload.correction as {
          contact: Application["contact"];
          entries: Application["entries"];
        };
        payload = {
          ...payload,
          correction: {
            contact: c.contact,
            ...priceCorrection(
              c.entries,
              [...docs<Segment>("segment"), ...demoSegments],
              before.entries,
            ),
          },
        };
      }
      const after = transition(before, action, payload);
      if (action === "correct-payment") {
        const tx = after.payment!.transactionId;
        const existing = db()
          .prepare("SELECT application_id FROM payments WHERE transaction_id=?")
          .get(tx) as { application_id: string } | undefined;
        if (existing && existing.application_id !== id)
          throw new DomainError(
            "This transaction belongs to another application.",
            409,
          );
        db().prepare("INSERT OR IGNORE INTO payments VALUES(?,?)").run(tx, id);
      }
      db()
        .prepare("UPDATE applications SET data=? WHERE id=?")
        .run(JSON.stringify(after), id);
      audit(
        admin.id,
        action + (payload.reason ? ": " + payload.reason : ""),
        id,
        before,
        after,
      );
      return after;
    });
  }
  const { data, error } = await service().rpc("review_application", {
    p_actor: admin.id,
    p_id: id,
    p_action: action,
    p_payload: payload,
  });
  check(error);
  return data as Application;
}
export async function getAudit(id: string) {
  const records = await getRawAudit(id);
  const organisers: Record<string, string> = {};
  if (!isDemo()) {
    const { data, error } = await service()
      .from("admin_permissions")
      .select("user_id,email");
    check(error);
    for (const r of data || []) organisers[r.user_id] = r.email;
  }
  return records.map((r) => readableAudit(r, organisers));
}
async function getRawAudit(id: string): Promise<Audit[]> {
  if (isDemo())
    return (
      db()
        .prepare(
          "SELECT data FROM audit WHERE application_id=? ORDER BY rowid DESC",
        )
        .all(id) as { data: string }[]
    ).map((r) => JSON.parse(r.data) as Audit);
  const { data, error } = await service()
    .from("audit_records")
    .select("*")
    .eq("application_id", id)
    .order("created_at", { ascending: false });
  check(error);
  return data!.map((r) => ({
    id: r.id,
    applicationId: r.application_id,
    actor: r.actor_id,
    action: r.action,
    before: r.before_data,
    after: r.after_data,
    at: r.created_at,
  }));
}
export async function saveAdminDocument(
  admin: Admin,
  kind: "festival" | "segment" | "content",
  id: string,
  data: unknown,
  remove = false,
) {
  if (isDemo()) {
    ensureDemo();
    transaction(() => {
      const before = readDoc(kind, id);
      if (remove)
        db()
          .prepare("DELETE FROM documents WHERE kind=? AND id=?")
          .run(kind, id);
      else saveDoc(kind, id, data);
      audit(
        admin.id,
        remove ? "delete-" + kind : "save-" + kind,
        null,
        before,
        data,
      );
    });
    return;
  }
  const { error } = await service().rpc("save_admin_document", {
    p_actor: admin.id,
    p_kind: kind,
    p_id: id,
    p_data: data,
    p_remove: remove,
  });
  check(error);
}
export async function deleteAdminRecord(
  admin: Admin,
  kind: "application" | "content" | "segment",
  id: string,
) {
  const allowed =
    kind === "application"
      ? ["owner", "organiser"]
      : kind === "content"
        ? ["owner", "editor"]
        : ["owner"];
  if (!allowed.includes(admin.role))
    throw new DomainError(
      "Your account does not have permission for this action.",
      403,
    );
  let paths: string[] = [];
  if (isDemo()) {
    ensureDemo();
    paths = transaction(() => {
      if (kind !== "application") {
        if (kind === "segment") {
          const rows = db().prepare("SELECT data FROM applications").all() as {
            data: string;
          }[];
          if (
            rows.some((row) =>
              (JSON.parse(row.data) as Application).entries.some(
                (entry) => entry.segmentId === id,
              ),
            )
          )
            throw new DomainError(
              "This segment has applications. Hide it using the visibility setting instead.",
              409,
            );
        }
        const before = readDoc<ContentItem & Segment>(kind, id);
        db()
          .prepare("DELETE FROM documents WHERE kind=? AND id=?")
          .run(kind, id);
        if (before)
          audit(
            admin.id,
            "delete-" + kind,
            null,
            { id, name: before.title || before.name },
            null,
          );
        return [];
      }
      const row = db()
        .prepare("SELECT data FROM applications WHERE id=?")
        .get(id) as { data: string } | undefined;
      if (!row)
        return (
          readDoc<{ paths: string[] }>("application-deletion", id)?.paths || []
        );
      const app = JSON.parse(row.data) as Application;
      const proofs = docs<PaymentProof>("proof").filter(
        (proof) => proof.applicationId === id,
      );
      const files = [
        ...new Set(
          proofs.flatMap((proof) => [
            proof.path,
            ...[
              ".jpg",
              "-original.png",
              "-original.jpeg",
              "-original.webp",
            ].map((suffix) => `${id}/${proof.id}${suffix}`),
          ]),
        ),
      ];
      saveDoc("application-deletion", id, { id, paths: files });
      for (const proof of proofs)
        db()
          .prepare("DELETE FROM documents WHERE kind='proof' AND id=?")
          .run(proof.id);
      db().prepare("DELETE FROM payments WHERE application_id=?").run(id);
      db().prepare("DELETE FROM audit WHERE application_id=?").run(id);
      db().prepare("DELETE FROM applications WHERE id=?").run(id);
      audit(
        admin.id,
        "delete-application",
        null,
        { id, reference: app.reference },
        null,
      );
      return files;
    });
  } else {
    const result = await service().rpc("delete_admin_record", {
      p_actor: admin.id,
      p_kind: kind,
      p_id: id,
    });
    if (result.error?.code === "PGRST202")
      throw new DomainError(
        "Deletion needs the new administrator database migration. Existing records have not been changed.",
        503,
      );
    check(result.error);
    paths = result.data as string[];
  }
  if (kind !== "application") return;
  try {
    // Only paths belonging to this application may ever be removed.
    if (
      paths.some(
        (file) =>
          !file.startsWith(id + "/") ||
          file.includes("..") ||
          file.includes("\\"),
      )
    )
      throw new Error("Invalid screenshot path");
    if (isDemo()) {
      for (const file of paths)
        await unlink(
          path.join(process.cwd(), ".data", "payment-proofs", file),
        ).catch((error: NodeJS.ErrnoException) => {
          if (error.code !== "ENOENT") throw error;
        });
      db()
        .prepare(
          "DELETE FROM documents WHERE kind='application-deletion' AND id=?",
        )
        .run(id);
    } else {
      if (paths.length)
        check(
          (await service().storage.from("payment-proofs").remove(paths)).error,
        );
      check(
        (await service().from("application_deletions").delete().eq("id", id))
          .error,
      );
    }
  } catch {
    throw new DomainError(
      "Application deleted, but private screenshot cleanup is pending. Retry deletion or refresh and choose Retry screenshot cleanup.",
      503,
    );
  }
}
export async function rateLimit(key: string, limit = 30, windowSeconds = 600) {
  const hashed = digest(key);
  if (isDemo()) {
    ensureDemo();
    transaction(() => {
      const now = Math.floor(Date.now() / 1000);
      db().prepare("DELETE FROM limits WHERE expires<?").run(now);
      const r = db()
        .prepare("SELECT count FROM limits WHERE key=?")
        .get(hashed) as { count: number } | undefined;
      if (r && r.count >= limit)
        throw new DomainError(
          "Too many requests. Please wait a few minutes before trying again.",
          429,
        );
      db()
        .prepare(
          "INSERT INTO limits VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET count=count+1",
        )
        .run(hashed, 1, now + windowSeconds);
    });
    return;
  }
  if (!supabaseConfigured())
    throw new DomainError("Service is not configured yet.", 503);
  const { data, error } = await service().rpc("consume_rate_limit", {
    p_key: hashed,
    p_limit: limit,
    p_window: windowSeconds,
  });
  check(error);
  if (!data)
    throw new DomainError("Too many requests. Please try again later.", 429);
}
