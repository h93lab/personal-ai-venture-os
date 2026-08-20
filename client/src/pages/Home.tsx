// Design philosophy: Shadcn Dashboard reference — Cairo typography, neutral tokens, AMOLED dark mode, compact utility density, and decision-oriented AI workspace patterns.
// Prototype-only screen: all AI, Telegram, and task results are illustrative local state; no real integrations are connected.
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import LoginPage from "@/pages/LoginPage";
import {
  Activity,
  Archive,
  ArrowUpRight,
  Bell,
  Bot,
  BrainCircuit,
  CalendarClock,
  Check,
  CircleDot,
  ClipboardCheck,
  FileCode2,
  HeartPulse,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  Clock3,
  Command,
  Compass,
  Database,
  Download,
  ExternalLink,
  FileText,
  Filter,
  Gamepad2,
  GitBranch,
  Globe2,
  Inbox,
  Layers3,
  Lightbulb,
  Loader2,
  Link2,
  LogOut,
  Menu,
  MessageCircle,
  MoreHorizontal,
  Moon,
  Plus,
  Radar,
  Search,
  Send,
  Settings2,
  Sparkles,
  Sun,
  Target,
  TerminalSquare,
  TimerReset,
  TrendingUp,
  UserRound,
  X,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import ErrorBoundary from "@/components/ErrorBoundary";
import { useTheme } from "@/contexts/ThemeContext";
import { trpc } from "@/lib/trpc";

function downloadCsv(filename: string, headers: string[], rows: string[][]) { const escapeCell = (value: string) => `"${value.replaceAll('"', '""')}"`; const csv = [headers, ...rows].map((row) => row.map(escapeCell).join(",")).join("\n"); const blob = new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8;" }); const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = filename; anchor.click(); URL.revokeObjectURL(url); toast(`تم تصدير ${filename}`); }
function printPdf(title: string, headers: string[], rows: string[][]) { const popup = window.open("", "_blank", "width=900,height=700"); if (!popup) { toast("اسمح بالنوافذ المنبثقة لتصدير PDF"); return; } const table = `<table><thead><tr>${headers.map((header) => `<th>${header}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`).join("")}</tbody></table>`; popup.document.write(`<html dir="rtl"><head><title>${title}</title><style>body{font-family:Cairo,Arial,sans-serif;padding:32px;color:#111}h1{font-size:24px;border-bottom:2px solid #111;padding-bottom:12px}table{width:100%;border-collapse:collapse;margin-top:24px}th,td{border:1px solid #bbb;padding:10px;text-align:right;font-size:12px}th{background:#f1f1f1}@media print{button{display:none}}</style></head><body><h1>${title}</h1>${table}<script>window.onload=()=>window.print()</script></body></html>`); popup.document.close(); }
import { filterAiTaskRuns } from "@shared/ai-task-filters";
import { DEFAULT_TELEGRAM_TEMPLATES, renderTelegramTemplate } from "@shared/telegram-templates";

const HeavyToolPages = lazy(() => import("@/pages/HeavyToolPages"));
const CompetitorsPage = lazy(() => import("@/pages/Competitors"));
const SettingsPage = lazy(() => import("@/pages/SettingsPage"));

function LazyPage({ label, children }: { label: string; children: React.ReactNode }) {
  return <ErrorBoundary><Suspense fallback={<div className="empty-state" role="status" aria-live="polite"><Loader2 size={28} className="spin" /><h3>{label}</h3></div>}>{children}</Suspense></ErrorBoundary>;
}

type PageKey = "overview" | "tasks" | "discovery" | "ideas" | "projects" | "knowledge" | "competitors" | "telegram" | "validation" | "briefs" | "health" | "settings";
type Task = { id: number; name: string; desc: string; cadence: string; status: "نشطة" | "متوقفة"; last: string; next: string; icon: typeof Radar; tone: string };

const navGroups = [
  { label: "المساحة", items: [{ key: "overview", label: "نظرة عامة", icon: Activity }, { key: "discovery", label: "الاكتشاف اليومي", icon: Radar }, { key: "ideas", label: "مختبر الأفكار", icon: Lightbulb }, { key: "projects", label: "المشاريع", icon: Layers3 }] },
  { label: "المعرفة", items: [{ key: "knowledge", label: "مخزن المعرفة", icon: Database }, { key: "competitors", label: "المنافسون", icon: Target }] },
  { label: "الأتمتة", items: [{ key: "tasks", label: "مهام الذكاء الاصطناعي", icon: Bot }, { key: "telegram", label: "Telegram", icon: MessageCircle }] },
  { label: "أدوات المنتج", items: [{ key: "validation", label: "مختبر التحقق", icon: ClipboardCheck }, { key: "briefs", label: "Product Brief", icon: FileCode2 }, { key: "health", label: "صحة المشاريع", icon: HeartPulse }] },
] as const;

const initialTasks: Task[] = [
  { id: 1, name: "مسح فرص تطبيقات الموبايل", desc: "السوق + السوشيال + متاجر التطبيقات", cadence: "يوميًا · 08:00", status: "نشطة", last: "منذ 3 ساعات", next: "غدًا، 08:00", icon: Radar, tone: "amber" },
  { id: 2, name: "مراقبة منافسي الإنتاجية", desc: "تحديثات، مراجعات، وفجوات الميزات", cadence: "يوميًا · 09:30", status: "نشطة", last: "منذ 1 يوم", next: "غدًا، 09:30", icon: Target, tone: "blue" },
  { id: 3, name: "مراجعة مشروع Habit Loop", desc: "اقتراح الخطوة التالية ومخاطر الإطلاق", cadence: "أسبوعيًا · الإثنين", status: "متوقفة", last: "منذ 5 أيام", next: "متوقفة", icon: TerminalSquare, tone: "slate" },
];

const pageMeta: Record<PageKey, { eyebrow: string; title: string; description: string }> = {
  overview: { eyebrow: "الثلاثاء، 19 أغسطس 2026", title: "صباحك يبدأ بإشارة واضحة.", description: "موجز شخصي لما يستحق انتباهك الآن عبر الأفكار والمشاريع والسوق." },
  tasks: { eyebrow: "الأتمتة الشخصية", title: "مهام الذكاء الاصطناعي", description: "أنشئ مهامًا تعمل وحدها، واحتفظ بكل نتيجة كسجل قابل للمراجعة." },
  discovery: { eyebrow: "آخر مسح · منذ 3 ساعات", title: "السوق يتحدث. هذه أبرز الإشارات.", description: "تقرير يومي يربط إشارات السوق بمهاراتك وفرص تطبيقات وألعاب قابلة للاختبار." },
  ideas: { eyebrow: "17 فكرة محفوظة · 4 تحتاج قرارًا", title: "مختبر الأفكار", description: "لا تجمع أفكارًا أكثر؛ طوّر الأفكار التي تستحق تجربة حقيقية." },
  projects: { eyebrow: "4 مشاريع نشطة", title: "المشاريع التي تتحرك", description: "حالة التطبيقات والألعاب والقرار التالي لكل مشروع." },
  knowledge: { eyebrow: "246 قطعة معرفة", title: "مخزن المعرفة", description: "ملفات وملاحظات ومصادر مرتبطة ببعضها، جاهزة لتصبح قرارات." },
  competitors: { eyebrow: "28 منافسًا متابعًا", title: "المنافسون والإشارات", description: "راقب ما يتغير في السوق دون أن تفقد سياق فكرتك." },
  telegram: { eyebrow: "قناة شخصية", title: "Telegram كامتداد للمساحة", description: "استقبل التقارير واسأل مساعدك من أي مكان — الربط الحقيقي سيأتي لاحقًا." },
  settings: { eyebrow: "التحكم والخصوصية", title: "إعدادات مساحتي", description: "غيّر بيانات المستخدم وكلمة المرور وتفضيلات الواجهة من مكان واحد." },
  validation: { eyebrow: "اختبار قبل البناء", title: "مختبر التحقق", description: "حوّل أي فكرة إلى تجربة صغيرة بمعيار نجاح وقرار واضح قبل الاستثمار في التطوير." },
  briefs: { eyebrow: "جاهز لـ Claude Code", title: "Product Brief", description: "حوّل الفكرة إلى وثيقة تنفيذ منظمة تشمل المنتج والشاشات والمهام ومعايير القبول." },
  health: { eyebrow: "مؤشرات القرار", title: "صحة المشاريع", description: "تابع تقدم تطبيقاتك وألعابك واكتشف المشروع الذي يحتاج تدخلك الآن." },
};

function StatCard({ icon: Icon, label, value, note, accent = "blue" }: { icon: typeof Activity; label: string; value: string; note: string; accent?: string }) {
  return <Card className="stat-card">
    <div className={`stat-icon ${accent}`}><Icon size={17} strokeWidth={1.8} /></div>
    <div className="stat-copy"><span>{label}</span><strong>{value}</strong><small>{note}</small></div>
  </Card>;
}

function Pill({ children, tone = "slate" }: { children: React.ReactNode; tone?: string }) {
  return <Badge variant="secondary" className={`pill ${tone}`}><span className="pill-dot" />{children}</Badge>;
}

type CommandItem = { key: string; label: string; icon: typeof Activity };
function CommandPalette({ items, onSelect, onClose }: { items: CommandItem[]; onSelect: (key: string) => void; onClose: () => void }) { return <div className="command-backdrop" onClick={onClose}><div className="command-palette" onClick={(event) => event.stopPropagation()}><div className="command-search"><Search size={16} /><input autoFocus placeholder="ابحث عن صفحة أو إجراء..." /></div><div className="command-list">{items.map((item) => <button key={item.key} onClick={() => onSelect(item.key)}><item.icon size={16} /><span>{item.label}</span><ArrowUpRight size={14} /></button>)}<button onClick={() => onSelect("settings")}><Settings2 size={16} /><span>الإعدادات</span><ArrowUpRight size={14} /></button></div><div className="command-hint"><kbd>Esc</kbd> للإغلاق</div></div></div>; }

function AppShell({ active, setActive, children, userName, logout }: { active: PageKey; setActive: (key: PageKey) => void; children: React.ReactNode; userName: string; logout: () => void }) {
  const { theme, toggleTheme } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  useEffect(() => { const handleKey = (event: KeyboardEvent) => { if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); setCommandOpen(true); } if (event.key === "Escape") { setCommandOpen(false); setUserMenuOpen(false); } }; window.addEventListener("keydown", handleKey); return () => window.removeEventListener("keydown", handleKey); }, []);
  const commandItems: CommandItem[] = navGroups.flatMap((group) => group.items.map((item) => ({ key: String(item.key), label: item.label, icon: item.icon as typeof Activity })));
  return <div className="app-shell" dir="rtl">
    <aside className={`sidebar ${mobileOpen ? "mobile-open" : ""}`}>
      <div className="brand-row">
        <div className="brand-mark"><img src="/manus-storage/venture-os-mark_cc2bdbe7.png" alt="" /></div>
        <div><strong>Venture OS</strong><span>مختبرك الشخصي</span></div>
        <button className="icon-button sidebar-close" onClick={() => setMobileOpen(false)}><X size={17} /></button>
      </div>
      <nav className="side-nav">
        {navGroups.map((group) => <div className="nav-group" key={group.label}><span className="nav-label">{group.label}</span>{group.items.map((item) => <button key={item.key} className={`nav-item ${active === item.key ? "active" : ""}`} onClick={() => { setActive(item.key as PageKey); setMobileOpen(false); }}><item.icon size={17} strokeWidth={active === item.key ? 2.1 : 1.7} /><span>{item.label}</span>{item.key === "tasks" && <b className="nav-count">3</b>}</button>)}</div>)}
      </nav>
      <div className="sidebar-bottom"><div className="sidebar-status"><span className="live-dot" /><div><strong>المساعد متصل</strong><span>آخر مزامنة منذ 3 د</span></div></div></div>
    </aside>
    <main className="main-shell">
      <header className="topbar"><button className="mobile-menu icon-button" onClick={() => setMobileOpen(true)}><Menu size={19} /></button><div className="breadcrumbs"><span>Venture OS</span><span>/</span><strong>{pageMeta[active].title}</strong></div><div className="top-actions"><button className="search-trigger" onClick={() => setCommandOpen(true)}><Search size={16} /><span>ابحث وتنقل في مساحتك</span><kbd>⌘ K</kbd></button><button className="icon-button" onClick={() => toast("لا توجد تنبيهات جديدة") }><Bell size={18} /><i className="notification-dot" /></button><button className="icon-button" onClick={toggleTheme} aria-label="إجراء">{theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}</button><div className="user-menu-wrap"><button className="user-trigger" onClick={() => setUserMenuOpen((open) => !open)} aria-expanded={userMenuOpen}><span className="top-avatar">{userName.slice(0, 1)}</span><span className="user-trigger-name">{userName}</span><ChevronDown size={14} /></button>{userMenuOpen && <div className="user-menu"><div className="user-menu-heading"><span className="top-avatar">{userName.slice(0, 1)}</span><div><strong>{userName}</strong><small>مساحة شخصية</small></div></div><button onClick={() => { setActive("settings"); setUserMenuOpen(false); }}><Settings2 size={15} /> الإعدادات</button><button onClick={() => { setUserMenuOpen(false); logout(); }}><LogOut size={15} /> تسجيل الخروج</button></div>}</div></div></header>
      <div className="page-content">{children}</div>
    {commandOpen && <CommandPalette items={commandItems} onSelect={(key) => { setActive(key as PageKey); setCommandOpen(false); }} onClose={() => setCommandOpen(false)} />}
    </main>
  </div>;
}


