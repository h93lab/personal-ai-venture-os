import fs from "node:fs";
const path = "client/src/pages/Home.tsx";
const source = fs.readFileSync(path, "utf8");
const start = source.indexOf("function SettingsPage");
const end = source.indexOf("function ProductToolsStrip", start);
if (start < 0 || end < 0) throw new Error("Settings boundaries not found");
const block = source.slice(start, end).trim().replaceAll("pageMeta.settings", "settingsMeta");
const content = `import { useEffect, useState } from "react";
import { Activity, AlertTriangle, BrainCircuit, Bot, CalendarClock, Check, CheckCircle2, GitBranch, Link2, Loader2, MessageCircle, Settings2, UserRound, X } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { DEFAULT_TELEGRAM_TEMPLATES, renderTelegramTemplate } from "@shared/telegram-templates";

const settingsMeta = { eyebrow: "التحكم والخصوصية", title: "إعدادات مساحتي", description: "غيّر بيانات المستخدم وتفضيلات التكامل من مكان واحد." };

${block}

export default SettingsPage;
`;
fs.writeFileSync("client/src/pages/SettingsPage.tsx", content);
const updated = source.slice(0, start) + source.slice(end)
  .replace('const CompetitorsPage = lazy(() => import("@/pages/Competitors"));', 'const CompetitorsPage = lazy(() => import("@/pages/Competitors"));\nconst SettingsPage = lazy(() => import("@/pages/SettingsPage"));')
  .replace('if (active === "settings") return <SettingsPage userName={userName} onProfileUpdated={() => { void refresh(); }} logout={logout} />;', 'if (active === "settings") return <Suspense fallback={<div className="empty-state"><Loader2 size={28} className="spin" /><h3>جارٍ تحميل الإعدادات...</h3></div>}><SettingsPage userName={userName} onProfileUpdated={() => { void refresh(); }} logout={logout} /></Suspense>;');
fs.writeFileSync(path, updated);
