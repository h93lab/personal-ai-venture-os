import type { Request } from "express";

export function isSameOriginRequest(req: Pick<Request, "headers" | "protocol" | "get">) {
  const origin = req.headers.origin;
  if (!origin) return true;
  try {
    const expectedHost = req.get("x-forwarded-host") || req.get("host");
    return new URL(origin).protocol === `${req.protocol}:` && new URL(origin).host === expectedHost;
  } catch {
    return false;
  }
}
