import { validEmail } from "./estimate-email.js";
export const MARKETING_CONSENT_TEXT =
  "Email me Action Audio offers and service news. I can unsubscribe at any time.";
export const MARKETING_CONSENT_VERSION = "2026-11-08";
export const promotionTemplates = [
  {
    id: "remote-start",
    name: "Remote start season",
    description: "A warmer start to every drive.",
    subject: "Get your vehicle ready for remote-start season",
    headline: "Comfort starts before you get in.",
    offer: "Explore remote-start options",
    body: "Cold mornings are easier with a remote starter. Our Wethersfield team can help you find the right setup for your vehicle and factory keys.\n\nAsk us about compatible equipment and professional installation.",
    button: "Request a remote-start estimate",
    url: "https://www.actionaudiostorellc.com/estimate.html?service=remote-starters",
    store: "wethersfield",
    expires: "",
    terms:
      "Equipment and installation pricing depend on your vehicle. Contact us for an estimate.",
  },
  {
    id: "audio",
    name: "Turn up your drive",
    description: "Speakers, receivers, and custom sound.",
    subject: "Bring new life to your daily drive",
    headline: "Your music. A whole new sound.",
    offer: "Find your next audio upgrade",
    body: "Hear the details you have been missing. From a speaker upgrade to a complete audio system, Action Audio can help you choose a setup that fits your vehicle and the way you listen.",
    button: "Explore car audio",
    url: "https://www.actionaudiostorellc.com/car-audio.html",
    store: "wethersfield",
    expires: "",
    terms:
      "Contact our team to confirm vehicle compatibility, availability, and pricing.",
  },
  {
    id: "detail-tint",
    name: "Refresh your ride",
    description: "Detailing and tint at Hartford.",
    subject: "Give your vehicle a fresh look",
    headline: "A fresh look. A better drive.",
    offer: "Detailing & window tinting",
    body: "Give your vehicle some extra care. Visit our Hartford team to discuss detailing or window tinting tailored to your vehicle.\n\nTell us what you have in mind and we will help plan your visit.",
    button: "Request an appointment",
    url: "https://www.actionaudiostorellc.com/book.html?store=hartford",
    store: "hartford",
    expires: "",
    terms: "Service availability and pricing are confirmed by the store.",
  },
  {
    id: "custom",
    name: "Your next promotion",
    description: "Make an announcement or share an offer.",
    subject: "The latest from Action Audio",
    headline: "Something new for your next drive.",
    offer: "News from Action Audio",
    body: "We are here to help you get more from your vehicle. Contact our team to discuss your next project.",
    button: "Visit Action Audio",
    url: "https://www.actionaudiostorellc.com/",
    store: "both",
    expires: "",
    terms: "",
  },
];
export const customerEligibility = (c) =>
  !validEmail(c.email)
    ? "Missing or invalid email"
    : c.blocked
      ? "Blocked by email provider"
      : c.conflicts?.length
        ? "Contact details need review"
        : c.marketingStatus !== "subscribed"
          ? c.marketingStatus === "unsubscribed"
            ? "Unsubscribed"
            : "No recorded marketing permission"
          : "";
export function validatePromotion(value) {
  for (const [key, max] of Object.entries({
    subject: 150,
    headline: 160,
    offer: 180,
    body: 6000,
    button: 80,
    terms: 1500,
  })) {
    if (
      typeof value[key] !== "string" ||
      value[key].length > max ||
      (key !== "terms" && !value[key].trim())
    )
      return `Check ${key}.`;
  }
  if (!["both", "hartford", "wethersfield"].includes(value.store))
    return "Choose a store.";
  try {
    const u = new URL(value.url);
    if (
      u.protocol !== "https:" ||
      !["www.actionaudiostorellc.com", "actionaudiostorellc.com"].includes(
        u.hostname,
      ) ||
      u.username ||
      u.password
    )
      return "Use an HTTPS link to the Action Audio website.";
  } catch {
    return "Enter a valid Action Audio website link.";
  }
  if (
    value.expires &&
    (!/^\d{4}-\d{2}-\d{2}$/.test(value.expires) ||
      Number.isNaN(Date.parse(value.expires)) ||
      new Date(value.expires).toISOString().slice(0, 10) !== value.expires)
  )
    return "Choose a valid offer end date.";
  return "";
}
const esc = (s) =>
  String(s || "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export function promotionEmail(value, { test = false } = {}) {
  const error = validatePromotion(value);
  if (error) throw new Error(error);
  const store =
    value.store === "both"
      ? "Hartford & Wethersfield"
      : value.store === "hartford"
        ? "Hartford"
        : "Wethersfield";
  const expiry = value.expires ? `Offer ends ${value.expires}.` : "";
  return {
    subject: (test ? "[TEST] " : "") + value.subject,
    htmlContent: `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#edf2f7;color:#172b43;font-family:Arial,Helvetica,sans-serif"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff"><tr><td style="background:#12345b;padding:28px;text-align:center"><img src="https://www.actionaudiostorellc.com/assets/action-audio-email-logo.png" alt="Action Audio" width="220" style="max-width:100%;height:auto"><p style="color:#fff;font-size:12px;letter-spacing:1px">YOUR VEHICLE. YOUR SOUND. YOUR STYLE.</p></td></tr><tr><td style="background:#c92336;height:5px"></td></tr><tr><td style="padding:32px 28px"><p style="color:#c92336;font-weight:bold;font-size:12px;letter-spacing:1px">${test ? "TEST PREVIEW · " : ""}${esc(store).toUpperCase()}</p><h1 style="font-size:32px;line-height:1.15;color:#12345b">${esc(value.headline)}</h1><p style="padding:18px;background:#edf2f7;color:#12345b;font-size:21px;font-weight:bold">${esc(value.offer)}</p><p style="font-size:16px;line-height:1.7">${esc(value.body).replace(/\n/g, "<br>")}</p><p style="margin:30px 0"><a href="${esc(value.url)}" style="display:inline-block;padding:14px 24px;background:#c92336;color:#fff;border-radius:999px;text-decoration:none;font-weight:bold">${esc(value.button)}</a></p><p style="font-size:12px;color:#5e6b78;line-height:1.6">${esc(expiry)} ${esc(value.terms)}</p></td></tr><tr><td style="background:#12345b;color:#fff;padding:24px 28px;font-size:13px;line-height:1.8"><strong>Action Audio · Serving Connecticut since 1983</strong><p><strong>Wethersfield · Audio & electronics</strong><br>105 Silas Deane Hwy, Wethersfield, CT 06109<br><a href="tel:8606676330" style="color:#fff">(860) 667-6330</a><br><strong>Hartford · Detailing & tint</strong><br>2814 Main St, Hartford, CT 06120</p><p>Monday–Saturday, 9am–6pm · Sunday closed</p><p style="font-size:12px">You’re receiving Action Audio offers because you subscribed.<br><a href="{{ unsubscribe }}" style="color:#fff;text-decoration:underline">Unsubscribe from promotional emails</a></p></td></tr></table></td></tr></table></body></html>`,
  };
}
