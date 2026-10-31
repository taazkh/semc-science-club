import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { readBody, throttle, fail } from "@/lib/server/http";
import {
  getAdmin,
  getAuthenticatedAdmin,
  startDemoSession,
  signOut,
} from "@/lib/server/auth";
import { beginAdminSession } from "@/lib/server/admin-session";
import { sessionClient } from "@/lib/server/supabase";
import { isDemo, supabaseConfigured } from "@/lib/server/config";
import { DomainError } from "@/lib/domain";
export async function POST(req: NextRequest) {
  try {
    const b = z
      .object({
        action: z.enum(["login", "demo", "logout", "set-password"]),
        email: z.email().optional(),
        password: z.string().max(128).optional(),
      })
      .parse(await readBody(req));
    if (b.action === "logout") {
      await signOut();
      return NextResponse.json({ ok: true });
    }
    await throttle(req, "login", 12);
    if (b.action === "demo") {
      await startDemoSession();
      await beginAdminSession((await getAuthenticatedAdmin())!.id);
      return NextResponse.json({ ok: true });
    }
    if (isDemo() || !supabaseConfigured())
      throw new DomainError(
        "Use the local demonstration entry. Live administrator accounts are not connected.",
        403,
      );
    if (b.action === "set-password") {
      const admin = await getAdmin();
      if (!admin || !b.password || b.password.length < 12)
        throw new DomainError(
          "An authorised invitation and a password of at least 12 characters are required.",
          403,
        );
      const { error } = await (
        await sessionClient()
      ).auth.updateUser({ password: b.password });
      if (error)
        throw new DomainError(
          "Could not set the password. Request a new invitation.",
          400,
        );
      return NextResponse.json({ ok: true });
    }
    if (!b.email || !b.password)
      throw new DomainError("Enter your email and password.");
    const client = await sessionClient();
    const { error } = await client.auth.signInWithPassword({
      email: b.email,
      password: b.password,
    });
    const admin = error ? null : await getAuthenticatedAdmin();
    if (!admin) {
      await client.auth.signOut();
      throw new DomainError(
        "The sign-in details are incorrect or access has not been granted.",
        401,
      );
    }
    await beginAdminSession(admin.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
