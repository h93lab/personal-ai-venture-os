import type { Request } from "express";

export function isLocalSchedulerRequest(req: Request) {
  const configured = process.env.JWT_SECRET?.trim();
  if (!configured) return false;
  const token = req.headers["x-scheduler-token"];
  return typeof token === "string" && token.length > 0 && token === configured;
}
