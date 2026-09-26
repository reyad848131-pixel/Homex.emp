// Password rules. The normal minimum is 6 characters, but a few permanent
// owner accounts (by civil id) are allowed to use their civil id as the
// password — Salim asked for this. Login itself never checks length, so this
// only governs what a password can be SET to.
export const SHORT_PWD_CIVIL_IDS = ["1389"]; // Salim

export function passwordMinFor(civilId?: string | null): number {
  return civilId && SHORT_PWD_CIVIL_IDS.includes(civilId) ? 1 : 6;
}

// Returns an Arabic error message when `pwd` is too short for that account, or
// null when it's acceptable.
export function passwordError(pwd: string, civilId?: string | null): string | null {
  const min = passwordMinFor(civilId);
  if ((pwd || "").length < min) return `كلمة المرور يجب أن تكون ${min} أحرف على الأقل`;
  return null;
}
