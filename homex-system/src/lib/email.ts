// Minimal Resend email sender (via HTTP, no SDK dependency). Emails are only
// sent when RESEND_API_KEY and BACKUP_EMAIL are configured; otherwise it is a
// no-op so the app runs fine without email set up.

interface Attachment {
  filename: string;
  content: string; // base64
}

export function isEmailConfigured(): boolean {
  return !!process.env.RESEND_API_KEY && !!process.env.BACKUP_EMAIL;
}

export async function sendMail(opts: {
  subject: string;
  html: string;
  to?: string;
  attachments?: Attachment[];
}): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  const to = opts.to || process.env.BACKUP_EMAIL;
  const from = process.env.RESEND_FROM || "Homex <onboarding@resend.dev>";

  if (!apiKey || !to) return { ok: false, error: "email not configured" };

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to,
        subject: opts.subject,
        html: opts.html,
        attachments: opts.attachments,
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { ok: false, error: `resend ${res.status}: ${body.slice(0, 200)}` };
    }
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || "send failed" };
  }
}