const DashboardCharts = lazy(() => import("@/components/DashboardCharts"));

function Overview({ go }: { go: (key: PageKey) => void }) {
  return <>
    <div className="page-heading"><div><p className="eyebrow">{pageMeta.overview.eyebrow}</p><h1>{pageMeta.overview.title}</h1><p className="page-description">{pageMeta.overview.description}</p></div><button className="primary-button" onClick={() => go("discovery")}><Radar size={16} /> افتح تقرير اليوم <ArrowUpRight size={15} /></button></div>
    <div className="stats-grid"><StatCard icon={Lightbulb} label="أفكار تحتاج قرارًا" value="04" note="+2 منذ آخر مراجعة" accent="amber" /><StatCard icon={Layers3} label="مشاريع قيد الحركة" value="03" note="واحد قريب من الإطلاق" accent="blue" /><StatCard icon={TrendingUp} label="إشارات جديدة" value="12" note="من مسح اليوم" accent="green" /><StatCard icon={TimerReset} label="وقت تم توفيره" value="6.4h" note="هذا الأسبوع" accent="violet" /></div>
    <div className="dashboard-grid">
      <section className="panel discovery-panel"><div className="signal-rule" /><div className="report-stamp"><span>تقرير بحثي شخصي</span><b>V.06 · 19 AUG 2026</b></div><div className="panel-head"><div><p className="eyebrow">Daily Discovery · 08:00</p><h2>تقرير الاكتشاف اليومي</h2></div><button className="ghost-button" onClick={() => go("discovery")}>عرض التقرير <ArrowUpRight size={14} /></button></div><div className="discovery-feature"><div className="discovery-art"><img src="/manus-storage/daily-discovery-illustration_d91bd052.png" alt="رسم توضيحي للاكتشاف اليومي" /></div><div className="feature-copy"><Pill tone="amber">فرصة قوية · 86/100</Pill><h3>أداة موبايل تساعد صناع المحتوى على إعادة تدوير أفكارهم إلى سلسلة منشورات.</h3><p>إشارة متكررة في مجتمعات المبدعين، مع فجوة واضحة في تجربة الهاتف وسرعة تحويل الملاحظة إلى خطة محتوى.</p><div className="source-row"><span><Globe2 size={13} /> 8 مصادر</span><span><Target size={13} /> 3 منافسين</span><span><Clock3 size={13} /> تحقق أولي: 2 يوم</span></div><div className="feature-actions"><button className="primary-button small" onClick={() => toast("تم حفظ نسخة جديدة للفكرة") }><Plus size={14} /> احفظ كفكرة</button><button className="outline-button small" onClick={() => toast("تم فتح مصادر التقرير التجريبية") }><ExternalLink size={14} /> المصادر</button></div></div></div></section>
      <section className="panel next-panel"><div className="panel-head"><div><p className="eyebrow">Focus</p><h2>ماذا الآن؟</h2></div><button className="icon-button" aria-label="إجراء"><MoreHorizontal size={17} /></button></div><div className="focus-item active"><div className="focus-marker"><Zap size={15} /></div><div><strong>اختبر افتراض الجمهور</strong><p>اسأل 5 صناع محتوى عن سير العمل الحالي.</p><span>20 دقيقة · اليوم</span></div></div><div className="focus-item"><div className="focus-marker muted"><GitBranch size={15} /></div><div><strong>راجع نسخة Habit Loop</strong><p>التقرير الأسبوعي ينتظر قرارك.</p><span>45 دقيقة · غدًا</span></div></div><div className="focus-item"><div className="focus-marker muted"><FileText size={15} /></div><div><strong>حوّل الإشارة إلى PRD</strong><p>الفرصة الجديدة جاهزة للتوثيق.</p><span>30 دقيقة · الخميس</span></div></div><button className="full-ghost" onClick={() => go("projects")}>عرض كل الأولويات <ArrowUpRight size={14} /></button></section>
    </div>
    <ProductToolsStrip go={go} />
    <ProjectHealthWidget go={go} />
    <Suspense fallback={<div className="charts-grid"><div className="chart-empty-state"><Loader2 size={24} className="spin" /><span>جارٍ تحميل الرسوم...</span></div></div>}><DashboardCharts /></Suspense>
    <div className="lower-grid"><section className="panel activity-panel"><div className="panel-head"><div><p className="eyebrow">Activity</p><h2>آخر ما تحرك</h2></div><button className="ghost-button" onClick={() => go("knowledge")}>كل السجل <ArrowUpRight size={14} /></button></div><div className="timeline"><div className="timeline-item"><div className="timeline-icon amber"><Sparkles size={15} /></div><div><strong>تم إنشاء نسخة جديدة من «تطبيق المصروفات»</strong><p>بناءً على 6 إشارات سوقية جديدة</p></div><time>منذ 3 س</time></div><div className="timeline-item"><div className="timeline-icon blue"><Bot size={15} /></div><div><strong>اكتملت مهمة «مراقبة منافسي الإنتاجية»</strong><p>تقرير من 14 مصدرًا · 3 منافسين جدد</p></div><time>أمس</time></div><div className="timeline-item"><div className="timeline-icon green"><Check size={15} /></div><div><strong>تم تحديث حالة Habit Loop</strong><p>من «تطوير» إلى «اختبار مغلق»</p></div><time>أمس</time></div></div></section><section className="panel projects-mini"><div className="panel-head"><div><p className="eyebrow">Projects</p><h2>مشاريعك الآن</h2></div><button className="icon-button" onClick={() => go("projects")}><ArrowUpRight size={16} /></button></div><ProjectRow icon={Gamepad2} title="Pocket Quest" meta="لعبة · اختبار مغلق" progress={72} tone="amber" /><ProjectRow icon={Target} title="Habit Loop" meta="تطبيق · تطوير" progress={48} tone="blue" /><ProjectRow icon={MessageCircle} title="Talkback AI" meta="تطبيق · فكرة" progress={14} tone="violet" /></section></div>
  </>;
}

