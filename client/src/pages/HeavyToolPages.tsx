import { useState } from "react";
import { CheckCircle2, ClipboardCheck, Download, ExternalLink, FileCode2, Loader2, Plus, Sparkles, Target } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

const validationMeta = { eyebrow: "اختبار قبل البناء", title: "مختبر التحقق", description: "حوّل أي فكرة إلى تجربة صغيرة بمعيار نجاح وقرار واضح قبل الاستثمار في التطوير." };
const briefsMeta = { eyebrow: "جاهز لـ Claude Code", title: "Product Brief", description: "حوّل الفكرة إلى وثيقة تنفيذ منظمة تشمل المنتج والشاشات والمهام ومعايير القبول." };

function downloadCsv(filename: string, headers: string[], rows: string[][]) { const escapeCell = (value: string) => `"${value.replaceAll('"', '""')}"`; const csv = [headers, ...rows].map((row) => row.map(escapeCell).join(",")).join("\n"); const blob = new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8;" }); const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = filename; anchor.click(); URL.revokeObjectURL(url); toast(`تم تصدير ${filename}`); }
function printPdf(title: string, headers: string[], rows: string[][]) { const popup = window.open("", "_blank", "width=900,height=700"); if (!popup) { toast("اسمح بالنوافذ المنبثقة لتصدير PDF"); return; } const table = `<table><thead><tr>${headers.map((header) => `<th>${header}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`).join("")}</tbody></table>`; popup.document.write(`<html dir="rtl"><head><title>${title}</title><style>body{font-family:Cairo,Arial,sans-serif;padding:32px;color:#111}h1{font-size:24px;border-bottom:2px solid #111;padding-bottom:12px}table{width:100%;border-collapse:collapse;margin-top:24px}th,td{border:1px solid #bbb;padding:10px;text-align:right;font-size:12px}th{background:#f1f1f1}@media print{button{display:none}}</style></head><body><h1>${title}</h1>${table}<script>window.onload=()=>window.print()</script></body></html>`); popup.document.close(); }

function ValidationLab() { const [idea, setIdea] = useState(""); const [experiment, setExperiment] = useState("landing"); const [created, setCreated] = useState(false); const [successMetric, setSuccessMetric] = useState("10 تسجيلات مهتمة"); return <><div className="page-heading"><div><p className="eyebrow">{validationMeta.eyebrow}</p><h1>{validationMeta.title}</h1><p className="page-description">{validationMeta.description}</p></div><button className="primary-button" onClick={() => { setCreated(true); toast("تم إنشاء تجربة التحقق"); }}><Plus size={16} /> تجربة جديدة</button></div><div className="validation-grid"><section className="panel tool-form-card"><div className="panel-head"><div><p className="eyebrow">Step 01</p><h2>عرّف الفرضية</h2></div><ClipboardCheck size={20} /></div><label>الفكرة التي تريد اختبارها<textarea value={idea} onChange={(e) => setIdea(e.target.value)} placeholder="مثال: تطبيق يساعد المستقلين على متابعة المصروفات..." /></label><label>نوع التجربة<select value={experiment} onChange={(e) => setExperiment(e.target.value)}><option value="landing">صفحة هبوط</option><option value="survey">استبيان قصير</option><option value="prototype">Prototype تفاعلي</option><option value="ad">إعلان تجريبي</option></select></label><label>معيار النجاح<input value={successMetric} onChange={(e) => setSuccessMetric(e.target.value)} /></label><button className="primary-button" onClick={() => { setCreated(true); toast("تم حفظ خطة التجربة"); }}><CheckCircle2 size={15} /> احفظ خطة التحقق</button></section><section className="panel validation-result-card"><div className="panel-head"><div><p className="eyebrow">Step 02</p><h2>قرار قابل للقياس</h2></div><Target size={20} /></div>{created ? <div className="validation-created"><CheckCircle2 size={34} /><h3>التجربة جاهزة للتنفيذ</h3><p>{idea || "فكرتك الجديدة"} · {experiment === "landing" ? "صفحة هبوط" : experiment} · الهدف: {successMetric}</p><div className="decision-row"><span>المدة المقترحة</span><strong>48 ساعة</strong></div><div className="decision-row"><span>القرار بعد التجربة</span><strong>استمر إذا تحقق المعيار</strong></div><button className="outline-button" onClick={() => toast("تم تصدير خطة التحقق") }><Download size={14} /> تصدير الخطة</button></div> : <div className="empty-state"><ClipboardCheck size={30} /><h3>ابدأ بفكرة واحدة</h3><p>سيساعدك المختبر على تحويلها إلى فرضية وتجربة ومعيار نجاح.</p></div>}</section></div></>; }

function ProductBrief() {
  const [idea, setIdea] = useState("مساعد إعادة تدوير أفكار المحتوى");
  const [productType, setProductType] = useState("تطبيق موبايل");
  const [focus, setFocus] = useState("ابنِ نسخة أولى صغيرة، واضحة، قابلة للقياس، مع اختبارات أساسية.");
  const [brief, setBrief] = useState<null | { problem: string; targetUser: string; valueProposition: string; scope: string[]; screens: string[]; userStories: string[]; dataModel: string[]; acceptanceCriteria: string[]; risks: string[]; nextStep: string }>(null);
  const generateBrief = trpc.productBrief.generate.useMutation({ onSuccess: (data) => { setBrief(data); toast("تم توليد Product Brief من نموذج الذكاء الاصطناعي"); }, onError: (error) => toast(`تعذر توليد الوثيقة: ${error.message}`) });
  const briefRows = brief ? [["الفكرة", idea], ["المشكلة", brief.problem], ["المستخدم", brief.targetUser], ["القيمة", brief.valueProposition], ["النطاق", brief.scope.join(" • ")], ["الشاشات", brief.screens.join(" • ")], ["User Stories", brief.userStories.join(" • ")], ["Data Model", brief.dataModel.join(" • ")], ["Acceptance Criteria", brief.acceptanceCriteria.join(" • ")], ["المخاطر", brief.risks.join(" • ")], ["الخطوة التالية", brief.nextStep]] : [];
  const context = brief ? `# ${idea}

## Problem
${brief.problem}

## Target User
${brief.targetUser}

## Value Proposition
${brief.valueProposition}

## Scope
${brief.scope.map((x) => `- ${x}`).join("\n")}

## Screens
${brief.screens.map((x) => `- ${x}`).join("\n")}

## User Stories
${brief.userStories.map((x) => `- ${x}`).join("\n")}

## Data Model
${brief.dataModel.map((x) => `- ${x}`).join("\n")}

## Acceptance Criteria
${brief.acceptanceCriteria.map((x) => `- ${x}`).join("\n")}

## Risks
${brief.risks.map((x) => `- ${x}`).join("\n")}

## Next Step
${brief.nextStep}` : "";
  const run = () => generateBrief.mutate({ idea, productType, focus });
  return <><div className="page-heading"><div><p className="eyebrow">{briefsMeta.eyebrow}</p><h1>{briefsMeta.title}</h1><p className="page-description">{briefsMeta.description}</p></div><div className="page-actions"><button className="outline-button small" disabled={!brief} onClick={() => printPdf("Product Brief — Venture OS", ["القسم", "المحتوى"], briefRows)}><ExternalLink size={14} /> PDF</button><button className="primary-button" disabled={generateBrief.isPending} onClick={run}>{generateBrief.isPending ? <><Loader2 size={15} className="spin" /> جارٍ التحليل</> : <><Sparkles size={16} /> ولّد بالذكاء الاصطناعي</>}</button></div></div><div className="brief-layout"><section className="panel tool-form-card"><div className="panel-head"><div><p className="eyebrow">AI Input</p><h2>من الفكرة إلى المنتج</h2></div><FileCode2 size={20} /></div><label>اسم الفكرة<input value={idea} onChange={(e) => { setIdea(e.target.value); setBrief(null); }} /></label><label>نوع المنتج<select value={productType} onChange={(e) => { setProductType(e.target.value); setBrief(null); }}><option>تطبيق موبايل</option><option>لعبة موبايل</option><option>منتج رقمي</option></select></label><label>تركيز التحليل<textarea value={focus} onChange={(e) => { setFocus(e.target.value); setBrief(null); }} /></label><button className="primary-button" disabled={generateBrief.isPending} onClick={run}><FileCode2 size={15} /> إنشاء Product Brief فعلي</button><p className="settings-note">يتم استدعاء النموذج من الخادم حتى لا يظهر أي مفتاح API في المتصفح.</p></section><section className="panel brief-preview"><div className="brief-document-head"><span className="document-mark">V</span><div><strong>VENTURE OS / PRODUCT BRIEF</strong><small>{brief ? "مخرجات حقيقية من نموذج الذكاء الاصطناعي" : "بانتظار التحليل"}</small></div></div>{brief ? <div className="brief-document"><h2>{idea}</h2>{[["01", "المشكلة", brief.problem], ["02", "المستخدم والقيمة", `${brief.targetUser} — ${brief.valueProposition}`], ["03", "النطاق والشاشات", `${brief.scope.join(" • ")} — ${brief.screens.join(" • ")}`], ["04", "User Stories", brief.userStories.join(" • ")], ["05", "Data Model", brief.dataModel.join(" • ")], ["06", "Acceptance Criteria", brief.acceptanceCriteria.join(" • ")], ["07", "المخاطر والخطوة التالية", `${brief.risks.join(" • ")} — ${brief.nextStep}`]].map(([number, title, body]) => <div className="brief-section" key={number}><span>{number}</span><div><strong>{title}</strong><p>{body}</p></div></div>)}<div className="brief-actions"><button className="outline-button" onClick={() => { navigator.clipboard?.writeText(context); toast("تم نسخ Product Brief كاملًا"); }}><FileCode2 size={14} /> نسخ السياق لـ Claude Code</button><button className="outline-button" onClick={() => downloadCsv("product-brief.csv", ["القسم", "المحتوى"], briefRows)}><Download size={14} /> CSV</button></div></div> : <div className="empty-state"><FileCode2 size={30} /><h3>{generateBrief.isPending ? "النموذج يحلل الفكرة..." : "ابدأ بتحليل فعلي"}</h3><p>{generateBrief.isPending ? "نرتب المشكلة والنطاق والشاشات ومعايير القبول." : "اكتب الفكرة واضغط الزر للحصول على Product Brief ديناميكي."}</p></div>}</section></div></>;
}

export default function HeavyToolPages({ page }: { page: "validation" | "briefs" }) { return page === "validation" ? <ValidationLab /> : <ProductBrief />; }
