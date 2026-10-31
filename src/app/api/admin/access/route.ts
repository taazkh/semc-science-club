import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/server/auth";
import { readBody, fail } from "@/lib/server/http";
import { service } from "@/lib/server/supabase";
import { isDemo } from "@/lib/server/config";
import { DomainError } from "@/lib/domain";
export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin(["owner"]);
    const b = z
      .object({
        action: z.enum(["invite", "update"]),
        email: z.email().optional(),
        userId: z.uuid().optional(),
        role: z.enum(["owner", "organiser", "editor"]),
        active: z.boolean().default(true),
      })
      .parse(await readBody(req));
    if (isDemo())
      throw new DomainError(
        "Invitations are disabled in demo mode. No real emails are sent.",
        403,
      );
    let userId = b.userId;
    let email = b.email;
    if (b.action === "invite") {
      if (!email) throw new DomainError("An email address is required.");
      const result = await service().auth.admin.inviteUserByEmail(email, {
        redirectTo: new URL("/admin/password", process.env.APP_URL!).href,
      });
      if (result.error || !result.data.user)
        throw new DomainError(
          "Could not invite this address. Check whether it already exists in Supabase.",
        );
      userId = result.data.user.id;
    }
    if (!userId) throw new DomainError("Choose an administrator.");
    if (userId === admin.id && (b.role !== "owner" || !b.active))
      throw new DomainError("You cannot remove your own owner access.");
    const { error } = await service().rpc("set_admin_permission", {
      p_actor: admin.id,
      p_user_id: userId,
      p_email: email || null,
      p_role: b.role,
      p_active: b.active,
    });
    if (error)
      throw new DomainError(
        "Access could not be updated. If an invitation was sent, it has no access until permissions are saved.",
        409,
      );
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
