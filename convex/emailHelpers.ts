/**
 * Pure email-sending helpers using Resend's REST API via fetch.
 * Importable from both Convex actions ("use node") and Better Auth callbacks.
 * No Convex-specific imports — safe to call from any async context.
 */

// Resend: use EMAIL_FROM in Convex env. For testing use "Kyarafit <onboarding@resend.dev>" (Resend allows this without domain verification).
const FROM_ADDRESS = () => process.env.EMAIL_FROM ?? "Kyarafit <onboarding@resend.dev>";
const APP_URL = () => process.env.APP_URL ?? "http://localhost:3000";

async function sendViaResend(payload: {
  to: string;
  subject: string;
  html: string;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error(
      "[email] RESEND_API_KEY is not set in Convex env — verification and password-reset emails will not be sent. Add it in Convex Dashboard → Settings → Environment Variables."
    );
    throw new Error(
      "Email not configured: RESEND_API_KEY missing. Add it in Convex Dashboard → Environment Variables."
    );
  }

  const from = FROM_ADDRESS();
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: payload.to,
      subject: payload.subject,
      html: payload.html,
    }),
  });

  const text = await res.text();
  if (!res.ok) {
    console.error("[email] Resend API error:", res.status, text);
    throw new Error(`Failed to send email: ${res.status} ${text}`);
  }
  // Do not log recipient (PII); subject only for operational debugging
  console.log("[email] Sent successfully, subject:", payload.subject);
}

function baseLayout(content: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background: #fafafa;">
  <div style="background: #000; padding: 36px 20px; text-align: center;">
    <h1 style="color: #fff; margin: 0; font-size: 26px; font-style: italic; letter-spacing: -0.5px;">Kyarafit</h1>
    <p style="color: rgba(255,255,255,0.5); margin: 6px 0 0; font-size: 10px; letter-spacing: 3px; text-transform: uppercase;">Your cosplay wardrobe</p>
  </div>
  <div style="background: #fff; padding: 40px 32px; border: 1px solid #e8e8e8; border-top: none;">
    ${content}
  </div>
  <div style="text-align: center; padding: 20px; font-size: 11px; color: #bbb;">
    <p>© ${new Date().getFullYear()} Kyarafit. All rights reserved.</p>
  </div>
</body>
</html>`;
}

function ctaButton(label: string, href: string, color = "#000"): string {
  return `<div style="text-align: center; margin: 32px 0;">
    <a href="${href}" style="display: inline-block; background: ${color}; color: #fff; padding: 14px 36px; text-decoration: none; font-size: 12px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase;">${label}</a>
  </div>
  <p style="font-size: 12px; color: #aaa; text-align: center; word-break: break-all;">
    Or copy this link: <a href="${href}" style="color: #666;">${href}</a>
  </p>`;
}

export async function sendWelcomeEmail(to: string, name?: string): Promise<void> {
  const displayName = name ?? to.split("@")[0];
  await sendViaResend({
    to,
    subject: "Welcome to Kyarafit! 🎭",
    html: baseLayout(`
      <p style="font-size: 16px; margin-bottom: 16px;">Hi ${displayName},</p>
      <p style="font-size: 15px; margin-bottom: 16px; color: #444;">
        Thanks for joining Kyarafit! You're all set to start organizing your cosplay wardrobe and planning your convention outfits.
      </p>
      <ul style="font-size: 15px; margin-bottom: 28px; padding-left: 20px; color: #444;">
        <li style="margin-bottom: 8px;">📸 Build your digital closet with photos of your pieces</li>
        <li style="margin-bottom: 8px;">🎭 Create and track your cosplay builds</li>
        <li style="margin-bottom: 8px;">📅 Plan your convention day-by-day</li>
        <li style="margin-bottom: 8px;">✅ Auto-generate packing lists</li>
      </ul>
      ${ctaButton("Get Started", `${APP_URL()}/home`)}
      <p style="font-size: 13px; color: #999; margin-top: 32px; padding-top: 24px; border-top: 1px solid #f0f0f0;">
        Questions? Reply to this email — we're here to help.
      </p>
    `),
  });
}

export async function sendVerificationEmail(to: string, url: string): Promise<void> {
  await sendViaResend({
    to,
    subject: "Verify your Kyarafit email",
    html: baseLayout(`
      <p style="font-size: 16px; margin-bottom: 16px;">Almost there!</p>
      <p style="font-size: 15px; margin-bottom: 24px; color: #444;">
        Click the button below to verify your email address and activate your Kyarafit account.
        This link expires in <strong>24 hours</strong>.
      </p>
      ${ctaButton("Verify Email", url)}
      <p style="font-size: 13px; color: #999; margin-top: 32px; padding-top: 24px; border-top: 1px solid #f0f0f0;">
        If you didn't create a Kyarafit account, you can safely ignore this email.
      </p>
    `),
  });
}

export async function sendPasswordResetEmail(to: string, url: string): Promise<void> {
  await sendViaResend({
    to,
    subject: "Reset your Kyarafit password",
    html: baseLayout(`
      <p style="font-size: 16px; margin-bottom: 16px;">Password reset request</p>
      <p style="font-size: 15px; margin-bottom: 24px; color: #444;">
        We received a request to reset the password for your Kyarafit account.
        Click the button below to choose a new password. This link expires in <strong>1 hour</strong>.
      </p>
      ${ctaButton("Reset Password", url)}
      <p style="font-size: 13px; color: #999; margin-top: 32px; padding-top: 24px; border-top: 1px solid #f0f0f0;">
        If you didn't request a password reset, you can safely ignore this email. Your password will not be changed.
      </p>
    `),
  });
}

export async function sendNotificationEmail(
  to: string,
  subject: string,
  message: string
): Promise<void> {
  await sendViaResend({
    to,
    subject,
    html: baseLayout(`<p style="font-size: 15px; color: #444;">${message}</p>`),
  });
}
