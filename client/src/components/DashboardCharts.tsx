import { useState } from "react";
import { Activity, AlertTriangle, Download, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { toAiStatsExportRows } from "@shared/ai-stats-export";

const projectProgressData = [
  { name: "Pocket Quest", value: 72 },
  { name: "Habit Loop", value: 48 },
  { name: "Talkback AI", value: 14 },
  { name: "Pocket Ledger", value: 31 },
];

const marketSignalData = [
  { day: "السبت", signals: 8, opportunities: 2 },
  { day: "الأحد", signals: 11, opportunities: 3 },
  { day: "الإثنين", signals: 7, opportunities: 1 },
  { day: "الثلاثاء", signals: 14, opportunities: 4 },
  { day: "الأربعاء", signals: 12, opportunities: 3 },
  { day: "الخميس", signals: 16, opportunities: 5 },
  { day: "الجمعة", signals: 10, opportunities: 2 },
];

function downloadCsv(filename: string, headers: string[], rows: string[][]) {
  const escapeCell = (value: string) => `"${value.replaceAll('"', '""')}"`;
  const csv = [headers, ...rows].map((row) => row.map(escapeCell).join(",")).join("\n");
  const blob = new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
  toast(`تم تصدير ${filename}`);
}

function printPdf(title: string, headers: string[], rows: string[][]) {
  const popup = window.open("", "_blank", "width=900,height=700");
  if (!popup) {
    toast("اسمح بالنوافذ المنبثقة لتصدير PDF");
    return;
  }
  const table = `<table><thead><tr>${headers.map((header) => `<th>${header}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
  popup.document.write(`<html dir="rtl"><head><title>${title}</title><style>body{font-family:Cairo,Arial,sans-serif;padding:32px;color:#111}h1{font-size:24px;border-bottom:2px solid #111;padding-bottom:12px}table{width:100%;border-collapse:collapse;margin-top:24px}th,td{border:1px solid #bbb;padding:10px;text-align:right;font-size:12px}th{background:#f1f1f1}@media print{button{display:none}}</style></head><body><h1>${title}</h1>${table}<script>window.onload=()=>window.print()</script></body></html>`);
  popup.document.close();
}

export default function DashboardCharts() {
  const { isAuthenticated } = useAuth();
  const githubQuery = trpc.github.status.useQuery(undefined, { enabled: isAuthenticated, retry: false });
  const taskStatsQuery = trpc.aiTasks.stats.useQuery({ days: 14 }, { enabled: isAuthenticated, retry: false });
  const [range, setRange] = useState("7d");
  const github = githubQuery.data?.connected ? githubQuery.data : null;
  const progressData = github ? [{ name: github.repo.split("/").pop() ?? "GitHub", value: github.health }, ...projectProgressData.slice(0, 3)] : projectProgressData;
  const marketData = github ? marketSignalData.map((item, index) => index === marketSignalData.length - 1 ? { ...item, signals: Math.max(item.signals, github.recentCommits), opportunities: Math.max(item.opportunities, Math.min(github.openIssues, 9)) } : item) : marketSignalData;
  const statsRows = toAiStatsExportRows(taskStatsQuery.data ?? []);
  const exportStatsCsv = () => downloadCsv("ai-task-statistics.csv", ["التاريخ", "نجاح", "فشل"], statsRows);
  const exportStatsPdf = () => printPdf("AI Task Statistics — Venture OS", ["التاريخ", "نجاح", "فشل"], statsRows);

  return <section className="charts-grid">
    <Card className="chart-card"><div className="panel-head"><div><p className="eyebrow">Project pulse</p><h2>تقدم المشاريع</h2><span className="chart-note">{github ? "تتضمن حالة مستودع GitHub المرتبط" : "نسبة الإنجاز الحالية لكل مشروع"}</span></div><select value={range} onChange={(event) => setRange(event.target.value)} aria-label="فترة الرسم"><option value="7d">هذا الأسبوع</option><option value="30d">هذا الشهر</option></select></div><div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><BarChart data={progressData} layout="vertical" margin={{ top: 8, right: 12, left: 8, bottom: 8 }}><CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" /><XAxis type="number" domain={[0, 100]} tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} axisLine={false} tickLine={false} /><YAxis dataKey="name" type="category" width={84} tick={{ fill: "var(--foreground)", fontSize: 10 }} axisLine={false} tickLine={false} /><Tooltip cursor={{ fill: "var(--accent)" }} contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--popover-foreground)", fontFamily: "Cairo" }} formatter={(value) => [`${value}%`, "الإنجاز"]} /><Bar dataKey="value" fill="var(--foreground)" radius={[0, 4, 4, 0]} barSize={14} /></BarChart></ResponsiveContainer></div></Card>
    <Card className="chart-card"><div className="panel-head"><div><p className="eyebrow">Market signals</p><h2>إشارات السوق</h2><span className="chart-note">{github ? `محدثة من GitHub: ${github.openIssues} issues و${github.openPullRequests} PRs` : "الإشارات والفرص التي اكتشفها المسح اليومي"}</span></div><div className="chart-legend"><span><i className="legend-line solid" /> إشارات</span><span><i className="legend-line dashed" /> فرص</span></div></div><div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><LineChart data={marketData} margin={{ top: 8, right: 8, left: -12, bottom: 4 }}><CartesianGrid strokeDasharray="3 3" stroke="var(--border)" /><XAxis dataKey="day" tick={{ fill: "var(--muted-foreground)", fontSize: 9 }} axisLine={false} tickLine={false} /><YAxis tick={{ fill: "var(--muted-foreground)", fontSize: 9 }} axisLine={false} tickLine={false} width={24} /><Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--popover-foreground)", fontFamily: "Cairo" }} /><Line type="monotone" dataKey="signals" stroke="var(--foreground)" strokeWidth={2} dot={{ r: 3, fill: "var(--foreground)" }} activeDot={{ r: 5 }} name="إشارات" /><Line type="monotone" dataKey="opportunities" stroke="var(--muted-foreground)" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 3, fill: "var(--background)", stroke: "var(--foreground)" }} name="فرص" /></LineChart></ResponsiveContainer></div></Card>
    <Card className="chart-card"><div className="panel-head"><div><p className="eyebrow">AI execution</p><h2>نجاح وفشل المهام</h2><span className="chart-note">آخر 14 يومًا من سجل التشغيل الفعلي</span></div><div className="chart-tools"><button className="outline-button small" disabled={taskStatsQuery.isLoading || !taskStatsQuery.data?.length} onClick={exportStatsCsv}><Download size={13} /> CSV</button><button className="outline-button small" disabled={taskStatsQuery.isLoading || !taskStatsQuery.data?.length} onClick={exportStatsPdf}><FileText size={13} /> PDF</button></div></div><div className="chart-wrap">{taskStatsQuery.isLoading ? <div className="chart-empty-state"><Loader2 size={24} className="spin" /><span>جارٍ تحميل إحصائيات المهام...</span></div> : taskStatsQuery.isError ? <div className="chart-empty-state"><AlertTriangle size={24} /><span>تعذر تحميل الإحصائيات حاليًا</span><button className="outline-button small" onClick={() => taskStatsQuery.refetch()}>إعادة المحاولة</button></div> : (taskStatsQuery.data?.length ?? 0) === 0 ? <div className="chart-empty-state"><Activity size={24} /><span>ستظهر الإحصائيات بعد أول تشغيل لمهمة AI</span></div> : <ResponsiveContainer width="100%" height="100%"><LineChart data={taskStatsQuery.data} margin={{ top: 8, right: 8, left: -12, bottom: 4 }}><CartesianGrid strokeDasharray="3 3" stroke="var(--border)" /><XAxis dataKey="date" tick={{ fill: "var(--muted-foreground)", fontSize: 9 }} tickFormatter={(value) => String(value).slice(5)} axisLine={false} tickLine={false} /><YAxis allowDecimals={false} tick={{ fill: "var(--muted-foreground)", fontSize: 9 }} axisLine={false} tickLine={false} width={24} /><Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--popover-foreground)", fontFamily: "Cairo" }} /><Line type="monotone" dataKey="success" stroke="var(--foreground)" strokeWidth={2} dot={{ r: 3, fill: "var(--foreground)" }} name="نجاح" /><Line type="monotone" dataKey="failed" stroke="var(--muted-foreground)" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 3, fill: "var(--background)", stroke: "var(--foreground)" }} name="فشل" /></LineChart></ResponsiveContainer>}</div></Card>
  </section>;
}
