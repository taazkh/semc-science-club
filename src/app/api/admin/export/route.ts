import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/auth";
import { adminData } from "@/lib/server/repository";
import { fail } from "@/lib/server/http";
function cell(value: unknown) {
  let text = String(value ?? "");
  if (/^[=+@\-\t\r]/.test(text)) text = "'" + text;
  return '"' + text.replace(/"/g, '""') + '"';
}
export async function GET() {
  try {
    const admin = await requireAdmin(["owner", "organiser"]);
    const { applications } = await adminData(admin);
    const rows = [
      [
        "Reference",
        "Name",
        "Email",
        "Phone",
        "Segments",
        "Total BDT",
        "Payment",
        "Transaction ID",
        "Approval",
        "Email marked sent",
        "Created",
        "Test record",
        "Submitted",
        "Review due",
        "Rosters",
        "Payment sender",
        "Payment time",
        "Payment time source",
        "Screenshot attached",
      ],
      ...applications.map((a) => [
        a.reference,
        a.contact.name,
        a.contact.email,
        a.contact.phone,
        a.entries.map((e) => e.segmentName).join("; "),
        a.total,
        a.paymentStatus,
        a.payment?.transactionId,
        a.approvalStatus,
        a.emailSentAt,
        a.createdAt,
        a.isTest ? "Test" : "Legacy/live — verify environment",
        a.submittedAt,
        a.reviewDueAt,
        a.entries
          .map(
            (e) =>
              e.segmentName +
              ": " +
              e.participants
                .map(
                  (p) =>
                    `${p.name} (${p.school}, Class ${p.class}${p.age ? ", Age " + p.age : ""})`,
                )
                .join("; "),
          )
          .join(" | "),
        a.payment?.sender,
        a.payment?.paidAt,
        a.payment
          ? a.payment.timeSource === "submission"
            ? "Server-recorded simulation submission"
            : "Participant-declared transfer"
          : "",
        a.payment?.proofId ? "Yes — private admin view" : "No",
      ]),
    ];
    return new NextResponse(
      "\uFEFF" + rows.map((r) => r.map(cell).join(",")).join("\r\n"),
      {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition":
            'attachment; filename="semc-registrations.csv"',
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (e) {
    return fail(e);
  }
}