function ProjectRow({ icon: Icon, title, meta, progress, tone }: { icon: typeof Gamepad2; title: string; meta: string; progress: number; tone: string }) { return <div className="project-row"><div className={`project-icon ${tone}`}><Icon size={17} /></div><div className="project-info"><strong>{title}</strong><span>{meta}</span></div><div className="project-progress"><div className="progress-track"><i style={{ width: `${progress}%` }} /></div><span>{progress}%</span></div></div>; }

function Tasks() {
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [filterTask, setFilterTask] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [title, setTitle] = useState("");
  const [instructions, setInstructions] = useState("");
  const [cadence, setCadence] = useState<"manual" | "daily" | "weekly">("daily");
  const [runTime, setRunTime] = useState("08:00");
  const tasksQuery = trpc.aiTasks.list.useQuery(undefined, { retry: false });
  const runsQuery = trpc.aiTasks.runs.useQuery(undefined, { retry: false });
  const utils = trpc.useUtils();
  const closeForm = () => { setOpen(false); setEditingId(null); setTitle(""); setInstructions(""); setCadence("daily"); setRunTime("08:00"); };
  const refresh = () => { void utils.aiTasks.list.invalidate(); void utils.aiTasks.runs.invalidate(); };
  const createTask = trpc.aiTasks.create.useMutation({ onSuccess: () => { toast.success("تم إنشاء المهمة وجدولتها بنجاح"); refresh(); closeForm(); }, onError: (error) => toast.error(`تعذر إنشاء المهمة: ${error.message}`) });
  const updateTask = trpc.aiTasks.update.useMutation({ onSuccess: () => { toast.success("تم تحديث المهمة وجدولتها من جديد"); refresh(); closeForm(); }, onError: (error) => toast.error(`تعذر تحديث المهمة: ${error.message}`) });
  const toggleTask = trpc.aiTasks.update.useMutation({ onSuccess: () => { toast.success("تم تحديث حالة المهمة والجدولة"); refresh(); }, onError: (error) => toast.error(`تعذر تغيير حالة المهمة: ${error.message}`) });
  const deleteTask = trpc.aiTasks.delete.useMutation({ onSuccess: () => { toast.success("تم حذف المهمة ونتائجها التاريخية"); refresh(); }, onError: (error) => toast.error(`تعذر حذف المهمة: ${error.message}`) });
  const runTask = trpc.aiTasks.run.useMutation({ onSuccess: (data) => { toast.success("اكتمل تشغيل المهمة وحُفظت النتيجة في السجل"); refresh(); }, onError: (error) => toast.error(`فشل تشغيل المهمة: ${error.message}`) });
  const tasks = tasksQuery.data ?? [];
  const runs = runsQuery.data ?? [];
  const filteredTasks = tasks.filter((task) => task.title.includes(query) || task.instructions.includes(query));
  const filteredRuns = filterAiTaskRuns(runs, { taskId: filterTask === "all" ? undefined : Number(filterTask), status: filterStatus === "all" ? undefined : filterStatus as "running" | "success" | "failed", fromDate: fromDate || undefined, toDate: toDate || undefined });
  const submit = () => { if (!title.trim() || !instructions.trim()) { toast.error("اكتب اسم المهمة وتعليماتها أولًا"); return; } if (editingId) updateTask.mutate({ id: editingId, data: { title, instructions, cadence, runTime } }); else createTask.mutate({ title, instructions, cadence, runTime, status: "active" }); };
  const editTask = (task: (typeof tasks)[number]) => { setEditingId(task.id); setTitle(task.title); setInstructions(task.instructions); setCadence(task.cadence); setRunTime(task.runTime); setOpen(true); };
  const loading = tasksQuery.isLoading || runsQuery.isLoading;
  return <><div className="page-heading"><div><p className="eyebrow">{pageMeta.tasks.eyebrow}</p><h1>{pageMeta.tasks.title}</h1><p className="page-description">أنشئ مهامًا حقيقية تعمل يدويًا أو وفق جدول، وراجع كل نتيجة دون استبدال السجل السابق.</p></div><div className="page-actions"><button className="outline-button small" onClick={() => downloadCsv("ai-tasks.csv", ["المهمة", "التعليمات", "التكرار", "الحالة"], tasks.map((task) => [task.title, task.instructions, task.cadence, task.status]))}><FileText size={14} /> CSV</button><button className="primary-button" onClick={() => { setEditingId(null); setTitle(""); setInstructions(""); setOpen(true); }}><Plus size={16} /> مهمة جديدة</button></div></div><div className="task-summary"><div><span>المهام النشطة</span><strong>{tasks.filter((task) => task.status === "active").length}</strong></div><div><span>النتائج التاريخية</span><strong>{runs.length}</strong></div><div><span>تشغيل قادم</span><strong>{tasks.find((task) => task.status === "active" && task.nextRunAt) ? "مجدول" : "يدوي"}</strong></div><div className="task-summary-note"><Sparkles size={16} /><span>كل تشغيل يحفظ كسجل مستقل.</span></div></div><section className="panel tasks-panel"><div className="table-toolbar"><div className="toolbar-title"><h2>المهام الحالية</h2><span>{tasks.length} مهام</span></div><div className="toolbar-actions"><label className="inline-search"><Search size={14} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ابحث في المهام" /></label></div></div>{loading ? <div className="empty-state"><Loader2 size={28} className="spin" /><h3>جارٍ تحميل المهام...</h3><p>نستعيد إعداداتك وجدول التشغيل.</p></div> : filteredTasks.length === 0 ? <div className="empty-state"><Bot size={28} /><h3>لا توجد مهام بعد</h3><p>ابدأ بمهمة يومية لمسح السوق أو تحليل منافس.</p><button className="primary-button small" onClick={() => setOpen(true)}><Plus size={14} /> أنشئ أول مهمة</button></div> : <div className="task-table">{filteredTasks.map((task) => <div className="task-row" key={task.id}><div className="task-icon blue"><Bot size={17} /></div><div className="task-main"><strong>{task.title}</strong><span>{task.instructions}</span></div><div className="task-cadence"><CalendarClock size={14} /><span>{task.cadence === "daily" ? "يوميًا" : task.cadence === "weekly" ? "أسبوعيًا" : "يدويًا"} · {task.runTime}</span></div><div className="task-run"><span>آخر تشغيل</span><strong>{task.lastRunAt ? new Date(task.lastRunAt).toLocaleDateString("ar-EG") : "لم تعمل بعد"}</strong></div><div><Pill tone={task.status === "active" ? "green" : "slate"}>{task.status === "active" ? "نشطة" : "متوقفة"}</Pill></div><div className="row-actions"><button className="icon-button" title={task.status === "active" ? "إيقاف المهمة" : "استئناف المهمة"} disabled={toggleTask.isPending} onClick={() => toggleTask.mutate({ id: task.id, data: { status: task.status === "active" ? "paused" : "active" } })}>{toggleTask.isPending ? <Loader2 size={16} className="spin" /> : <TimerReset size={16} />}</button><button className="icon-button" title="تشغيل الآن" disabled={runTask.isPending || task.status !== "active"} onClick={() => runTask.mutate({ id: task.id })}>{runTask.isPending ? <Loader2 size={16} className="spin" /> : <PlayIcon />}</button><button className="icon-button" title="تعديل المهمة" onClick={() => editTask(task)}><Settings2 size={16} /></button><button className="icon-button" title="حذف المهمة" disabled={deleteTask.isPending} onClick={() => { if (window.confirm("حذف المهمة وكل نتائجها التاريخية؟")) deleteTask.mutate({ id: task.id }); }}><X size={16} /></button></div></div>)}</div>}</section><section className="panel tasks-panel"><div className="panel-head"><div><p className="eyebrow">Execution history</p><h2>النتائج التاريخية</h2></div><div className="history-filters"><select value={filterTask} onChange={(event) => setFilterTask(event.target.value)}><option value="all">كل المهام</option>{tasks.map((task) => <option value={String(task.id)} key={task.id}>{task.title}</option>)}</select><select value={filterStatus} onChange={(event) => setFilterStatus(event.target.value)}><option value="all">كل الحالات</option><option value="success">نجاح</option><option value="failed">فشل</option><option value="running">قيد التشغيل</option></select><input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} aria-label="من تاريخ" /><input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} aria-label="إلى تاريخ" /></div></div>{filteredRuns.length === 0 ? <div className="empty-state"><Archive size={26} /><h3>{runs.length === 0 ? "لا توجد نتائج محفوظة" : "لا توجد نتائج مطابقة"}</h3><p>{runs.length === 0 ? "شغّل أي مهمة ليظهر التقرير هنا دون فقدان النتائج السابقة." : "غيّر الفلاتر لعرض نتائج أخرى."}</p></div> : <div className="task-table">{filteredRuns.slice(0, 12).map((run) => <div className="task-row" key={run.id}><div className={`task-icon ${run.status === "success" ? "green" : run.status === "failed" ? "amber" : "blue"}`}><FileText size={17} /></div><div className="task-main"><strong>{tasks.find((task) => task.id === run.taskId)?.title ?? `مهمة #${run.taskId}`}</strong><span>{run.status === "success" ? (run.result ?? "تم الحفظ دون نص") : (run.error ?? "التشغيل قيد المعالجة")}</span></div><div className="task-run"><span>بدأت</span><strong>{new Date(run.startedAt).toLocaleString("ar-EG")}</strong></div><div><Pill tone={run.status === "success" ? "green" : run.status === "failed" ? "amber" : "blue"}>{run.status === "success" ? "نجاح" : run.status === "failed" ? "فشل" : "قيد التشغيل"}</Pill></div></div>)}</div>}</section>{open && <div className="modal-backdrop" onClick={closeForm}><div className="modal-card" onClick={(event) => event.stopPropagation()}><div className="modal-head"><div><p className="eyebrow">{editingId ? "Edit AI Task" : "New AI Task"}</p><h2>{editingId ? "تعديل مهمة الذكاء الاصطناعي" : "أنشئ مهمة جديدة"}</h2></div><button className="icon-button" onClick={closeForm} aria-label="إجراء"><X size={18} /></button></div><label>اسم المهمة<input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="مثال: راقب فرص ألعاب الأطفال" /></label><label>التعليمات<textarea value={instructions} onChange={(event) => setInstructions(event.target.value)} placeholder="ما الذي تريد من المساعد أن يبحث عنه أو يحلله؟" /></label><div className="modal-grid"><label>التكرار<select value={cadence} onChange={(event) => setCadence(event.target.value as typeof cadence)}><option value="daily">يوميًا</option><option value="weekly">أسبوعيًا</option><option value="manual">يدويًا فقط</option></select></label><label>وقت التشغيل<input type="time" value={runTime} onChange={(event) => setRunTime(event.target.value)} /></label></div><div className="modal-footer"><button className="outline-button" onClick={closeForm}>إلغاء</button><button className="primary-button" onClick={submit} disabled={createTask.isPending || updateTask.isPending}>{createTask.isPending || updateTask.isPending ? <><Loader2 size={15} className="spin" /> جارٍ الحفظ</> : <><Check size={15} /> حفظ المهمة</>}</button></div></div></div>}</>;
}

