import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { githubRefreshHandler } from "../github-refresh";
import { aiTaskRefreshHandler } from "../ai-task-refresh";
import { discoveryRefreshHandler } from "../discovery-refresh";
import { competitorRefreshHandler } from "../competitor-refresh";
import { isSameOriginRequest } from "../csrf";
import { serveStatic, setupVite } from "./vite";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

const rateBuckets = new Map<string, { count: number; resetAt: number }>();
function csrfProtection(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (req.method !== "GET" && !isSameOriginRequest(req)) return res.status(403).json({ error: "csrf-origin" });
  return next();
}

function apiRateLimit(req: express.Request, res: express.Response, next: express.NextFunction) {
  const now = Date.now();
  const key = req.ip || req.socket.remoteAddress || "unknown";
  const bucket = rateBuckets.get(key);
  if (!bucket || bucket.resetAt <= now) rateBuckets.set(key, { count: 1, resetAt: now + 60_000 });
  else if (bucket.count >= 120) return res.status(429).json({ error: "rate-limit", retryAfterSeconds: Math.ceil((bucket.resetAt - now) / 1000) });
  else bucket.count += 1;
  return next();
}

async function startServer() {
  const app = express();
  app.set("trust proxy", 1);
  const server = createServer(app);
  app.use(express.json({ limit: "2mb" }));
  app.use(express.urlencoded({ limit: "256kb", extended: true }));
  app.use("/api/trpc", csrfProtection, apiRateLimit);
  registerStorageProxy(app);
  registerOAuthRoutes(app);
  app.post("/api/scheduled/github-refresh", githubRefreshHandler);
  app.post("/api/scheduled/ai-task", aiTaskRefreshHandler);
  app.post("/api/scheduled/discovery-refresh", discoveryRefreshHandler);
  app.post("/api/scheduled/competitors-refresh", competitorRefreshHandler);
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
