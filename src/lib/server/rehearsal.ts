import "server-only";
import { cookies } from "next/headers";
import { demoAllowed, isTestMode } from "./config";
import { accessConfigured, TEST_COOKIE, validAccess } from "../access-token";
import { DomainError } from "../domain";

export async function requireRehearsalAccess() {
  if (!isTestMode())
    throw new DomainError(
      "Rehearsal is unavailable in the live environment.",
      403,
    );
  if (demoAllowed()) return;
  if (
    accessConfigured() &&
    validAccess((await cookies()).get(TEST_COOKIE)?.value)
  )
    return;
  throw new DomainError(
    "Enter the private tester access code to rehearse an application.",
    401,
    "TEST_ACCESS_REQUIRED",
  );
}
