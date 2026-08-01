import bcrypt from "bcryptjs";
import { prisma } from "./prisma";
import type { Employee } from "@prisma/client";

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
  // Normalize input: civil IDs are stored trimmed, but tablets/phones (and
  // copy-paste) often add a stray leading/trailing space, which would break the
  // exact lookup or the password compare and surface as "wrong password" even
  // when the employee typed it correctly. Passwords in this system never
  // contain surrounding spaces, so trimming them is safe too.
  civilId = (civilId ?? "").trim();
  password = (password ?? "").trim();

  const employee = await prisma.employee.findUnique({ where: { civilId } });

  // Currently locked?
  if (employee?.lockedUntil && employee.lockedUntil > new Date()) {
    const retryAfter = Math.ceil(
      (employee.lockedUntil.getTime() - Date.now()) / 60000
    );
    return { ok: false, code: "locked", retryAfter: Math.max(retryAfter, 1) };
  }

  // Always run a comparison (dummy when no account) to keep timing uniform.
  const valid = await bcrypt.compare(password, employee?.password ?? DUMMY_HASH);

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
