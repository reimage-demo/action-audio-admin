import { stores } from "./catalog.js";
import { serviceContent } from "./service-content.js";
export const EMAIL_DAILY_LIMIT = 290;
export const validEmail = (value) =>
  typeof value === "string" &&
  value.length <= 254 &&
  /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(value);
const escape = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export function estimateEmail({ kind, name, service, store, body = "" }) {
  const location = stores.find((s) => s.id === store);
  const serviceName =
    serviceContent.find((s) => s.id === service)?.name || "Vehicle service";
  const title =
    kind === "thanks"
      ? "Thank you for your submission."
      : "Your Action Audio estimate";
  const message =
    kind === "thanks"
      ? `We’ve received your request for ${serviceName.toLowerCase()}. Our ${location?.name || "Action Audio"} team will review your details and email your estimate as soon as possible. We may call if we need a little more information.\n\nReply to this email if you have a question or would like to add anything. No appointment has been reserved yet.`
      : body;
  const footer = `${location?.name || "Action Audio"} · ${location?.address || ""}${location?.city ? ", " + location.city : ""}\nMonday–Saturday, 9am–6pm · Sunday closed\nQuestions? Reply to this email or call our Wethersfield team at (860) 667-6330.`;
  return {
    subject:
      kind === "thanks"
        ? "We received your estimate request | Action Audio"
        : `${serviceName} estimate | Action Audio`,
    textContent: `ACTION AUDIO\n${title}\n\nHi ${name},\n\n${message}\n\nThe Action Audio team\n${footer}`,
    htmlContent: `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f2f5f8;color:#172b43;font-family:Arial,Helvetica,sans-serif">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all">${kind === "thanks" ? "Your request is in. We’ll email your estimate as soon as possible." : "Your vehicle service estimate from the Action Audio team."}</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;background:#fff">
<tr><td align="center" bgcolor="#12345b" style="padding:28px 24px;background:#12345b;color:#fff">
<a href="https://www.actionaudiostorellc.com/" style="color:#fff;text-decoration:none"><img src="https://www.actionaudiostorellc.com/assets/action-audio-email-logo.png" width="220" alt="The Action Audio Store" style="display:block;width:220px;max-width:100%;height:auto;border:0;color:#fff;font-size:24px;font-weight:bold"></a>
<p style="font-size:11px;line-height:1.6;letter-spacing:1px;margin:18px 0 0;color:#fff">YOUR VEHICLE. YOUR SOUND. YOUR STYLE.</p>
</td></tr><tr><td height="5" bgcolor="#c92336" style="height:5px;background:#c92336;font-size:0;line-height:0">&nbsp;</td></tr>
<tr><td style="padding:32px 28px">
<p style="margin:0 0 12px;color:#c92336;font-size:12px;font-weight:bold;letter-spacing:1px">${kind === "thanks" ? "REQUEST RECEIVED" : "YOUR ESTIMATE"} · ${escape(location?.name || "ACTION AUDIO").toUpperCase()}</p>
<h1 style="font-size:28px;line-height:1.2;margin:0 0 24px;color:#12345b">${escape(title)}</h1>
<p style="font-size:16px;line-height:1.6;margin:0 0 18px">Hi ${escape(name)},</p>
<div style="font-size:16px;line-height:1.7;overflow-wrap:anywhere">${escape(message).replace(/\n/g, "<br>")}</div>
<p style="margin:28px 0 0;font-size:16px;line-height:1.6;font-weight:bold;color:#12345b">The Action Audio team</p>
</td></tr>
<tr><td bgcolor="#eaf0f6" style="padding:24px 28px;background:#eaf0f6;font-size:14px;line-height:1.7;color:#12345b">
<p style="margin:0 0 8px;font-size:17px;font-weight:bold">Your ${escape(location?.name || "Action Audio")} store</p>
<p style="margin:0 0 16px">${escape(location?.address || "")}<br>${escape(location?.city || "")}<br>Monday–Saturday, 9am–6pm · Sunday closed</p>
<table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr><td bgcolor="#c92336" style="border-radius:999px;background:#c92336"><a href="tel:8606676330" style="display:inline-block;padding:12px 20px;border:1px solid #c92336;border-radius:999px;color:#fff;text-decoration:none;font-size:14px;font-weight:bold">Call (860) 667-6330</a></td></tr></table>
<p style="margin:12px 0 0;font-size:12px">Phone: Wethersfield team. You can also reply directly to this email.</p>
</td></tr>
<tr><td bgcolor="#12345b" style="padding:24px 28px;background:#12345b;color:#fff;font-size:12px;line-height:1.8">
<p style="margin:0 0 12px;font-size:15px;font-weight:bold">Action Audio · Serving Connecticut since 1983</p>
<p style="margin:0 0 12px"><strong>Wethersfield · Car audio &amp; electronics</strong><br>105 Silas Deane Hwy, Wethersfield, CT 06109<br><strong>Hartford · Detailing &amp; window tinting</strong><br>2814 Main St, Hartford, CT 06120</p>
<a href="https://www.actionaudiostorellc.com/" style="color:#fff;text-decoration:underline">www.actionaudiostorellc.com</a>
</td></tr></table></td></tr></table></body></html>`,
  };
}