function PlayIcon() { return <span className="play-icon">▶</span>; }

function Discovery() {
  const query = trpc.discovery.list.useQuery();
  const settings = trpc.discovery.getSettings.useQuery();
  const [source, setSource] = useState<"hn_algolia" | "github">("hn_algolia");
  const [searchQuery, setSearchQuery] = useState("mobile apps indie games developer tools");
  const [localTime, setLocalTime] = useState("08:00");
  const [timezone, setTimezone] = useState("Asia/Dubai");
  useEffect(() => { if (!settings.data) return; setSource((settings.data.source as "hn_algolia" | "github") || "hn_algolia"); setSearchQuery(settings.data.query); setLocalTime(`${String(settings.data.localHour ?? 8).padStart(2, "0")}:${String(settings.data.localMinute ?? 0).padStart(2, "0")}`); setTimezone(settings.data.timezone || "Asia/Dubai"); }, [settings.data]);
  const refreshNow = trpc.discovery.refreshNow.useMutation({ onSuccess: (data) => { void query.refetch(); void settings.refetch(); toast.success(`تم جلب ${data.inserted} إشارة جديدة وتحديث ${data.updated}`); }, onError: (error) => toast.error(`تعذر جلب المصدر: ${error.message}`) });
  const configureSchedule = trpc.discovery.configureSchedule.useMutation({ onSuccess: (data) => { void settings.refetch(); toast.success(data.enabled ? `تم تفعيل المسح يوميًا الساعة ${localTime} (${timezone})` : "تم إيقاف المسح اليومي"); }, onError: (error) => toast.error(`تعذر إعداد الجدولة: ${error.message}`) });
  const create = trpc.discovery.create.useMutation({ onSuccess: () => { void query.refetch(); toast.success("تمت إضافة إشارة جديدة"); }, onError: (error) => toast.error(`تعذر الإضافة: ${error.message}`) });
  const update = trpc.discovery.update.useMutation({ onSuccess: () => { void query.refetch(); toast.success("تم تحديث حالة الإشارة"); }, onError: (error) => toast.error(`تعذر التحديث: ${error.message}`) });
  const remove = trpc.discovery.delete.useMutation({ onSuccess: () => { void query.refetch(); toast.success("تم حذف الإشارة"); }, onError: (error) => toast.error(`تعذر الحذف: ${error.message}`) });
  const signals = query.data ?? [];
  const addSignal = () => { const title = window.prompt("عنوان الإشارة الجديدة"); if (!title?.trim()) return; create.mutate({ title: title.trim(), type: "إشارة يدوية", score: 0, sourceCount: 0, description: "أضيفت يدويًا للمراجعة والتحقق.", verificationDays: 2, status: "new" }); };
  const refreshBusy = refreshNow.isPending || query.isFetching;
  const scheduleEnabled = Boolean(settings.data?.enabled && settings.data?.scheduleCronTaskUid);
  const saveSchedule = () => { const [hour, minute] = localTime.split(":").map(Number); configureSchedule.mutate({ source, query: searchQuery, enabled: true, localHour: hour, localMinute: minute, timezone }); };
  return <><div className="page-heading"><div><p className="eyebrow">{pageMeta.discovery.eyebrow}</p><h1>{pageMeta.discovery.title}</h1><p className="page-description">{pageMeta.discovery.description}</p></div><div className="page-actions"><button className="outline-button" onClick={() => refreshNow.mutate()} disabled={refreshBusy}><RefreshIcon /> {refreshBusy ? "جارٍ الجلب" : `جلب من ${source === "github" ? "GitHub" : "HN"}`}</button><button className="primary-button" onClick={addSignal} disabled={create.isPending}><Plus size={15} /> أضف يدويًا</button></div></div><section className="panel discovery-settings-card"><div className="panel-head"><div><p className="eyebrow">Daily source</p><h2>إعدادات المسح اليومي</h2></div><CalendarClock size={18} /></div><div className="settings-inline-grid"><label>مصدر البحث<select value={source} onChange={(event) => setSource(event.target.value as "hn_algolia" | "github")}><option value="hn_algolia">Hacker News Algolia</option><option value="github">GitHub Trending</option></select></label><label>عبارة البحث<input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} /></label><label>الوقت المحلي<input type="time" value={localTime} onChange={(event) => setLocalTime(event.target.value)} /></label><label>المنطقة الزمنية<select value={timezone} onChange={(event) => setTimezone(event.target.value)}><option value="Asia/Dubai">Asia/Dubai</option><option value="Africa/Cairo">Africa/Cairo</option><option value="Europe/London">Europe/London</option><option value="America/New_York">America/New_York</option><option value="UTC">UTC</option></select></label></div><div className="api-actions"><button className="primary-button small" onClick={saveSchedule} disabled={configureSchedule.isPending}>{configureSchedule.isPending ? <><Loader2 size={14} className="spin" /> جارٍ الحفظ</> : <><Check size={14} /> حفظ الجدولة</>}</button><button className="outline-button small" onClick={() => configureSchedule.mutate({ source, query: searchQuery, enabled: false, localHour: Number(localTime.split(":")[0]), localMinute: Number(localTime.split(":")[1]), timezone })} disabled={configureSchedule.isPending || !scheduleEnabled}><CalendarClock size={14} /> إيقاف المسح</button><span className="api-state">{scheduleEnabled ? `نشط · ${settings.data?.timezone} · ${String(settings.data?.localHour ?? 8).padStart(2, "0")}:${String(settings.data?.localMinute ?? 0).padStart(2, "0")}` : "غير نشط"}</span></div></section><div className="discovery-banner"><div className="banner-signal-rule" /><div><Pill tone="green">{query.isLoading ? "جارٍ التحميل" : "بيانات محفوظة"}</Pill><p className="briefing-label">MARKET BRIEF · PERSISTENT</p><h2>{query.isError ? "تعذر تحميل إشارات السوق." : signals.length ? `تم حفظ ${signals.length} إشارة قابلة للمراجعة.` : "لا توجد إشارات محفوظة بعد."}</h2><p>كل إشارة مملوكة لحسابك ويمكن تحديثها أو حذفها دون التأثير على السجل السابق.</p></div><div className="radar-visual"><div className="radar-ring r1" /><div className="radar-ring r2" /><div className="radar-core"><Radar size={24} /></div><i /><i /><i /></div></div><div className="section-title-row"><div><p className="eyebrow">Opportunity feed</p><h2>الفرص الأعلى اليوم</h2></div><button className="ghost-button" onClick={() => refreshNow.mutate()} disabled={refreshBusy}><RefreshIcon /> جلب من المصدر</button></div>{query.isLoading ? <div className="empty-state"><Loader2 size={28} className="spin" /><h3>جارٍ استعادة الإشارات...</h3></div> : query.isError ? <div className="empty-state"><AlertTriangle size={28} /><h3>تعذر تحميل Discovery</h3><button className="outline-button" onClick={() => void query.refetch()}>إعادة المحاولة</button></div> : signals.length === 0 ? <div className="empty-state"><Radar size={30} /><h3>ابدأ بإضافة أول إشارة</h3><p>يمكنك إدخال فرصة يدوية الآن، ثم ربط المسح الآلي لاحقًا بنفس السجل الدائم.</p><button className="primary-button small" onClick={addSignal}><Plus size={14} /> أضف إشارة</button></div> : <div className="opportunity-grid">{signals.map((signal) => <div className="opportunity-card" key={signal.id}><div className="opp-top"><Pill tone={signal.status === "reviewed" ? "green" : "amber"}>{signal.type}</Pill><span className="score amber">{signal.score}</span></div><h3>{signal.title}</h3><p>{signal.description ?? "لا يوجد وصف محفوظ بعد."}</p><div className="opp-meta"><span><Link2 size={13} /> {signal.sourceCount} مصادر</span><span><Clock3 size={13} /> تحقق خلال {signal.verificationDays} يوم</span></div><div className="opp-bottom"><button className="outline-button small" disabled={update.isPending} onClick={() => update.mutate({ id: signal.id, data: { status: signal.status === "reviewed" ? "new" : "reviewed" } })}>{signal.status === "reviewed" ? "إعادة للمراجعة" : "تمت المراجعة"}</button><button className="icon-button" aria-label="حذف الإشارة" disabled={remove.isPending} onClick={() => remove.mutate({ id: signal.id })}><X size={16} /></button></div></div>)}</div>}</>;
}
function RefreshIcon() { return <span className="refresh-icon">↻</span>; }

