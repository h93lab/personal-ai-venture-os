import fs from "node:fs";
const path = "client/src/pages/Home.tsx";
const lines = fs.readFileSync(path, "utf8").split("\n");
const filtered = lines.filter((line) => !line.startsWith("function DashboardCharts()"));
const index = filtered.findIndex((line) => line.startsWith("function Overview"));
if (index < 0) throw new Error("Overview function not found");
filtered.splice(index, 0, 'const DashboardCharts = lazy(() => import("@/components/DashboardCharts"));', "");
fs.writeFileSync(path, filtered.join("\n"));
