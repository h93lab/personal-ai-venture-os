import fs from "node:fs";
const homePath = "client/src/pages/Home.tsx";
const source = fs.readFileSync(homePath, "utf8");
const startValidation = source.indexOf("function ValidationLab()");
const startBrief = source.indexOf("function ProductBrief()");
const endBrief = source.indexOf("function ProjectHealthWidget", startBrief);
if (startValidation < 0 || startBrief < 0 || endBrief < 0) throw new Error("Heavy tool boundaries not found");
const validation = source.slice(startValidation, startBrief).trim();
const brief = source.slice(startBrief, endBrief).trim();
const content = `import { useState } from "react";
import { CheckCircle2, ClipboardCheck, Download, ExternalLink, FileCode2, Loader2, Plus, Sparkles, Target } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

const validationMeta = { eyebrow: "اختبار قبل البناء", title: "مختبر التحقق", description: "حوّل أي فكرة إلى تجربة صغيرة بمعيار نجاح وقرار واضح قبل الاستثمار في التطوير." };
const briefsMeta = { eyebrow: "جاهز لـ Claude Code", title: "Product Brief", description: "حوّل الفكرة إلى وثيقة تنفيذ منظمة تشمل المنتج والشاشات والمهام ومعايير القبول." };

function downloadCsv(filename: string, headers: string[], rows: string[][]) { const escapeCell = (value: string) => \`"\${value.replaceAll('"', '""')}"\`; const csv = [headers, ...rows].map((row) => row.map(escapeCell).join(",")).join("\\n"); const blob = new Blob([\`\\ufeff\${csv}\`], { type: "text/csv;charset=utf-8;" }); const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = filename; anchor.click(); URL.revokeObjectURL(url); toast(\`تم تصدير \${filename}\`); }
function printPdf(title: string, headers: string[], rows: string[][]) { const popup = window.open("", "_blank", "width=900,height=700"); if (!popup) { toast("اسمح بالنوافذ المنبثقة لتصدير PDF"); return; } const table = \`<table><thead><tr>\${headers.map((header) => \`<th>\${header}</th>\`).join("")}</tr></thead><tbody>\${rows.map((row) => \`<tr>\${row.map((cell) => \`<td>\${cell}</td>\`).join("")}</tr>\`).join("")}</tbody></table>\`; popup.document.write(\`<html dir="rtl"><head><title>\${title}</title><style>body{font-family:Cairo,Arial,sans-serif;padding:32px;color:#111}h1{font-size:24px;border-bottom:2px solid #111;padding-bottom:12px}table{width:100%;border-collapse:collapse;margin-top:24px}th,td{border:1px solid #bbb;padding:10px;text-align:right;font-size:12px}th{background:#f1f1f1}@media print{button{display:none}}</style></head><body><h1>\${title}</h1>\${table}<script>window.onload=()=>window.print()</script></body></html>\`); popup.document.close(); }

${validation.replaceAll("pageMeta.validation", "validationMeta")}

${brief.replaceAll("pageMeta.briefs", "briefsMeta")}

export default function HeavyToolPages({ page }: { page: "validation" | "briefs" }) { return page === "validation" ? <ValidationLab /> : <ProductBrief />; }
`;
fs.writeFileSync("client/src/pages/HeavyToolPages.tsx", content);
const withoutValidation = source.slice(0, startValidation) + source.slice(endBrief);
const importMarker = 'import { DEFAULT_TELEGRAM_TEMPLATES, renderTelegramTemplate } from "@shared/telegram-templates";';
const updated = withoutValidation.replace(importMarker, `${importMarker}\n\nconst HeavyToolPages = lazy(() => import("@/pages/HeavyToolPages"));`)
  .replace('if (active === "validation") return <ValidationLab />;', 'if (active === "validation") return <Suspense fallback={<div className="empty-state"><Loader2 size={28} className="spin" /><h3>جارٍ تحميل أداة التحقق...</h3></div>}><HeavyToolPages page="validation" /></Suspense>;')
  .replace('if (active === "briefs") return <ProductBrief />;', 'if (active === "briefs") return <Suspense fallback={<div className="empty-state"><Loader2 size={28} className="spin" /><h3>جارٍ تحميل Product Brief...</h3></div>}><HeavyToolPages page="briefs" /></Suspense>;');
fs.writeFileSync(homePath, updated);