function Knowledge() {
  const query = trpc.knowledge.list.useQuery();
  const create = trpc.knowledge.create.useMutation({ onSuccess: () => { void query.refetch(); toast.success("تم حفظ قطعة المعرفة"); setTitle(""); setContent(""); setOpen(false); }, onError: error => toast.error(`تعذر الحفظ: ${error.message}`) });
  const remove = trpc.knowledge.delete.useMutation({ onSuccess: () => { void query.refetch(); toast.success("تم حذف قطعة المعرفة"); }, onError: error => toast.error(`تعذر الحذف: ${error.message}`) });
  const [open, setOpen] = useState(false); const [title, setTitle] = useState(""); const [content, setContent] = useState("");
  const items = query.data ?? [];
  return <><div className="page-heading"><div><p className="eyebrow">Knowledge Vault</p><h1>مخزن المعرفة</h1><p className="page-description">ملاحظات ومصادر دائمة مرتبطة بحسابك، لتبقى مرجعًا قابلًا للبحث بدل البيانات التجريبية.</p></div><button className="primary-button" onClick={() => setOpen(true)}><Plus size={16} /> قطعة معرفة جديدة</button></div>{query.isLoading ? <div className="empty-state"><Loader2 size={28} className="spin" /><h3>جارٍ تحميل المعرفة...</h3></div> : items.length === 0 ? <div className="empty-hero panel"><div className="empty-icon"><Database size={28} /></div><h2>مخزن المعرفة فارغ</h2><p>أضف أول ملاحظة أو مصدر ليصبح قابلًا للاسترجاع لاحقًا.</p><button className="primary-button" onClick={() => setOpen(true)}><Plus size={15} /> إضافة ملاحظة</button></div> : <section className="idea-list panel">{items.map(item => <div className="idea-row" key={item.id}><div className="idea-bullet slate"><Database size={17} /></div><div className="idea-body"><div className="idea-title"><h3>{item.title}</h3><Pill tone="slate">{item.kind}</Pill></div><p>{item.content || "بدون محتوى"}</p><small>{item.tags || "بدون وسوم"}{item.sourceUrl ? ` · ${item.sourceUrl}` : ""}</small></div><button className="icon-button" aria-label="حذف قطعة المعرفة" onClick={() => { if (window.confirm("حذف قطعة المعرفة؟")) remove.mutate({ id: item.id }); }}><X size={16} /></button></div>)}</section>}{open && <div className="modal-backdrop" onClick={() => setOpen(false)}><div className="modal-card" onClick={event => event.stopPropagation()}><div className="modal-head"><h2>إضافة قطعة معرفة</h2><button className="icon-button" aria-label="إغلاق" onClick={() => setOpen(false)}><X size={18} /></button></div><label>العنوان<input value={title} onChange={event => setTitle(event.target.value)} placeholder="عنوان الملاحظة أو المصدر" /></label><label>المحتوى<textarea value={content} onChange={event => setContent(event.target.value)} placeholder="اكتب المعرفة التي تريد الاحتفاظ بها..." /></label><div className="modal-footer"><button className="outline-button" onClick={() => setOpen(false)}>إلغاء</button><button className="primary-button" disabled={create.isPending || title.trim().length < 2} onClick={() => create.mutate({ title: title.trim(), kind: "ملاحظة", content: content.trim() })}>{create.isPending ? <><Loader2 size={15} className="spin" /> جارٍ الحفظ</> : <><Check size={15} /> حفظ</>}</button></div></div></div>}</>;
}

