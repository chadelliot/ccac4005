/**
 * Transactional email via Resend.
 *
 * Every send is best-effort: a failure is logged and reported to the caller but
 * never thrown. A request that was successfully recorded must not appear to have
 * failed because an acknowledgement email bounced — the desk would then be
 * holding a request the church believes was never received.
 */

const RESEND_ENDPOINT = "https://api.resend.com/emails";

export type SendResult = { sent: boolean; skipped?: string; error?: string; id?: string };

export function emailConfigured(): boolean {
  return Boolean(Deno.env.get("RESEND_API_KEY") && Deno.env.get("BISHOP_BOOKING_FROM_EMAIL"));
}

export async function sendEmail(opts: {
  to: string | string[];
  subject: string;
  html: string;
  replyTo?: string;
}): Promise<SendResult> {
  const key = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("BISHOP_BOOKING_FROM_EMAIL");

  if (!key || !from) {
    // Expected before the church's Resend account is wired up. Not an error.
    console.warn("email: RESEND_API_KEY or BISHOP_BOOKING_FROM_EMAIL unset — skipping send");
    return { sent: false, skipped: "email_not_configured" };
  }

  const recipients = (Array.isArray(opts.to) ? opts.to : [opts.to]).filter(Boolean);
  if (recipients.length === 0) return { sent: false, skipped: "no_recipients" };

  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: recipients,
        subject: opts.subject,
        html: opts.html,
        ...(opts.replyTo ? { reply_to: opts.replyTo } : {}),
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error("email: resend rejected the send", res.status, body);
      return { sent: false, error: `resend_${res.status}` };
    }

    const data = await res.json().catch(() => ({}));
    return { sent: true, id: data?.id };
  } catch (err) {
    console.error("email: send threw", err);
    return { sent: false, error: "network" };
  }
}

/** Minimal escaping — every value below is attacker-supplied form input. */
export function esc(v: unknown): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const SHELL = (title: string, body: string) => `
<div style="font-family:Georgia,'Times New Roman',serif;background:#f4eee4;padding:32px">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #e6ddcd">
    <div style="background:#050c1e;color:#fbf9f4;padding:24px 28px">
      <div style="font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#e0b357">
        Christ Cathedral Apostolic Church
      </div>
      <div style="font-size:22px;margin-top:6px">${esc(title)}</div>
    </div>
    <div style="padding:28px;color:#1b1c2a;font-size:15px;line-height:1.65">${body}</div>
    <div style="padding:18px 28px;border-top:1px solid #e6ddcd;font-size:12px;color:#6b6b78">
      Christ Cathedral Apostolic Church · 4005 Old York Road, Baltimore, MD
    </div>
  </div>
</div>`;

export function acknowledgementEmail(v: {
  contactName: string;
  churchName: string;
  requestNumber: string;
  eventName: string;
  when: string;
  responseNote: string;
}) {
  return SHELL(
    "We have your invitation",
    `<p>Dear ${esc(v.contactName)},</p>
     <p>Thank you for inviting Bishop Justin O. Marcus to <strong>${esc(v.eventName)}</strong>
        on behalf of ${esc(v.churchName)}.</p>
     <p>Your reference number is <strong>${esc(v.requestNumber)}</strong>. Please quote it in any
        correspondence about this invitation.</p>
     <table style="margin:18px 0;font-size:14px">
       <tr><td style="padding:4px 12px 4px 0;color:#6b6b78">Event</td><td>${esc(v.eventName)}</td></tr>
       <tr><td style="padding:4px 12px 4px 0;color:#6b6b78">Date</td><td>${esc(v.when)}</td></tr>
     </table>
     ${v.responseNote ? `<p>${esc(v.responseNote)}</p>` : ""}
     <p>This is an acknowledgement of receipt, not a confirmation. The Bishop's office will be in
        touch once the request has been reviewed.</p>`,
  );
}

export function deskNotificationEmail(v: {
  requestNumber: string;
  churchName: string;
  pastorName: string;
  eventName: string;
  when: string;
  city: string;
  state: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  deskUrl: string;
}) {
  return SHELL(
    "New engagement request",
    `<p><strong>${esc(v.churchName)}</strong> (${esc(v.city)}, ${esc(v.state)}) has submitted an
        invitation.</p>
     <table style="margin:18px 0;font-size:14px">
       <tr><td style="padding:4px 12px 4px 0;color:#6b6b78">Reference</td><td>${esc(v.requestNumber)}</td></tr>
       <tr><td style="padding:4px 12px 4px 0;color:#6b6b78">Pastor</td><td>${esc(v.pastorName)}</td></tr>
       <tr><td style="padding:4px 12px 4px 0;color:#6b6b78">Event</td><td>${esc(v.eventName)}</td></tr>
       <tr><td style="padding:4px 12px 4px 0;color:#6b6b78">Date</td><td>${esc(v.when)}</td></tr>
       <tr><td style="padding:4px 12px 4px 0;color:#6b6b78">Contact</td><td>${esc(v.contactName)} · ${esc(v.contactEmail)} · ${esc(v.contactPhone)}</td></tr>
     </table>
     <p><a href="${esc(v.deskUrl)}" style="background:#050c1e;color:#fbf9f4;padding:12px 20px;
        text-decoration:none;letter-spacing:.14em;text-transform:uppercase;font-size:12px">
        Open in the Bishop's Desk</a></p>`,
  );
}

export function acceptanceEmail(v: {
  contactName: string;
  churchName: string;
  requestNumber: string;
  eventName: string;
  when: string;
  accommodationPolicy: string;
  travelPolicy: string;
  secretaryName: string;
  secretaryEmail: string;
}) {
  const policy = (title: string, text: string) =>
    text.trim()
      ? `<h3 style="font-size:14px;letter-spacing:.12em;text-transform:uppercase;color:#965900;margin:22px 0 6px">${esc(title)}</h3><p style="white-space:pre-wrap">${esc(text)}</p>`
      : "";

  return SHELL(
    "Your invitation has been accepted",
    `<p>Dear ${esc(v.contactName)},</p>
     <p>Bishop Justin O. Marcus has accepted the invitation from ${esc(v.churchName)} to
        <strong>${esc(v.eventName)}</strong> on ${esc(v.when)}.</p>
     <p>Reference <strong>${esc(v.requestNumber)}</strong>.</p>
     ${policy("Accommodation", v.accommodationPolicy)}
     ${policy("Travel", v.travelPolicy)}
     <p style="margin-top:22px">Please coordinate remaining details with
        ${esc(v.secretaryName || "the Bishop's office")}${v.secretaryEmail ? ` at <a href="mailto:${esc(v.secretaryEmail)}">${esc(v.secretaryEmail)}</a>` : ""}.</p>`,
  );
}
