export const publicSiteUrl = import.meta.env.VITE_PUBLIC_SITE_URL || "/";
export const publicPage = (path = "") =>
  `${publicSiteUrl.replace(/\/$/, "")}/${path}`;
export const logoUrl = `${import.meta.env.BASE_URL}assets/action-audio-logo.webp`;
