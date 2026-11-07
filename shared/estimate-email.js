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
      ? "Thank you for contacting us."
      : "Your Action Audio estimate";
  const message =
    kind === "thanks"
      ? `Thank you for contacting Action Audio about ${serviceName.toLowerCase()}. We’ve received your request. Our ${location?.name || "Action Audio"} team will review your details and send your estimate to this email address. We may call if we need a little more information.\n\nNo appointment has been reserved. Reply to this email if you have a question or need to add anything.`
      : body;
  const footer = `${location?.name || "Action Audio"} · ${location?.address || ""}${location?.city ? ", " + location.city : ""}\nQuestions? Reply to this email or call (860) 667-6330.`;
  return {
    subject:
      kind === "thanks"
        ? "We received your estimate request | Action Audio"
        : `${serviceName} estimate | Action Audio`,
    textContent: `ACTION AUDIO\n${title}\n\nHi ${name},\n\n${message}\n\nThe Action Audio team\n${footer}`,
    htmlContent: `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#f2f5f8;color:#172b43;font-family:Arial,sans-serif"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:24px 12px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#fff"><tr><td style="background:#12345b;padding:28px;color:#fff;font-size:27px;font-weight:bold;letter-spacing:2px">ACTION <span style="color:#ff6a77">AUDIO</span><div style="font-size:12px;letter-spacing:1px;margin-top:8px">YOUR VEHICLE. YOUR SOUND. YOUR STYLE.</div></td></tr><tr><td style="height:5px;background:#c92336"></td></tr><tr><td style="padding:30px"><h1 style="font-size:25px;margin:0 0 24px">${escape(title)}</h1><p>Hi ${escape(name)},</p><div style="line-height:1.7;overflow-wrap:anywhere">${escape(message).replace(/\n/g, "<br>")}</div><p style="margin-top:28px">The Action Audio team</p></td></tr><tr><td style="padding:24px 30px;background:#eaf0f6;font-size:13px;line-height:1.7">${escape(footer).replace(/\n/g, "<br>")}<br><a href="https://www.actionaudiostorellc.com/" style="color:#12345b">Visit Action Audio</a></td></tr></table></td></tr></table></body></html>`,
  };
}
