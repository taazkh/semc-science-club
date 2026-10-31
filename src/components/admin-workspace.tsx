"use client";
import { SearchField } from "./search-field";
import { AdminRowMenu } from "./admin-row-menu";
import { notify } from "./feedback-toast";
import { FileAttachment } from "./file-attachment";
import { AnimatedCheckbox } from "./ui/animated-checkbox";
import { AnimatedDropdown } from "./ui/animated-dropdown";
import { LiquidGlassSurface } from "./liquid-glass-surface";
import { BusyIndicator } from "./busy-indicator";
import { motion, useReducedMotion } from "motion/react";
import { AdminSessionTimer } from "./admin-session-timer";
import { HoldButton } from "./react-bits/hold-button";
import { SwipeToast } from "./react-bits/swipe-toast";
import {
  PendingDeletionController,
  deletionMatchesSelection,
  type PendingDeletion,
} from "@/lib/pending-deletion";
import type { AuditView } from "@/lib/audit-display";
import { useEffect, useState, useCallback, useId, useRef } from "react";
import type {
  Admin,
  Application,
  ContentItem,
  Festival,
  Segment,
  Entry,
} from "@/lib/types";
import { api } from "@/lib/client-api";
import { money, demoSegments } from "@/lib/catalog";
import { PaymentProofViewer } from "./payment-form";
import { Button } from "./ui/button";
import { Field, Input, Textarea } from "./ui/input";
import {
  SignOutIcon,
  DownloadSimpleIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  XIcon,
} from "./icons";
type Data = {
  pendingDeletions: { id: string }[];
  applications: Application[];
  content: ContentItem[];
  festival: Festival;
  segments: Segment[];
  permissions: {
    user_id: string;
    email: string;
    role: string;
    active: boolean;
  }[];
};
type DeletionOperation = {
  target: "application" | "content" | "segment";
  id: string;
  label: string;
  selectionGeneration: number;
};
const emptyContent = (): ContentItem => ({
  id: "",
  type: "member",
  title: "",
  subtitle: "",
  body: "",
  image: "",
  url: "",
  group: "Student council",
  published: false,
});
function Badge({ value, label }: { value: string; label?: string }) {
  return (
    <span className={"badge " + value}>
      {label || (value === "not_required" ? "Payment not required" : value)}
    </span>
  );
}
export function AdminWorkspace({
  admin,
  demo,
  testMode,
}: {
  admin: Admin;
  demo: boolean;
  testMode: boolean;
}) {
  const reduced = useReducedMotion(),
    instanceId = useId();
  const auditRequest = useRef(0);
  const contentSelection = useRef(0),
    segmentSelection = useRef(0),
    workspaceAlive = useRef(false),
    mutationInFlight = useRef(false),
    deletionController =
      useRef<PendingDeletionController<DeletionOperation> | null>(null),
    commitDeletion = useRef<
      (value: PendingDeletion<DeletionOperation>) => Promise<void>
    >(async () => {}),
    deleteDialogRef = useRef<HTMLDialogElement>(null);
  useEffect(
    () => () => {
      auditRequest.current += 1;
    },
    [],
  );
  const [data, setData] = useState<Data | null>(null),
    [tab, setTab] = useState(
      admin.role === "editor" ? "Members" : "Registrations",
    ),
    [query, setQuery] = useState(""),
    [filter, setFilter] = useState("all"),
    [selected, setSelected] = useState<Application | null>(null),
    [history, setHistory] = useState<AuditView[]>([]),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [operationBusy, setBusy] = useState(false),
    [pendingDeletion, setPendingDeletion] =
      useState<PendingDeletion<DeletionOperation> | null>(null),
    [deletionToast, setDeletionToast] =
      useState<PendingDeletion<DeletionOperation> | null>(null),
    [deleteDialog, setDeleteDialog] = useState<DeletionOperation | null>(null),
    [editingContentId, setEditingContentId] = useState<string | null>(null),
    [edit, setEdit] = useState<ContentItem>(emptyContent()),
    [festival, setFestival] = useState<Festival | null>(null),
    [segment, setSegment] = useState<Segment | null>(null),
    [correction, setCorrection] = useState<Application | null>(null),
    [reason, setReason] = useState(""),
    [email, setEmail] = useState(""),
    [role, setRole] = useState("organiser"),
    [paymentEdit, setPaymentEdit] = useState<Application["payment"] | null>(
      null,
    ),
    [paymentReason, setPaymentReason] = useState(""),
    [netAmount, setNetAmount] = useState("");
  const [direction, setDirection] = useState(1),
    [contentPickerVersion, setContentPickerVersion] = useState(0),
    [contentFile, setContentFile] = useState<File | null>(null),
    [contentPreview, setContentPreview] = useState(""),
    [contentUploaded, setContentUploaded] = useState(false);
  const busy = operationBusy || pendingDeletion !== null;
  useEffect(() => {
    workspaceAlive.current = true;
    const controller = new PendingDeletionController<DeletionOperation>(
      (value) => {
        setPendingDeletion(value);
        if (value) setDeletionToast(value);
      },
      (value) => commitDeletion.current(value),
    );
    deletionController.current = controller;
    const visibility = () =>
      controller.pause("hidden", document.visibilityState !== "visible");
    const cancelSession = () => {
      controller.cancel();
      setDeleteDialog(null);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && controller.snapshot?.phase === "waiting") {
        event.preventDefault();
        cancelPendingDeletion();
      }
    };
    visibility();
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("semc-admin-expired", cancelSession);
    window.addEventListener("semc-admin-logout", cancelSession);
    window.addEventListener("keydown", escape);
    return () => {
      workspaceAlive.current = false;
      controller.dispose();
      deletionController.current = null;
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("semc-admin-expired", cancelSession);
      window.removeEventListener("semc-admin-logout", cancelSession);
      window.removeEventListener("keydown", escape);
    };
  }, []);
  useEffect(() => {
    const dialog = deleteDialogRef.current;
    if (!dialog) return;
    if (deleteDialog && !dialog.open) dialog.showModal();
    else if (!deleteDialog && dialog.open) dialog.close();
  }, [deleteDialog]);
  useEffect(() => {
    if (!contentFile) {
      setContentPreview("");
      return;
    }
    const url = URL.createObjectURL(contentFile);
    setContentPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [contentFile]);
  function selectContent(item?: ContentItem) {
    contentSelection.current += 1;
    setEdit(item || emptyContent());
    setEditingContentId(item?.id || null);
    setContentFile(null);
    setContentPreview("");
    setContentUploaded(false);
    setContentPickerVersion((value) => value + 1);
    setError("");
    setMessage("");
  }
  const reload = useCallback(async () => {
    const d = await api<Data>("/api/admin");
    if (workspaceAlive.current) {
      setData(d);
      setFestival(d.festival);
    }
    return d;
  }, []);
  useEffect(() => {
    reload().catch((e) => setError(e.message));
  }, [reload]);
  useEffect(() => {
    if (!selected) return;
    const frame = requestAnimationFrame(() => {
      const heading =
        document.querySelector<HTMLHeadingElement>(".admin-detail h2");
      heading?.setAttribute("tabindex", "-1");
      heading?.focus({ preventScroll: true });
      heading?.scrollIntoView({ block: "nearest" });
    });
    return () => cancelAnimationFrame(frame);
  }, [selected?.id]);
  async function run(fn: () => Promise<unknown>, success: string) {
    if (mutationInFlight.current || deletionController.current?.snapshot)
      return;
    mutationInFlight.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await fn();
      await reload();
      setMessage(success);
      notify(success, "success");
    } catch (e) {
      setError((e as Error).message);
      notify((e as Error).message, "error");
    } finally {
      mutationInFlight.current = false;
      setBusy(false);
    }
  }
  async function open(a: Application) {
    const request = ++auditRequest.current;
    setSelected(a);
    setHistory([]);
    setCorrection(null);
    setPaymentEdit(null);
    setPaymentReason("");
    setNetAmount("");
    setReason("");
    setError("");
    try {
      const { audit } = await api<{ audit: AuditView[] }>(
        "/api/admin?audit=" + a.id,
      );
      if (auditRequest.current === request) setHistory(audit);
    } catch (e) {
      if (auditRequest.current === request) setError((e as Error).message);
    }
  }
  function closeReview() {
    auditRequest.current += 1;
    setSelected(null);
    setHistory([]);
  }
  function askDelete(
    target: "application" | "content" | "segment",
    id: string,
    label: string,
  ) {
    if (mutationInFlight.current || deletionController.current?.snapshot)
      return;
    setDeleteDialog({
      target,
      id,
      label,
      selectionGeneration:
        target === "application"
          ? auditRequest.current
          : target === "content"
            ? contentSelection.current
            : segmentSelection.current,
    });
  }
  function scheduleDeletion() {
    if (!deleteDialog || mutationInFlight.current) return;
    if (deletionController.current?.queue({ ...deleteDialog })) {
      setDeleteDialog(null);
      setError("");
      setMessage("");
    }
  }
  function cancelPendingDeletion(token?: number) {
    if (token !== undefined && !deletionController.current?.isCurrent(token))
      return;
    const label = deletionController.current?.snapshot?.operation.label;
    if (!deletionController.current?.cancel()) return;
    setMessage(`Deletion cancelled${label ? ": " + label : "."}`);
  }
  commitDeletion.current = async (pending) => {
    const { target, id, label } = pending.operation;
    const controller = deletionController.current;
    if (!controller?.isCurrent(pending.token)) return;
    mutationInFlight.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    let failure = "";
    let refreshed: Data | undefined;
    try {
      await api("/api/admin", { kind: "delete", target, id });
    } catch (error) {
      failure = (error as Error).message;
    }
    try {
      refreshed = await reload();
    } catch (error) {
      failure ||= (error as Error).message;
    }
    if (workspaceAlive.current && controller.isCurrent(pending.token)) {
      const absent = refreshed
        ? !(
            target === "application"
              ? refreshed.applications
              : target === "content"
                ? refreshed.content
                : refreshed.segments
          ).some((item) => item.id === id)
        : !failure;
      if (absent) {
        if (
          target === "application" &&
          deletionMatchesSelection(
            pending.operation,
            selected?.id,
            auditRequest.current,
          )
        )
          closeReview();
        if (
          target === "content" &&
          deletionMatchesSelection(
            pending.operation,
            editingContentId,
            contentSelection.current,
          )
        )
          selectContent();
        if (
          target === "segment" &&
          deletionMatchesSelection(
            pending.operation,
            segment?.id,
            segmentSelection.current,
          )
        ) {
          segmentSelection.current += 1;
          setSegment(null);
        }
      }
      if (failure) {
        setError(failure);
        notify(failure, "error");
      } else {
        setMessage(`${label} deleted.`);
        notify(`${label} deleted.`, "success");
      }
      setBusy(false);
    }
    mutationInFlight.current = false;
  };
  async function review(action: string, payload: unknown = {}) {
    if (!selected) return;
    const request = auditRequest.current;
    const id = selected.id;
    await run(async () => {
      const r = await api<{ application: Application }>("/api/admin", {
        kind: "review",
        id,
        action,
        payload,
      });
      if (auditRequest.current === request) await open(r.application);
    }, "Application updated. The change is recorded in its history.");
  }
  const tabs = [
    ...(admin.role !== "editor" ? ["Registrations"] : []),
    ...(admin.role !== "organiser" ? ["Members"] : []),
    ...(admin.role === "owner" ? ["Festival", "Segments", "Access"] : []),
  ];
  const changeTab = (next: string) => {
    setDirection(tabs.indexOf(next) >= tabs.indexOf(tab) ? 1 : -1);
    setTab(next);
    setError("");
    setMessage("");
  };
  const editableContent =
    data?.content.filter((item) => item.type !== "post") || [];
  const uploadContentImage = (file: File) =>
    void run(async () => {
      const form = new FormData();
      form.append("file", file);
      const response = await fetch("/api/admin/upload", {
        method: "POST",
        body: form,
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(
          result.error || "Image upload was interrupted. Retry the upload.",
        );
      setEdit((value) => ({ ...value, image: result.url }));
      setContentUploaded(true);
    }, "Image uploaded. Save the content to use it.");
  const visible = (data?.applications || []).filter(
    (a) =>
      (filter === "all" ||
        a.approvalStatus === filter ||
        a.paymentStatus === filter ||
        (filter === "overdue" &&
          !!a.reviewDueAt &&
          new Date(a.reviewDueAt).getTime() < Date.now() &&
          a.approvalStatus !== "rejected" &&
          !a.emailSentAt)) &&
      [
        a.reference,
        a.contact.name,
        a.contact.email,
        a.contact.phone,
        a.payment?.transactionId || "",
        ...a.entries.flatMap((e) => [
          e.teamName || "",
          ...e.participants.map((p) => p.name),
        ]),
      ]
        .join(" ")
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  function changePerson(
    entryIndex: number,
    personIndex: number,
    field: string,
    value: string | number,
  ) {
    setCorrection((c) =>
      c
        ? {
            ...c,
            entries: c.entries.map((entry, i) =>
              i !== entryIndex
                ? entry
                : {
                    ...entry,
                    participants: entry.participants.map((p, j) =>
                      j !== personIndex ? p : { ...p, [field]: value },
                    ),
                  },
            ),
          }
        : null,
    );
  }
  return (
    <div className="shell admin-shell">
      <div className="admin-heading">
        <div>
          <h1>Organiser workspace</h1>
          <p>
            {admin.email} · {admin.role}
          </p>
        </div>
        <AdminSessionTimer initialExpiresAt={admin.expiresAt!} />
        <Button
          variant="secondary"
          onClick={() => window.dispatchEvent(new Event("semc-admin-logout"))}
        >
          <SignOutIcon size={18} />
          Sign out
        </Button>
      </div>
      {testMode && (
        <div className="notice">
          <strong>Tester workspace.</strong> Applications and payments are
          tests. The programme and prices are supplied by the organisers.
          Content changes persist in the preview database. Email markers do not
          send emails.
        </div>
      )}
      <div
        className="admin-tabs"
        role="tablist"
        aria-label="Administrator sections"
        onKeyDown={(event) => {
          if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key))
            return;
          event.preventDefault();
          const index = tabs.indexOf(tab);
          const next =
            event.key === "Home"
              ? 0
              : event.key === "End"
                ? tabs.length - 1
                : (index +
                    (event.key === "ArrowRight" ? 1 : -1) +
                    tabs.length) %
                  tabs.length;
          changeTab(tabs[next]);
          event.currentTarget
            .querySelectorAll<HTMLButtonElement>("button")
            [next].focus();
        }}
      >
        {tabs.map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            id={`${instanceId}-tab-${t}`}
            aria-selected={tab === t}
            aria-controls={`${instanceId}-panel`}
            tabIndex={tab === t ? 0 : -1}
            onClick={() => changeTab(t)}
          >
            {tab === t && (
              <motion.i
                className="admin-tab-plate"
                aria-hidden="true"
                layoutId={reduced !== false ? undefined : `${instanceId}-tabs`}
                transition={{ duration: 0.22 }}
              />
            )}
            <span>{t}</span>
          </button>
        ))}
      </div>
      {error && (
        <div className="form-error" role="alert">
          {error}
        </div>
      )}
      {message && (
        <div className="form-success" role="status">
          {message}
        </div>
      )}
      <motion.div
        id={`${instanceId}-panel`}
        role="tabpanel"
        aria-labelledby={`${instanceId}-tab-${tab}`}
        key={tab}
        initial={
          reduced !== false ? false : { opacity: 0.45, x: 12 * direction }
        }
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: reduced !== false ? 0 : 0.2 }}
        aria-busy={busy || !data}
      >
        {!data && <BusyIndicator label="Loading workspace…" />}
        {data && tab === "Registrations" && (
          <>
            <div className="admin-toolbar">
              <SearchField
                label="Search registrations"
                placeholder="Name, reference or transaction"
                value={query}
                onChange={setQuery}
              />
              <AnimatedDropdown
                label="Filter registrations"
                value={filter}
                onChange={setFilter}
                options={[
                  { value: "all", label: "All statuses" },
                  ...[
                    "pending",
                    "submitted",
                    "verified",
                    "approved",
                    "not_required",
                    "overdue",
                    "rejected",
                    "unsubmitted",
                  ].map((value) => ({
                    value,
                    label: value
                      .replaceAll("_", " ")
                      .replace(/^./, (letter) => letter.toUpperCase()),
                  })),
                ]}
              />
              <p>
                {visible.length} application{visible.length !== 1 ? "s" : ""}
              </p>
              <Button asChild variant="secondary">
                <a href="/api/admin/export">
                  <DownloadSimpleIcon size={18} />
                  Export all CSV
                </a>
              </Button>
            </div>
            <div
              className="table-scroll"
              tabIndex={0}
              role="region"
              aria-label="Registration table, scroll horizontally on small screens"
            >
              <table>
                <thead>
                  <tr>
                    {[
                      "Application",
                      "Contact",
                      "Total",
                      "Payment",
                      "Approval",
                      "Confirmation email",
                      "Action",
                    ].map((t) => (
                      <th key={t}>{t}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visible.map((a) => (
                    <tr
                      key={a.id}
                      tabIndex={0}
                      aria-label={`Application ${a.reference}`}
                    >
                      <td>
                        {a.reference}
                        <small>
                          {new Date(a.createdAt).toLocaleDateString("en-GB")}
                        </small>
                      </td>
                      <td>
                        {a.contact.name}
                        <small>{a.contact.email}</small>
                      </td>
                      <td>{money(a.total)}</td>
                      <td>
                        <Badge value={a.paymentStatus} />
                      </td>
                      <td>
                        <Badge value={a.approvalStatus} />
                      </td>
                      <td>
                        <Badge
                          value={a.emailSentAt ? "verified" : "pending"}
                          label={
                            a.emailSentAt ? "Marked sent" : "Not marked sent"
                          }
                        />
                        {a.emailSentAt && (
                          <small>
                            {new Date(a.emailSentAt).toLocaleDateString(
                              "en-GB",
                            )}
                          </small>
                        )}
                      </td>
                      <td>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => open(a)}
                        >
                          Review
                        </Button>
                        <AdminRowMenu
                          reference={a.reference}
                          onReview={() => void open(a)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!visible.length && (
                <p style={{ padding: 24 }}>No registrations match this view.</p>
              )}
            </div>
            <p className="admin-export-help">
              CSV downloads all applications for Excel or Google Sheets,
              including contacts, rosters, fees and status. Confirmation emails
              are sent manually; “Marked sent” records an organiser’s action.
            </p>
            {!!data.pendingDeletions?.length && (
              <div className="notice">
                <p>
                  Some deleted applications still have private screenshot
                  cleanup pending.
                </p>
                <Button
                  variant="secondary"
                  disabled={busy}
                  onClick={() =>
                    run(async () => {
                      for (const item of data.pendingDeletions)
                        await api("/api/admin", {
                          kind: "delete",
                          target: "application",
                          id: item.id,
                        });
                    }, "Private screenshot cleanup completed.")
                  }
                >
                  Retry screenshot cleanup
                </Button>
              </div>
            )}
            {selected && (
              <section
                className="form-panel admin-detail"
                data-material="glass"
              >
                <LiquidGlassSurface strength={18} />
                <div className="admin-detail-head">
                  <div>
                    <h2>{selected.reference}</h2>
                    <p>
                      {selected.contact.name} · {selected.contact.email}
                    </p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={closeReview}>
                    <XIcon size={18} />
                    Close
                  </Button>
                </div>
                <div className="review-grid">
                  <div>
                    <h3>Entries and roster</h3>
                    {selected.entries.map((e) => (
                      <div className="roster" key={e.segmentId}>
                        <strong>
                          {e.segmentName} {e.teamName && "· " + e.teamName}
                        </strong>
                        {e.participants.map((p, i) => (
                          <p key={i}>
                            {p.name}
                            <br />
                            <small>
                              {p.school} · Class {p.class}
                              {p.age ? ` · Age ${p.age}` : ""}
                            </small>
                          </p>
                        ))}
                        <p>
                          {money(e.price || 0)}{" "}
                          {e.kind === "team" ? "per team" : "per person"}
                        </p>
                      </div>
                    ))}
                    <strong>Total: {money(selected.total)}</strong>
                  </div>
                  <div>
                    <h3>Payment review</h3>
                    <p>
                      <strong>
                        {selected.isTest || demo
                          ? "TEST application"
                          : "Live application"}
                      </strong>
                    </p>
                    {selected.submittedAt && (
                      <p>
                        Submitted:{" "}
                        {new Date(selected.submittedAt).toLocaleString("en-GB")}
                      </p>
                    )}
                    {selected.reviewDueAt && (
                      <p>
                        Review deadline:{" "}
                        {new Date(selected.reviewDueAt).toLocaleString("en-GB")}
                      </p>
                    )}
                    <PaymentProofViewer
                      key={selected.id}
                      application={selected}
                      admin
                    />
                    {selected.payment ? (
                      <>
                        <p>
                          Transaction:{" "}
                          <strong>{selected.payment.transactionId}</strong>
                          <br />
                          Sender: {selected.payment.sender}
                          <br />
                          Amount: {money(selected.payment.amount)}
                          <br />
                          {selected.payment.timeSource === "submission"
                            ? "Simulation submitted: "
                            : "Paid: "}
                          {new Date(selected.payment.paidAt).toLocaleString(
                            "en-GB",
                          )}
                        </p>
                        <p className="fine-print">
                          Check the collection account independently before
                          marking this payment verified.
                        </p>
                      </>
                    ) : (
                      <p>
                        {selected.total === 0
                          ? "Payment not required. Free application queued for review."
                          : "No payment details have been submitted."}
                      </p>
                    )}
                    {selected.reconciliationRequired && (
                      <div className="notice">
                        Fees changed. Reconcile the payment difference before
                        approval.
                      </div>
                    )}
                    <div className="editor-actions">
                      <Button
                        size="sm"
                        disabled={
                          busy ||
                          !selected.payment ||
                          selected.paymentStatus === "verified"
                        }
                        onClick={() => review("verify")}
                      >
                        Mark payment verified
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={busy || !selected.payment}
                        onClick={() => review("reject-payment")}
                      >
                        Reject payment
                      </Button>
                    </div>
                    <details style={{ marginTop: 24 }}>
                      <summary>Correct or reconcile payment</summary>
                      <p className="fine-print">
                        Only record amounts checked against actual receipts or
                        refunds. All changes preserve the original history.
                      </p>
                      <Button
                        size="sm"
                        variant="secondary"
                        type="button"
                        disabled={!selected.payment}
                        onClick={() =>
                          setPaymentEdit(
                            selected.payment ? { ...selected.payment } : null,
                          )
                        }
                      >
                        Edit payment details
                      </Button>
                      {paymentEdit && (
                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            void review("correct-payment", {
                              reason: paymentReason,
                              payment: paymentEdit,
                            });
                          }}
                        >
                          <Field label="Correct transaction ID">
                            <Input
                              required
                              minLength={6}
                              value={paymentEdit.transactionId}
                              onChange={(e) =>
                                setPaymentEdit({
                                  ...paymentEdit,
                                  transactionId: e.target.value.toUpperCase(),
                                })
                              }
                            />
                          </Field>
                          <Field label="Correct sender number">
                            <Input
                              required
                              value={paymentEdit.sender}
                              onChange={(e) =>
                                setPaymentEdit({
                                  ...paymentEdit,
                                  sender: e.target.value,
                                })
                              }
                            />
                          </Field>
                          <Field label="Correct recorded amount">
                            <Input
                              required
                              type="number"
                              min={1}
                              value={paymentEdit.amount}
                              onChange={(e) =>
                                setPaymentEdit({
                                  ...paymentEdit,
                                  amount: Number(e.target.value),
                                })
                              }
                            />
                          </Field>
                          <Field label="Payment correction reason">
                            <Textarea
                              required
                              value={paymentReason}
                              onChange={(e) => setPaymentReason(e.target.value)}
                            />
                          </Field>
                          <Button size="sm" disabled={busy}>
                            Save payment correction
                          </Button>
                        </form>
                      )}
                      {selected.reconciliationRequired && (
                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            void review("reconcile", {
                              reason: paymentReason,
                              effectiveAmount: Number(netAmount),
                            });
                          }}
                        >
                          <Field label="Verified net amount after reconciliation">
                            <Input
                              required
                              type="number"
                              min={1}
                              value={netAmount}
                              onChange={(e) => setNetAmount(e.target.value)}
                            />
                          </Field>
                          <Field
                            label="Reconciliation evidence"
                            hint="Record receipt/refund references and explain the amount adjustment."
                          >
                            <Textarea
                              required
                              value={paymentReason}
                              onChange={(e) => setPaymentReason(e.target.value)}
                            />
                          </Field>
                          <Button size="sm" disabled={busy}>
                            Record reconciliation and verify
                          </Button>
                        </form>
                      )}
                    </details>
                    <h3>Whole application</h3>
                    <div className="editor-actions">
                      <Button
                        size="sm"
                        disabled={
                          busy ||
                          (selected.paymentStatus !== "verified" &&
                            !(
                              selected.total === 0 &&
                              selected.paymentStatus === "not_required"
                            )) ||
                          selected.reconciliationRequired ||
                          selected.approvalStatus === "approved"
                        }
                        onClick={() => review("approve")}
                      >
                        Approve application
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={busy}
                        onClick={() => review("reject")}
                      >
                        Reject application
                      </Button>
                    </div>
                    <h3>Confirmation email</h3>
                    <p className="fine-print">
                      Send the email separately, then record that action. This
                      marker does not send an email or prove delivery.
                    </p>
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={
                        busy ||
                        selected.approvalStatus !== "approved" ||
                        selected.reconciliationRequired ||
                        (selected.paymentStatus !== "verified" &&
                          !(
                            selected.total === 0 &&
                            selected.paymentStatus === "not_required"
                          )) ||
                        !!selected.emailSentAt
                      }
                      onClick={() => review("email-sent")}
                    >
                      {selected.emailSentAt
                        ? "Email already marked sent"
                        : "Mark confirmation email sent"}
                    </Button>
                  </div>
                </div>
                <div style={{ marginTop: 30 }}>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setCorrection(structuredClone(selected));
                      setReason("");
                    }}
                  >
                    Correct contact or entries
                  </Button>
                </div>
                {correction && (
                  <form
                    style={{ marginTop: 28 }}
                    onSubmit={(e) => {
                      e.preventDefault();
                      void review("correct", {
                        reason,
                        correction: {
                          contact: correction.contact,
                          entries: correction.entries,
                        },
                      });
                    }}
                  >
                    <h3>Organiser correction</h3>
                    <p>
                      Entries are repriced using current configured fees.
                      Changed totals require payment reconciliation and reset
                      approval.
                    </p>
                    <div className="field-grid">
                      {(["name", "email", "phone"] as const).map((k) => (
                        <Field label={"Contact " + k} key={k}>
                          <Input
                            required
                            type={k === "email" ? "email" : "text"}
                            value={correction.contact[k]}
                            onChange={(e) =>
                              setCorrection({
                                ...correction,
                                contact: {
                                  ...correction.contact,
                                  [k]: e.target.value,
                                },
                              })
                            }
                          />
                        </Field>
                      ))}
                    </div>
                    {correction.entries.map((entry, ei) => (
                      <div className="roster" key={entry.segmentId}>
                        <div className="roster-head">
                          <h3>{entry.segmentName}</h3>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={correction.entries.length === 1}
                            onClick={() =>
                              setCorrection({
                                ...correction,
                                entries: correction.entries.filter(
                                  (_, i) => i !== ei,
                                ),
                              })
                            }
                          >
                            Remove entry
                          </Button>
                        </div>
                        {entry.kind === "team" && (
                          <Field label="Team name">
                            <Input
                              value={entry.teamName || ""}
                              onChange={(e) =>
                                setCorrection({
                                  ...correction,
                                  entries: correction.entries.map((x, i) =>
                                    i === ei
                                      ? { ...x, teamName: e.target.value }
                                      : x,
                                  ),
                                })
                              }
                            />
                          </Field>
                        )}
                        {entry.participants.map((p, pi) => (
                          <div className="field-grid" key={pi}>
                            <Field label={"Participant " + (pi + 1)}>
                              <Input
                                required
                                value={p.name}
                                onChange={(e) =>
                                  changePerson(ei, pi, "name", e.target.value)
                                }
                              />
                            </Field>
                            <Field label="School">
                              <Input
                                required
                                value={p.school}
                                onChange={(e) =>
                                  changePerson(ei, pi, "school", e.target.value)
                                }
                              />
                            </Field>
                            {data.segments.find((s) => s.id === entry.segmentId)
                              ?.minAge && (
                              <Field label="Age on event date">
                                <Input
                                  type="number"
                                  required
                                  min={
                                    data.segments.find(
                                      (s) => s.id === entry.segmentId,
                                    )?.minAge || 5
                                  }
                                  max={30}
                                  value={p.age ?? ""}
                                  onChange={(event) =>
                                    changePerson(
                                      ei,
                                      pi,
                                      "age",
                                      Number(event.target.value),
                                    )
                                  }
                                />
                              </Field>
                            )}
                            <Field label="Class">
                              <Input
                                required
                                type="number"
                                min={3}
                                max={12}
                                value={p.class}
                                onChange={(e) =>
                                  changePerson(
                                    ei,
                                    pi,
                                    "class",
                                    Number(e.target.value),
                                  )
                                }
                              />
                            </Field>
                            {entry.kind === "team" && (
                              <Button
                                type="button"
                                variant="ghost"
                                onClick={() =>
                                  setCorrection({
                                    ...correction,
                                    entries: correction.entries.map((x, i) =>
                                      i === ei
                                        ? {
                                            ...x,
                                            participants: x.participants.filter(
                                              (_, j) => j !== pi,
                                            ),
                                          }
                                        : x,
                                    ),
                                  })
                                }
                              >
                                Remove participant
                              </Button>
                            )}
                          </div>
                        ))}
                        {entry.kind === "team" && (
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={() =>
                              setCorrection({
                                ...correction,
                                entries: correction.entries.map((x, i) =>
                                  i === ei
                                    ? {
                                        ...x,
                                        participants: [
                                          ...x.participants,
                                          { name: "", school: "", class: 8 },
                                        ],
                                      }
                                    : x,
                                ),
                              })
                            }
                          >
                            Add participant
                          </Button>
                        )}
                      </div>
                    ))}
                    <Field label="Add another segment">
                      <AnimatedDropdown
                        label="Add another segment"
                        value=""
                        onChange={(value) => {
                          const s = [
                            ...data.segments,
                            ...(demo ? demoSegments : []),
                          ].find((s) => s.id === value);
                          if (s)
                            setCorrection({
                              ...correction,
                              entries: [
                                ...correction.entries,
                                {
                                  segmentId: s.id,
                                  segmentName: s.name,
                                  kind: s.kind,
                                  teamName: s.kind === "team" ? "" : "",
                                  participants: Array.from(
                                    {
                                      length:
                                        s.kind === "team" ? s.minTeam || 2 : 1,
                                    },
                                    () => ({ name: "", school: "", class: 8 }),
                                  ),
                                },
                              ],
                            });
                        }}
                        options={[
                          { value: "", label: "Choose an available segment" },
                          ...[...data.segments, ...(demo ? demoSegments : [])]
                            .filter(
                              (s) =>
                                s.approved &&
                                !correction.entries.some(
                                  (e) => e.segmentId === s.id,
                                ) &&
                                s.kind !== "exhibition",
                            )
                            .map((s) => ({ value: s.id, label: s.name })),
                        ]}
                      />
                    </Field>
                    <Field label="Reason for correction">
                      <Textarea
                        required
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                      />
                    </Field>
                    <Button disabled={busy}>Save audited correction</Button>
                  </form>
                )}
                <h3 style={{ marginTop: 35 }}>Correction and review history</h3>
                <ul className="audit-list">
                  {history.map((a) => (
                    <li key={a.id}>
                      <strong>{a.title}</strong>
                      <small>
                        {new Date(a.at).toLocaleString("en-GB")} · {a.actor}
                      </small>
                      <details>
                        <summary>View recorded change</summary>
                        {a.reason && (
                          <p>
                            <strong>Reason:</strong> {a.reason}
                          </p>
                        )}
                        <dl className="audit-changes">
                          {a.changes.map((change, i) => (
                            <div key={i}>
                              <dt>{change.label}</dt>
                              <dd>
                                <span>Before:</span> {change.before}
                              </dd>
                              <dd>
                                <span>After:</span> {change.after}
                              </dd>
                            </div>
                          ))}
                        </dl>
                        {!a.changes.length && (
                          <p>No application details changed.</p>
                        )}
                      </details>
                    </li>
                  ))}
                  {!history.length && <li>No review actions recorded yet.</li>}
                </ul>
                <div className="delete-section">
                  <p>
                    Permanently remove this application and its payment
                    screenshot.
                  </p>
                  <Button
                    variant="danger"
                    disabled={busy}
                    onClick={() =>
                      askDelete("application", selected.id, selected.reference)
                    }
                  >
                    Delete application
                  </Button>
                </div>
              </section>
            )}
          </>
        )}
        {data && tab === "Members" && (
          <div className="content-editor-grid">
            <div>
              <div className="roster-head">
                <h2 style={{ fontSize: "1.6rem" }}>Members</h2>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={busy}
                  onClick={() => selectContent()}
                >
                  <PlusIcon size={16} />
                  New
                </Button>
              </div>
              <ul className="content-list">
                {editableContent.map((c) => (
                  <li key={c.id}>
                    <div>
                      <strong>{c.title}</strong>
                      <small>
                        {c.type} · {c.published ? "Published" : "Draft"}
                      </small>
                    </div>
                    <div className="editor-actions">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={operationBusy}
                        onClick={() => selectContent(c)}
                      >
                        Edit
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
              {!editableContent.length && (
                <p>
                  Add confirmed members or supporters. Keep unknown profiles and
                  supporters unpublished.
                </p>
              )}
            </div>
            <form
              className="form-panel"
              onSubmit={(e) => {
                e.preventDefault();
                void run(async () => {
                  await api("/api/admin", { kind: "content", data: edit });
                  setEditingContentId(edit.id);
                }, "Content saved.");
              }}
            >
              <h2>{edit.id ? "Edit content" : "New content"}</h2>
              <div className="field-grid">
                <Field label="Content type">
                  <AnimatedDropdown
                    label="Content type"
                    value={edit.type}
                    onChange={(value) => {
                      setContentFile(null);
                      setContentUploaded(false);
                      setContentPreview("");
                      setContentPickerVersion((version) => version + 1);
                      setEdit({
                        ...edit,
                        type: value as ContentItem["type"],
                        image: "",
                        group: value === "member" ? "Student council" : "",
                      });
                    }}
                    options={[
                      { value: "member", label: "Student council member" },
                      { value: "sponsor", label: "Sponsor / supporter" },
                    ]}
                  />
                </Field>
                <Field
                  label="URL slug / unique ID"
                  hint="Lowercase letters, numbers and hyphens."
                >
                  <Input
                    required
                    pattern="[a-z0-9-]+"
                    value={edit.id}
                    onChange={(e) => setEdit({ ...edit, id: e.target.value })}
                  />
                </Field>
              </div>
              <Field
                label={edit.type === "member" ? "Full name" : "Title / name"}
              >
                <Input
                  required
                  value={edit.title}
                  onChange={(e) => setEdit({ ...edit, title: e.target.value })}
                />
              </Field>
              <Field
                label={
                  edit.type === "member" ? "Role / title" : "Short description"
                }
              >
                <Input
                  value={edit.subtitle}
                  onChange={(e) =>
                    setEdit({ ...edit, subtitle: e.target.value })
                  }
                />
              </Field>
              {edit.type !== "member" && (
                <Field label="Category">
                  <Input
                    value={edit.group}
                    onChange={(e) =>
                      setEdit({ ...edit, group: e.target.value })
                    }
                    placeholder="Supporter category"
                  />
                </Field>
              )}
              <Field label="Main text">
                <Textarea
                  value={edit.body}
                  onChange={(e) => setEdit({ ...edit, body: e.target.value })}
                />
              </Field>
              {edit.type !== "member" && <Field label="Image path or HTTPS URL">
                <Input
                  value={edit.image}
                  onChange={(e) => setEdit({ ...edit, image: e.target.value })}
                />
              </Field>}
              <div className="upload-row">
                <Field label="Display order (lower numbers first)">
                  <Input
                    type="number"
                    min={0}
                    max={10000}
                    value={edit.position ?? 999}
                    onChange={(e) =>
                      setEdit({ ...edit, position: Number(e.target.value) })
                    }
                  />
                </Field>
                {edit.type !== "member" && <FileAttachment
                  key={contentPickerVersion}
                  label="Upload approved image"
                  purpose="content"
                  file={contentFile}
                  preview={contentPreview || edit.image}
                  saved={contentUploaded || (!!edit.image && !contentFile)}
                  required={false}
                  busy={busy}
                  onChange={(file) => {
                    setContentFile(file);
                    setContentUploaded(false);
                    if (!file) {
                      setEdit((value) => ({ ...value, image: "" }));
                      return;
                    }
                    uploadContentImage(file);
                  }}
                />}
              </div>
              {contentFile && !contentUploaded && error && (
                <Button
                  type="button"
                  variant="secondary"
                  disabled={busy}
                  onClick={() => uploadContentImage(contentFile)}
                >
                  Retry image upload
                </Button>
              )}
              {edit.type === "sponsor" && (
                <Field label="Sponsor website (HTTPS)">
                  <Input
                    type="url"
                    value={edit.url}
                    onChange={(e) => setEdit({ ...edit, url: e.target.value })}
                  />
                </Field>
              )}
              <label className="check-row">
                <AnimatedCheckbox
                  type="checkbox"
                  checked={edit.published}
                  onChange={(e) =>
                    setEdit({ ...edit, published: e.target.checked })
                  }
                />
                Publish this approved content
              </label>
              {contentFile && !contentUploaded && (
                <p className="fine-print">
                  Finish or retry the selected image upload, or remove the
                  selection before saving.
                </p>
              )}
              <Button disabled={busy || (!!contentFile && !contentUploaded)}>
                Save content
              </Button>
              {editingContentId && (
                <div className="delete-section">
                  <p>Permanently remove this content from the website.</p>
                  <Button
                    type="button"
                    variant="danger"
                    disabled={busy}
                    onClick={() =>
                      askDelete(
                        "content",
                        editingContentId,
                        data.content.find((c) => c.id === editingContentId)
                          ?.title || edit.title,
                      )
                    }
                  >
                    Delete content
                  </Button>
                </div>
              )}
            </form>
          </div>
        )}
        {data && tab === "Festival" && festival && (
          <form
            className="form-panel"
            onSubmit={(e) => {
              e.preventDefault();
              void run(
                () => api("/api/admin", { kind: "festival", data: festival }),
                "Festival configuration saved.",
              );
            }}
          >
            <h2>Festival configuration</h2>
            <p>
              Live registration also requires the deployment-level switch.
              Saving a demo configuration never enables real payments.
            </p>
            <div className="field-grid">
              {(
                [
                  "title",
                  "month",
                  "dates",
                  "venue",
                  "bkashNumber",
                  "contactEmail",
                  "contactPhone",
                ] as const
              ).map((k) => (
                <Field
                  key={k}
                  label={
                    {
                      title: "Festival title",
                      month: "Month and year",
                      dates: "Confirmed exact dates",
                      venue: "Venue",
                      bkashNumber: "Approved bKash collection number",
                      contactEmail: "Official contact email",
                      contactPhone: "Official contact phone",
                    }[k]
                  }
                >
                  <Input
                    value={festival[k]}
                    type={k === "contactEmail" ? "email" : "text"}
                    onChange={(e) =>
                      setFestival({ ...festival, [k]: e.target.value })
                    }
                  />
                </Field>
              ))}
            </div>
            <Field
              label="Approved bKash instructions"
              hint="Specify the account type and correct transfer method only after approval."
            >
              <Textarea
                value={festival.bkashInstruction}
                onChange={(e) =>
                  setFestival({ ...festival, bkashInstruction: e.target.value })
                }
              />
            </Field>
            <Field label="Cancellation and refund arrangements">
              <Textarea
                value={festival.refundPolicy}
                onChange={(e) =>
                  setFestival({ ...festival, refundPolicy: e.target.value })
                }
              />
            </Field>
            <label className="check-row">
              <AnimatedCheckbox
                type="checkbox"
                checked={festival.registrationOpen}
                onChange={(e) =>
                  setFestival({
                    ...festival,
                    registrationOpen: e.target.checked,
                  })
                }
              />
              Open registration when all configuration and deployment checks
              pass
            </label>
            <Button disabled={busy}>Save festival configuration</Button>
          </form>
        )}
        {data && tab === "Segments" && (
          <div className="content-editor-grid">
            <ul className="content-list">
              {data.segments.map((s) => (
                <li key={s.id}>
                  <div>
                    {s.name}
                    <small>
                      {s.approved ? "Approved" : "Proposed"} ·{" "}
                      {s.fee === null ? "Fee pending" : money(s.fee)}
                    </small>
                  </div>
                  <div className="editor-actions">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        segmentSelection.current += 1;
                        setSegment(s);
                      }}
                    >
                      Configure
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
            {segment ? (
              <form
                className="form-panel"
                onSubmit={(e) => {
                  e.preventDefault();
                  void run(
                    () => api("/api/admin", { kind: "segment", data: segment }),
                    "Segment configuration saved.",
                  );
                }}
              >
                <h2>{segment.name}</h2>
                <Field label="Description">
                  <Textarea
                    value={segment.description}
                    onChange={(e) =>
                      setSegment({ ...segment, description: e.target.value })
                    }
                  />
                </Field>
                <Field label="Entry format">
                  <AnimatedDropdown
                    label="Entry format"
                    value={segment.kind}
                    onChange={(value) =>
                      setSegment({
                        ...segment,
                        kind: value as Segment["kind"],
                      })
                    }
                    options={[
                      { value: "individual", label: "Individual" },
                      { value: "team", label: "Team" },
                      {
                        value: "exhibition",
                        label: "Informational exhibition",
                      },
                    ]}
                  />
                </Field>
                <Field
                  label="Fee in BDT"
                  hint="Per person for individual entries, once per team for team entries."
                >
                  <Input
                    type="number"
                    min={0}
                    max={100000}
                    value={segment.fee ?? ""}
                    onChange={(e) =>
                      setSegment({
                        ...segment,
                        fee: e.target.value ? Number(e.target.value) : null,
                      })
                    }
                  />
                </Field>
                {segment.kind === "team" && (
                  <div className="field-grid">
                    <Field label="Minimum team size">
                      <Input
                        type="number"
                        min={2}
                        max={12}
                        value={segment.minTeam ?? ""}
                        onChange={(e) =>
                          setSegment({
                            ...segment,
                            minTeam: e.target.value
                              ? Number(e.target.value)
                              : null,
                          })
                        }
                      />
                    </Field>
                    <Field label="Maximum team size">
                      <Input
                        type="number"
                        min={2}
                        max={12}
                        value={segment.maxTeam ?? ""}
                        onChange={(e) =>
                          setSegment({
                            ...segment,
                            maxTeam: e.target.value
                              ? Number(e.target.value)
                              : null,
                          })
                        }
                      />
                    </Field>
                  </div>
                )}
                <fieldset>
                  <legend>Eligible classes</legend>
                  <div className="filter-list">
                    {[3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((c) => (
                      <label className="check-row" key={c}>
                        <AnimatedCheckbox
                          type="checkbox"
                          checked={segment.classes.includes(c)}
                          onChange={() =>
                            setSegment({
                              ...segment,
                              classes: segment.classes.includes(c)
                                ? segment.classes.filter((v) => v !== c)
                                : [...segment.classes, c].sort((a, b) => a - b),
                            })
                          }
                        />
                        {c}
                      </label>
                    ))}
                  </div>
                </fieldset>
                <Field label="Minimum age (optional)">
                  <Input
                    type="number"
                    min={5}
                    max={30}
                    value={segment.minAge ?? ""}
                    onChange={(e) =>
                      setSegment({
                        ...segment,
                        minAge: e.target.value ? Number(e.target.value) : null,
                      })
                    }
                  />
                </Field>
                <Field label="Rules status">
                  <AnimatedDropdown
                    label="Rules status"
                    value={segment.rulesStatus || "draft"}
                    onChange={(value) =>
                      setSegment({
                        ...segment,
                        rulesStatus: value as "draft" | "approved",
                      })
                    }
                    options={[
                      { value: "draft", label: "Draft — subject to revision" },
                      { value: "approved", label: "Approved by organisers" },
                    ]}
                  />
                </Field>
                <label className="check-row">
                  <AnimatedCheckbox
                    type="checkbox"
                    checked={segment.active !== false}
                    onChange={(e) =>
                      setSegment({ ...segment, active: e.target.checked })
                    }
                  />
                  Visible on public pages and registration
                </label>
                <Field label="Rules">
                  <Textarea
                    value={segment.rules}
                    onChange={(e) =>
                      setSegment({ ...segment, rules: e.target.value })
                    }
                  />
                </Field>
                <label className="check-row">
                  <AnimatedCheckbox
                    type="checkbox"
                    checked={segment.approved}
                    onChange={(e) =>
                      setSegment({ ...segment, approved: e.target.checked })
                    }
                  />
                  Organisers have approved this segment
                </label>
                <Button disabled={busy}>Save segment</Button>
                <div className="delete-section">
                  <p>
                    Events with existing applications cannot be deleted. You can
                    hide them from the programme instead.
                  </p>
                  <Button
                    type="button"
                    variant="danger"
                    disabled={busy}
                    onClick={() =>
                      askDelete("segment", segment.id, segment.name)
                    }
                  >
                    Delete segment
                  </Button>
                </div>
              </form>
            ) : (
              <p>
                Choose a segment to configure its eligibility, format, fees and
                rules.
              </p>
            )}
          </div>
        )}
        {data && tab === "Access" && (
          <>
            <h2 style={{ fontSize: "1.8rem" }}>
              Individual administrator access
            </h2>
            <p>
              Owners manage access and festival settings. Organisers review
              registrations. Editors publish club content.
            </p>
            {demo && (
              <p className="notice">
                Real invitations and permission changes are disabled in the
                local demo.
              </p>
            )}
            <form
              className="form-panel"
              onSubmit={(e) => {
                e.preventDefault();
                void run(
                  () =>
                    api("/api/admin/access", { action: "invite", email, role }),
                  "Invitation requested and access granted.",
                );
              }}
            >
              <div className="field-grid">
                <Field label="Invite email">
                  <Input
                    required
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </Field>
                <Field label="Permission">
                  <AnimatedDropdown
                    label="Permission"
                    value={role}
                    onChange={setRole}
                    options={[
                      { value: "organiser", label: "Organiser" },
                      { value: "editor", label: "Editor" },
                      { value: "owner", label: "Owner" },
                    ]}
                  />
                </Field>
              </div>
              <Button disabled={busy || demo}>Invite administrator</Button>
            </form>
            <ul className="content-list">
              {data.permissions.map((p) => (
                <li key={p.user_id}>
                  <div>
                    {p.email}
                    <small>
                      {p.active ? "Active" : "Revoked"} · {p.role}
                    </small>
                  </div>
                  <div className="editor-actions">
                    <AnimatedDropdown
                      label={"Role for " + p.email}
                      disabled={busy || demo || p.user_id === admin.id}
                      value={p.role}
                      onChange={(value) =>
                        run(
                          () =>
                            api("/api/admin/access", {
                              action: "update",
                              userId: p.user_id,
                              role: value,
                              active: p.active,
                            }),
                          "Role updated.",
                        )
                      }
                      options={[
                        { value: "owner", label: "Owner" },
                        { value: "organiser", label: "Organiser" },
                        { value: "editor", label: "Editor" },
                      ]}
                    />
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={busy || demo || p.user_id === admin.id}
                      onClick={() =>
                        run(
                          () =>
                            api("/api/admin/access", {
                              action: "update",
                              userId: p.user_id,
                              role: p.role,
                              active: !p.active,
                            }),
                          "Access updated.",
                        )
                      }
                    >
                      {p.active ? "Revoke" : "Restore"}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </motion.div>
      <dialog
        className="admin-delete-dialog"
        ref={deleteDialogRef}
        aria-labelledby={`${instanceId}-delete-title`}
        aria-describedby={`${instanceId}-delete-detail ${instanceId}-delete-delay`}
        onCancel={(event) => {
          event.preventDefault();
          setDeleteDialog(null);
        }}
        onClose={() => setDeleteDialog(null)}
      >
        {deleteDialog && (
          <>
            <h2 id={`${instanceId}-delete-title`}>
              Delete {deleteDialog.label}?
            </h2>
            <p id={`${instanceId}-delete-detail`}>
              {deleteDialog.target === "application"
                ? "This permanently removes its participant details, payment records, screenshots and review history. A deletion log is retained."
                : deleteDialog.target === "segment"
                  ? "This removes its public page and registration option. Segments with existing applications cannot be deleted; hide them using the visibility setting instead."
                  : "This permanently removes this item from club content and public pages. Shared image files are kept."}
            </p>
            <p id={`${instanceId}-delete-delay`} className="fine-print">
              Hold for 1.5 seconds to schedule deletion. You then have 5 seconds
              to cancel with the notification or Escape. Once deletion begins,
              it cannot be undone.
            </p>
            <div className="admin-delete-dialog__actions">
              <Button
                type="button"
                variant="secondary"
                autoFocus
                onClick={() => setDeleteDialog(null)}
              >
                Keep record
              </Button>
              <HoldButton
                key={`${deleteDialog.target}:${deleteDialog.id}`}
                holdTime={1500}
                resetAfter={0}
                onHold={scheduleDeletion}
                disabled={busy}
              >
                Hold to delete
              </HoldButton>
            </div>
            <p className="admin-delete-dialog__alternative">
              Prefer a click confirmation?{" "}
              <button type="button" onClick={scheduleDeletion} disabled={busy}>
                Schedule deletion instead
              </button>
            </p>
          </>
        )}
      </dialog>
      {deletionToast && (
        <SwipeToast
          key={deletionToast.token}
          open={pendingDeletion?.token === deletionToast.token}
          title={
            deletionToast.phase === "committing"
              ? "Deleting…"
              : `Deletion scheduled: ${deletionToast.operation.label}`
          }
          description={
            deletionToast.phase === "committing"
              ? "Checking the result with the server."
              : `${deletionToast.paused ? "Paused · " : ""}${Math.ceil(deletionToast.remaining / 1000)} seconds to cancel. Escape also cancels.`
          }
          actionLabel={deletionToast.phase === "waiting" ? "Cancel" : ""}
          onAction={() => cancelPendingDeletion(deletionToast.token)}
          onDismissIntent={() => cancelPendingDeletion(deletionToast.token)}
          onPauseChange={(reason, paused) => {
            const controller = deletionController.current;
            if (controller?.isCurrent(deletionToast.token))
              controller.pause(reason, paused);
          }}
          onClose={() =>
            setDeletionToast((value) =>
              value?.token === deletionToast.token ? null : value,
            )
          }
          remainingMs={deletionToast.remaining}
          totalDuration={5000}
          duration={0}
          closeButton={deletionToast.phase === "waiting"}
          dismissible={deletionToast.phase === "waiting"}
          width={420}
        />
      )}
    </div>
  );
}
