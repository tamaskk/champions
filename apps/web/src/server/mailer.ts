import "server-only";

/**
 * Transactional email (password reset codes). Uses Resend's HTTP API when RESEND_API_KEY and
 * EMAIL_FROM (e.g. "Spinvincible <no-reply@yourdomain.com>") are set. In development without them
 * the message is printed to the server log instead; in production without them nothing is sent.
 */
export const emailConfigured = () => !!process.env.RESEND_API_KEY && !!process.env.EMAIL_FROM;

export async function sendEmail(to: string, subject: string, text: string): Promise<boolean> {
  if (!emailConfigured()) {
    if (process.env.NODE_ENV !== "production") {
      console.info(`[mail – not configured, dev only] to ${to}: ${subject}\n${text}`);
      return true;
    }
    return false;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: process.env.EMAIL_FROM, to, subject, text }),
    });
    if (!res.ok) console.error("sendEmail failed", res.status, await res.text().catch(() => ""));
    return res.ok;
  } catch (error) {
    console.error("sendEmail failed", error);
    return false;
  }
}
