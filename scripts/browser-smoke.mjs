import { execFileSync } from "node:child_process";

const baseUrl = process.env.VENTURE_OS_URL ?? "http://127.0.0.1:3000/";
const paths = ["/", "/?page=discovery", "/?page=competitors", "/?page=settings"];
const failures = [];

for (const path of paths) {
  const url = new URL(path, baseUrl).toString();
  let html;
  try {
    html = execFileSync("chromium", ["--headless=new", "--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage", "--dump-dom", url], { encoding: "utf8", timeout: 30_000, stdio: ["ignore", "pipe", "pipe"] });
  } catch (error) {
    failures.push(`${path}: Chromium exited unsuccessfully (${error instanceof Error ? error.message : String(error)})`);
    continue;
  }
  const hasAppBoundary = html.includes("Sign in to Personal AI Venture OS") || html.includes("تحقق من الجلسة") || html.includes("تسجيل الدخول") || html.includes("Venture OS");
  if (!hasAppBoundary) failures.push(`${path}: expected OAuth/application shell was not present`);
  if (/Rendered more hooks|change in the order of Hooks|ChunkLoadError|Failed to fetch dynamically imported module|Unexpected token/i.test(html)) {
    failures.push(`${path}: React/runtime/lazy-chunk error detected`);
  }
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log(`Browser smoke passed for ${paths.length} routes`);
