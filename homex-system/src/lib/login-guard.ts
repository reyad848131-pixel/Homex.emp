import bcrypt from "bcryptjs";
import { prisma } from "./prisma";
import type { Employee } from "@prisma/client";
import { stripInvisible, normalizeDigits, normalizeCredential } from "./text";

// Re-exported so existing importers keep working (the implementations now live
// in the client-safe ./text module).
export { stripInvisible, normalizeDigits, normalizeCredential };

// Brute-force protection tuning.
export const MAX_ATTEMPTS = 5;
export const LOCK_MINUTES = 15;

// Pre-computed bcrypt hash used to equalize response timing when the account
// does not exist, so timing does not reveal whether a civil ID is registered.
const DUMMY_HASH = "$2b$10$CwTycUXWue0Thq9StjUM0uJ8./uPqA7q0Y1eR3F1wdmS3rF0aXhy";

export type CredentialResult =
  | { ok: true; employee: Employee }
  | { ok: false; code: "invalid"; remaining?: number }
  | { ok: false; code: "locked"; retryAfter: number };

/**
 * Verifies employee credentials with lockout-aware brute-force protection.
 * Single source of truth shared by the custom /api/login route and the
 * NextAuth credentials provider so neither entry point can be brute-forced.
 */
export async function verifyCredentials(
  civilId: string,
  password: string
): Promise<CredentialResult> {
  // Clean the input first: iOS/Safari on an RTL page injects an invisible
  // Right-to-Left Mark (and tablets add stray spaces / Arabic digits), which
  // silently break the exact lookup and surface as "wrong password" even when
  // the employee typed it correctly. Strip invisibles + fold digits + trim.
  const civilIdClean = normalizeCredential(civilId);
  const passwordClean = stripInvisible(password ?? "").trim(); // as-typed (digits kept)
  const passwordNorm = normalizeDigits(passwordClean);          // digits → ASCII
  civilId = civilIdClean;

  // Primary lookup on the cleaned/normalized civil ID.
  let employee = await prisma.employee.findUnique({ where: { civilId } });
  // Fallback: the STORED civil ID itself may carry invisibles or Arabic digits
  // (an employee created on an Arabic device before normalization). Match on the
  // normalized value so a clean entry still finds them. (Cheap — the staff list
  // is small, and this only runs when the exact lookup misses.)
  if (!employee) {
    const all = await prisma.employee.findMany();
    employee = all.find((e) => normalizeCredential(e.civilId) === civilId) ?? null;
  }

  // Currently locked?
  if (employee?.lockedUntil && employee.lockedUntil > new Date()) {
    const retryAfter = Math.ceil(
      (employee.lockedUntil.getTime() - Date.now()) / 60000
    );
    return { ok: false, code: "locked", retryAfter: Math.max(retryAfter, 1) };
  }

  // Always run a comparison (dummy when no account) to keep timing uniform. Try
  // the normalized password, then the as-typed one — so a password whose hash
  // was stored from Arabic digits still matches when typed the same way.
  const hash = employee?.password ?? DUMMY_HASH;
  const valid =
    (await bcrypt.compare(passwordNorm, hash)) ||
    (passwordClean !== passwordNorm && (await bcrypt.compare(passwordClean, hash)));

  if (!employee || !employee.isActive || !valid) {
    // Only track attempts against a real, active account.
    if (employee && employee.isActive) {
      const attempts = employee.failedAttempts + 1;
      if (attempts >= MAX_ATTEMPTS) {
        await prisma.employee
          .update({
            where: { id: employee.id },
            data: {
              failedAttempts: 0,
              lockedUntil: new Date(Date.now() + LOCK_MINUTES * 60000),
            },
          })
          .catch(() => {});
        return { ok: false, code: "locked", retryAfter: LOCK_MINUTES };
      }
      await prisma.employee
        .update({
          where: { id: employee.id },
          data: { failedAttempts: attempts },
        })
        .catch(() => {});
      return { ok: false, code: "invalid", remaining: MAX_ATTEMPTS - attempts };
    }
    return { ok: false, code: "invalid" };
  }

  // Success — clear failed-attempt state and record the login.
  await prisma.employee
    .update({
      where: { id: employee.id },
      data: { lastLogin: new Date(), failedAttempts: 0, lockedUntil: null },
    })
    .catch(() => {});

  return { ok: true, employee };
}
