import { execFileSync } from "node:child_process";

const url = process.env.VENTURE_OS_URL ?? "http://127.0.0.1:3000/";
const html = execFileSync("chromium", ["--headless=new", "--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage", "--dump-dom", url], { encoding: "utf8", timeout: 30_000, stdio: ["ignore", "pipe", "pipe"] });
if (!html.includes("Sign in to Personal AI Venture OS") && !html.includes("تحقق من الجلسة") && !html.includes("تسجيل الدخول")) throw new Error("Browser smoke failed: expected OAuth/application shell was not present");
if (html.includes("Rendered more hooks") || html.includes("change in the order of Hooks")) throw new Error("Browser smoke failed: React hook-order error detected");
console.log(`Browser smoke passed for ${url}`);