function Projects() {
  const projectsQuery = trpc.projects.list.useQuery();
  const createProject = trpc.projects.create.useMutation({ onSuccess: () => { void projectsQuery.refetch(); toast.success("تم إنشاء المشروع وحفظه"); }, onError: (error) => toast.error(`تعذر إنشاء المشروع: ${error.message}`) });
  const [title, setTitle] = useState("");
  const [type, setType] = useState("تطبيق موبايل");
  const [open, setOpen] = useState(false);
  const submit = () => { if (!title.trim()) return; createProject.mutate({ title: title.trim(), type, status: "فكرة", progress: 0, nextStep: "حدد الخطوة التالية" }); setTitle(""); setOpen(false); };
  const projects = projectsQuery.data ?? [];
  return <><div className="page-heading"><div><p className="eyebrow">{pageMeta.projects.eyebrow}</p><h1>{pageMeta.projects.title}</h1><p className="page-description">مشاريعك المحفوظة في قاعدة البيانات مع تقدم كل مشروع وخطوته التالية.</p></div><button className="primary-button" onClick={() => setOpen(true)}><Plus size={16} /> مشروع جديد</button></div>{projectsQuery.isLoading ? <div className="empty-state"><Loader2 size={28} className="spin" /><h3>جارٍ تحميل المشاريع...</h3></div> : projects.length === 0 ? <div className="empty-hero panel"><div className="empty-icon"><Database size={28} /></div><h2>لا توجد مشاريع محفوظة بعد</h2><p>أنشئ أول مشروع ليظهر هنا بدل البيانات التجريبية.</p><button className="primary-button" onClick={() => setOpen(true)}><Plus size={15} /> إنشاء أول مشروع</button></div> : <div className="project-board">{projects.map((project) => <div className="project-card" key={project.id}><div className="project-card-top"><div className="large-project-icon slate"><Database size={20} /></div><span className="score">{project.progress}%</span></div><Pill tone="slate">{project.status}</Pill><h3>{project.title}</h3><p>{project.type}</p><div className="project-card-progress"><div className="progress-track"><i style={{ width: `${project.progress}%` }} /></div><span>{project.progress}%</span></div><div className="project-next"><span>الخطوة التالية</span><strong>{project.nextStep || "لم تحدد بعد"}</strong></div></div>)}</div>}{open && <div className="modal-backdrop" onClick={() => setOpen(false)}><div className="modal-card" onClick={(event) => event.stopPropagation()}><div className="modal-head"><h2>إنشاء مشروع</h2><button className="icon-button" aria-label="إغلاق" onClick={() => setOpen(false)}><X size={18} /></button></div><label>اسم المشروع<input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="مثال: لعبة موبايل جديدة" /></label><label>النوع<select value={type} onChange={(event) => setType(event.target.value)}><option>تطبيق موبايل</option><option>لعبة موبايل</option><option>أداة</option></select></label><div className="modal-footer"><button className="outline-button" onClick={() => setOpen(false)}>إلغاء</button><button className="primary-button" disabled={createProject.isPending || title.trim().length < 2} onClick={submit}>{createProject.isPending ? <Loader2 size={15} className="spin" /> : <Check size={15} />} حفظ المشروع</button></div></div></div>}</>;
}

