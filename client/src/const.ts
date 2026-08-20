import { OAUTH_STATE_COOKIE, encodeOAuthState } from "@shared/const";

export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

// Start the Manus OAuth login. Call this from an event handler or effect at the
// moment you want to navigate, e.g. `onClick={() => startLogin()}`.
//
// It has SIDE EFFECTS — it mints a one-time nonce, writes the __Host- state
// cookie, and navigates immediately — so the cookie nonce always matches the
// `state` it sends. Do NOT call it during render (no `href={startLogin()}` /
// `loginUrl={...}`): each call overwrites the cookie, so a stray render-phase
// call would desync it from an in-flight login and the callback would reject it
// with "invalid oauth state". It returns void by design, so there is no URL to
// stash across renders.
function getValidHttpUrl(value: unknown, name: string): URL {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw || raw.includes("CHANGE_ME") || raw.includes("your-domain")) {
    throw new Error(`${name} is missing. Set it to a complete HTTPS URL in the production environment.`);
  }

  const candidate = /^[a-z][a-z\d+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`;
  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    throw new Error(`${name} is invalid. Use a complete URL such as https://manus.im.`);
  }

  if (url.protocol !== "https:" && url.hostname !== "localhost" && url.hostname !== "127.0.0.1") {
    throw new Error(`${name} must use HTTPS in production.`);
  }
  return url;
}

export const startLogin = () => {
  const oauthPortalUrl = getValidHttpUrl(import.meta.env.VITE_OAUTH_PORTAL_URL, "VITE_OAUTH_PORTAL_URL");
  const appId = typeof import.meta.env.VITE_APP_ID === "string" ? import.meta.env.VITE_APP_ID.trim() : "";
  if (!appId || appId.includes("CHANGE_ME")) {
    throw new Error("VITE_APP_ID is missing. Set the OAuth application ID in the production environment.");
  }
  const redirectUri = `${window.location.origin}/api/oauth/callback`;

  const nonce = crypto.randomUUID();
  document.cookie = `${OAUTH_STATE_COOKIE}=${nonce}; Path=/; Max-Age=600; SameSite=None; Secure`;
  const state = encodeOAuthState({ redirectUri, nonce });

  oauthPortalUrl.pathname = `${oauthPortalUrl.pathname.replace(/\/$/, "")}/app-auth`;
  oauthPortalUrl.searchParams.set("appId", appId);
  oauthPortalUrl.searchParams.set("redirectUri", redirectUri);
  oauthPortalUrl.searchParams.set("state", state);
  oauthPortalUrl.searchParams.set("type", "signIn");

  window.location.href = oauthPortalUrl.toString();
};
