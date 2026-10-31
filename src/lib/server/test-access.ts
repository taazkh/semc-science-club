import "server-only";
import { cookies } from "next/headers";
import {
  TEST_COOKIE,
  testAccessRequired,
  accessConfigured,
  validAccess,
} from "../access-token";
import { DomainError } from "../domain";
export async function requireTestAccess() {
  if (!testAccessRequired()) return;
  if (!accessConfigured())
    throw new DomainError(
      "Test access is temporarily unavailable. Please contact the organiser.",
      503,
    );
  if (!validAccess((await cookies()).get(TEST_COOKIE)?.value))
    throw new DomainError(
      "Enter the shared access code to continue. Your saved details have not been submitted again.",
      401,
      "TEST_ACCESS_REQUIRED",
    );
}