function Ideas() {
  const ideasQuery = trpc.ideas.list.useQuery();
  const createIdea = trpc.ideas.create.useMutation({ onSuccess: () => { void ideasQuery.refetch(); toast.success("تم حفظ الفكرة"); }, onError: (error) => toast.error(`تعذر حفظ الفكرة: ${error.message}`) });
  const [title, setTitle] = useState("");
  const [open, setOpen] = useState(false);
  const ideas = ideasQuery.data ?? [];
  return <><div className="page-heading"><div><p className="eyebrow">{pageMeta.ideas.eyebrow}</p><h1>{pageMeta.ideas.title}</h1><p className="page-description">أفكارك المحفوظة ودرجات ملاءمتها، مع إنشاء حقيقي داخل قاعدة البيانات.</p></div><button className="primary-button" onClick={() => setOpen(true)}><Plus size={16} /> فكرة جديدة</button></div>{ideasQuery.isLoading ? <div className="empty-state"><Loader2 size={28} className="spin" /><h3>جارٍ تحميل الأفكار...</h3></div> : ideas.length === 0 ? <div className="empty-hero panel"><div className="empty-icon"><Lightbulb size={28} /></div><h2>لا توجد أفكار محفوظة بعد</h2><p>أضف فكرة لتبدأ بناء مخزن معرفة حقيقي.</p><button className="primary-button" onClick={() => setOpen(true)}><Plus size={15} /> إضافة فكرة</button></div> : <section className="idea-list panel">{ideas.map((idea) => <div className="idea-row" key={idea.id}><div className="idea-bullet slate"><Lightbulb size={17} /></div><div className="idea-body"><div className="idea-title"><h3>{idea.title}</h3><Pill tone="slate">{idea.category}</Pill></div><p>{idea.description || "بدون وصف"}</p></div><div className="idea-score"><strong>{idea.score}</strong><span>ملاءمة</span></div><div className="idea-status"><span>{idea.status}</span><div className="mini-track"><i style={{ width: `${idea.score}%` }} /></div></div></div>)}</section>}{open && <div className="modal-backdrop" onClick={() => setOpen(false)}><div className="modal-card" onClick={(event) => event.stopPropagation()}><div className="modal-head"><h2>إضافة فكرة</h2><button className="icon-button" aria-label="إغلاق" onClick={() => setOpen(false)}><X size={18} /></button></div><label>عنوان الفكرة<input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="مثال: أداة للمطور المستقل" /></label><div className="modal-footer"><button className="outline-button" onClick={() => setOpen(false)}>إلغاء</button><button className="primary-button" disabled={createIdea.isPending || title.trim().length < 2} onClick={() => { createIdea.mutate({ title: title.trim(), category: "فكرة جديدة", status: "تحتاج تقييم", score: 0, version: "V1" }); setTitle(""); setOpen(false); }}>{createIdea.isPending ? <Loader2 size={15} className="spin" /> : <Check size={15} />} حفظ الفكرة</button></div></div></div>}</>;
}

function ProductToolsStrip({ go }: { go: (key: PageKey) => void }) { const tools = [{ key: "validation" as PageKey, icon: ClipboardCheck, title: "Validation Lab", desc: "اختبر الفكرة قبل البناء" }, { key: "briefs" as PageKey, icon: FileCode2, title: "Product Brief", desc: "جهّز ملف Claude Code" }, { key: "health" as PageKey, icon: HeartPulse, title: "Project Health", desc: "اعرف أين تتدخل الآن" }]; return <section className="product-tools-strip">{tools.map((tool) => <button key={tool.key} className="product-tool-card" onClick={() => go(tool.key)}><span className="tool-card-icon"><tool.icon size={18} /></span><span><strong>{tool.title}</strong><small>{tool.desc}</small></span><ArrowUpRight size={15} /></button>)}</section>; }

