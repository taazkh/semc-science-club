import { NextRequest, NextResponse } from "next/server";
import { sessionClient } from "@/lib/server/supabase";
import { supabaseConfigured } from "@/lib/server/config";
import { getAuthenticatedAdmin } from "@/lib/server/auth";
import { beginAdminSession } from "@/lib/server/admin-session";
export async function GET(req: NextRequest) {
  const hash = req.nextUrl.searchParams.get("token_hash");
  const type = req.nextUrl.searchParams.get("type");
  const root = process.env.APP_URL || req.nextUrl.origin;
  if (
    hash &&
    (type === "invite" || type === "recovery") &&
    supabaseConfigured()
  ) {
    const { error } = await (
      await sessionClient()
    ).auth.verifyOtp({ token_hash: hash, type });
    if (!error) {
      const admin = await getAuthenticatedAdmin();
      if (admin) {
        await beginAdminSession(admin.id);
        return NextResponse.redirect(new URL("/admin/password", root));
      }
    }
  }
  return NextResponse.redirect(new URL("/admin/login?error=invite", root));
}