function ProjectHealthWidget({ go }: { go: (key: PageKey) => void }) {
  const { isAuthenticated } = useAuth();
  const statusQuery = trpc.github.status.useQuery(undefined, { enabled: isAuthenticated, retry: false });
  const demoProjects = [{ name: "Pocket Quest", health: 82, next: "تحليل جلسات اللاعب" }, { name: "Habit Loop", health: 61, next: "إنهاء نظام التذكيرات" }, { name: "Talkback AI", health: 38, next: "اختبار المشكلة" }];
  const github = statusQuery.data?.connected ? { name: statusQuery.data.repo, health: statusQuery.data.health, next: `${statusQuery.data.recentCommits} commits حديثة · ${statusQuery.data.openIssues} issues مفتوحة` } : null;
  useEffect(() => { const status = statusQuery.data; if (status?.connected && status.warning) toast(`تنبيه صحة المشروع: ${status.repo} أقل من الحد المحدد (${status.threshold}%)`); }, [statusQuery.data]);
  const projects = github ? [github, ...demoProjects.slice(0, 2)] : demoProjects;
  return <section className="panel health-widget"><div className="panel-head"><div><p className="eyebrow">Project Health Monitor</p><h2>صحة مشاريعك الآن</h2><span className="chart-note">{github ? "بيانات GitHub محدثة تلقائيًا" : "بيانات تجريبية — اربط GitHub من Settings"}</span></div><button className="ghost-button" onClick={() => go("health")}>التفاصيل <ArrowUpRight size={14} /></button></div><div className="health-widget-list">{projects.map((project) => <div className="health-widget-row" key={project.name}><div><strong>{project.name}</strong><span>{project.next}</span></div><div className="health-widget-meter"><i style={{ width: `${project.health}%` }} /></div><b>{project.health}%</b></div>)}</div>{statusQuery.isFetching && <div className="github-health-inline"><Loader2 size={13} className="spin" /> جارٍ تحديث بيانات GitHub</div>}</section>;
}

function ProjectHealth() { const projects = [{ name: "Pocket Quest", type: "لعبة", health: 82, trend: "صاعد", next: "تحليل جلسات اللاعب", tone: "green" }, { name: "Habit Loop", type: "تطبيق", health: 61, trend: "يحتاج انتباه", next: "إنهاء نظام التذكيرات", tone: "amber" }, { name: "Talkback AI", type: "تطبيق", health: 38, trend: "متوقف", next: "اختبار المشكلة", tone: "violet" }]; return <><div className="page-heading"><div><p className="eyebrow">{pageMeta.health.eyebrow}</p><h1>{pageMeta.health.title}</h1><p className="page-description">{pageMeta.health.description}</p></div><button className="outline-button" onClick={() => toast("تم تحديث مؤشرات المشاريع تجريبيًا")}><RefreshIcon /> تحديث المؤشرات</button></div><div className="health-summary"><StatCard icon={HeartPulse} label="متوسط صحة المشاريع" value="60%" note="من 3 مشاريع" accent="green" /><StatCard icon={AlertTriangle} label="تحتاج انتباهًا" value="01" note="قرار خلال 48 ساعة" accent="amber" /><StatCard icon={CheckCircle2} label="تجارب مكتملة" value="08" note="هذا الشهر" accent="blue" /></div><section className="health-grid">{projects.map((project) => <Card className="health-card" key={project.name}><div className="health-card-head"><div><p className="eyebrow">{project.type}</p><h2>{project.name}</h2></div><span className={`health-score ${project.tone}`}>{project.health}</span></div><div className="health-meter"><i style={{ width: `${project.health}%` }} /></div><div className="health-meta"><span>الاتجاه</span><strong>{project.trend}</strong></div><div className="health-next"><span>الخطوة التالية</span><strong>{project.next}</strong></div><button className="full-ghost" onClick={() => toast(`تم فتح لوحة ${project.name}`)}>فتح المشروع <ArrowUpRight size={14} /></button></Card>)}</section></>; }

function SimplePage({ page }: { page: PageKey }) { const meta = pageMeta[page]; const PageIcon = page === "telegram" ? MessageCircle : page === "competitors" ? Target : Database; return <><div className="page-heading"><div><p className="eyebrow">{meta.eyebrow}</p><h1>{meta.title}</h1><p className="page-description">{meta.description}</p></div><button className="outline-button" onClick={() => toast("هذه الشاشة تجريبية في الـ Prototype") }><Command size={15} /> إجراءات سريعة</button></div><div className="empty-hero panel"><div className="empty-icon"><PageIcon size={28} /></div><h2>{page === "telegram" ? "اربط Telegram عندما تكون جاهزًا" : page === "competitors" ? "خريطة المنافسين ستتسع مع كل مسح" : "معرفتك في مكان واحد"}</h2><p>هذه شاشة تمهيدية داخل الـ Prototype لتصور المكان النهائي. ستتصل بالبيانات الحقيقية عند بدء مرحلة التنفيذ.</p><button className="primary-button" onClick={() => toast("تم تسجيل اهتمامك بهذه الوحدة") }><Sparkles size={15} /> جرّب التفاعل</button></div></> }

export default function Home() {
  const { user, loading, error, isAuthenticated, logout, refresh } = useAuth();

  const [active, setActive] = useState<PageKey>(() => { const requested = new URLSearchParams(window.location.search).get("page") as PageKey | null; return requested && requested in pageMeta ? requested : "overview"; });
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const userName = user?.name || "مطور مستقل";
  const content = useMemo(() => { if (active === "overview") return <Overview go={setActive} />; if (active === "tasks") return <Tasks />; if (active === "discovery") return <Discovery />; if (active === "ideas") return <Ideas />; if (active === "projects") return <Projects />; if (active === "settings") return <LazyPage label="جارٍ تحميل الإعدادات..."><SettingsPage userName={userName} onProfileUpdated={() => { void refresh(); }} logout={logout} /></LazyPage>; if (active === "knowledge") return <Knowledge />; if (active === "validation") return <LazyPage label="جارٍ تحميل أداة التحقق..."><HeavyToolPages page="validation" /></LazyPage>; if (active === "briefs") return <LazyPage label="جارٍ تحميل Product Brief..."><HeavyToolPages page="briefs" /></LazyPage>; if (active === "health") return <ProjectHealth />; if (active === "competitors") return <LazyPage label="جارٍ تحميل المنافسين..."><CompetitorsPage /></LazyPage>; return <SimplePage page={active} />; }, [active, tasks, userName, logout]);
  if (loading) return <div className="app-loading" role="status" aria-live="polite"><Loader2 size={24} className="spin" /><span>جارٍ التحقق من الجلسة...</span></div>;
  if (error) return <div className="app-loading" role="alert"><AlertTriangle size={24} /><span>تعذر التحقق من الجلسة. أعد تحميل الصفحة ثم حاول مجددًا.</span></div>;
  if (!isAuthenticated) return <LoginPage />;
  return <AppShell active={active} setActive={setActive} userName={userName} logout={logout}>{content}<footer className="prototype-footer"><span><CircleDot size={12} /> Venture OS · بياناتك محفوظة في حسابك</span><span>Personal AI Venture OS <span className="footer-divider">·</span> v1 foundation</span></footer></AppShell>;
}
