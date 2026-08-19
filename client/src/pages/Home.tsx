// Design philosophy: Signal Atelier — a calm editorial intelligence desk, with shadcn-style density, warm paper surfaces, ink navy type, cobalt analysis, and amber opportunity signals.
// Prototype-only screen: all AI, Telegram, and task results are illustrative local state; no real integrations are connected.
import { useMemo, useState } from "react";
import {
  Activity,
  Archive,
  ArrowUpRight,
  Bell,
  Bot,
  BrainCircuit,
  CalendarClock,
  Check,
  ChevronDown,
  CircleDot,
  Clock3,
  Command,
  Compass,
  Database,
  ExternalLink,
  FileText,
  Filter,
  Gamepad2,
  GitBranch,
  Globe2,
  Inbox,
  Layers3,
  Lightbulb,
  Link2,
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
import { useTheme } from "@/contexts/ThemeContext";

type PageKey = "overview" | "tasks" | "discovery" | "ideas" | "projects" | "knowledge" | "competitors" | "telegram" | "settings";
type Task = { id: number; name: string; desc: string; cadence: string; status: "نشطة" | "متوقفة"; last: string; next: string; icon: typeof Radar; tone: string };

const navGroups = [
  { label: "المساحة", items: [{ key: "overview", label: "نظرة عامة", icon: Activity }, { key: "discovery", label: "الاكتشاف اليومي", icon: Radar }, { key: "ideas", label: "مختبر الأفكار", icon: Lightbulb }, { key: "projects", label: "المشاريع", icon: Layers3 }] },
  { label: "المعرفة", items: [{ key: "knowledge", label: "مخزن المعرفة", icon: Database }, { key: "competitors", label: "المنافسون", icon: Target }] },
  { label: "الأتمتة", items: [{ key: "tasks", label: "مهام الذكاء الاصطناعي", icon: Bot }, { key: "telegram", label: "Telegram", icon: MessageCircle }] },
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

function AppShell({ active, setActive, children }: { active: PageKey; setActive: (key: PageKey) => void; children: React.ReactNode }) {
  const { theme, toggleTheme } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);
  return <div className="app-shell" dir="rtl">
    <aside className={`sidebar ${mobileOpen ? "mobile-open" : ""}`}>
      <div className="brand-row">
        <div className="brand-mark"><img src="/manus-storage/venture-os-mark_cc2bdbe7.png" alt="" /></div>
        <div><strong>Venture OS</strong><span>مختبرك الشخصي</span></div>
        <button className="icon-button sidebar-close" onClick={() => setMobileOpen(false)}><X size={17} /></button>
      </div>
      <div className="workspace-switch"><div className="avatar">م</div><div><strong>مساحتي الشخصية</strong><span>Private workspace</span></div><ChevronDown size={15} /></div>
      <nav className="side-nav">
        {navGroups.map((group) => <div className="nav-group" key={group.label}><span className="nav-label">{group.label}</span>{group.items.map((item) => <button key={item.key} className={`nav-item ${active === item.key ? "active" : ""}`} onClick={() => { setActive(item.key as PageKey); setMobileOpen(false); }}><item.icon size={17} strokeWidth={active === item.key ? 2.1 : 1.7} /><span>{item.label}</span>{item.key === "tasks" && <b className="nav-count">3</b>}</button>)}</div>)}
      </nav>
      <div className="sidebar-bottom"><div className="sidebar-status"><span className="live-dot" /><div><strong>المساعد متصل</strong><span>آخر مزامنة منذ 3 د</span></div></div><button className={`nav-item ${active === "settings" ? "active" : ""}`} onClick={() => { setActive("settings"); setMobileOpen(false); }}><Settings2 size={17} /><span>الإعدادات</span></button></div>
    </aside>
    <main className="main-shell">
      <header className="topbar"><button className="mobile-menu icon-button" onClick={() => setMobileOpen(true)}><Menu size={19} /></button><div className="breadcrumbs"><span>Venture OS</span><span>/</span><strong>{pageMeta[active].title}</strong></div><div className="top-actions"><button className="search-trigger" onClick={() => toast("البحث الذكي — سيبحث داخل معرفتك عند تفعيل المنصة")}><Search size={16} /><span>ابحث في مساحتك</span><kbd>⌘ K</kbd></button><button className="icon-button" onClick={() => toast("لا توجد تنبيهات جديدة") }><Bell size={18} /><i className="notification-dot" /></button><button className="icon-button" onClick={toggleTheme}>{theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}</button><div className="top-avatar">م</div></div></header>
      <div className="page-content">{children}</div>
    </main>
  </div>;
}

function Overview({ go }: { go: (key: PageKey) => void }) {
  return <>
    <div className="page-heading"><div><p className="eyebrow">{pageMeta.overview.eyebrow}</p><h1>{pageMeta.overview.title}</h1><p className="page-description">{pageMeta.overview.description}</p></div><button className="primary-button" onClick={() => go("discovery")}><Radar size={16} /> افتح تقرير اليوم <ArrowUpRight size={15} /></button></div>
    <div className="stats-grid"><StatCard icon={Lightbulb} label="أفكار تحتاج قرارًا" value="04" note="+2 منذ آخر مراجعة" accent="amber" /><StatCard icon={Layers3} label="مشاريع قيد الحركة" value="03" note="واحد قريب من الإطلاق" accent="blue" /><StatCard icon={TrendingUp} label="إشارات جديدة" value="12" note="من مسح اليوم" accent="green" /><StatCard icon={TimerReset} label="وقت تم توفيره" value="6.4h" note="هذا الأسبوع" accent="violet" /></div>
    <div className="dashboard-grid">
      <section className="panel discovery-panel"><div className="signal-rule" /><div className="report-stamp"><span>تقرير بحثي شخصي</span><b>V.06 · 19 AUG 2026</b></div><div className="panel-head"><div><p className="eyebrow">Daily Discovery · 08:00</p><h2>تقرير الاكتشاف اليومي</h2></div><button className="ghost-button" onClick={() => go("discovery")}>عرض التقرير <ArrowUpRight size={14} /></button></div><div className="discovery-feature"><div className="discovery-art"><img src="/manus-storage/daily-discovery-illustration_d91bd052.png" alt="رسم توضيحي للاكتشاف اليومي" /></div><div className="feature-copy"><Pill tone="amber">فرصة قوية · 86/100</Pill><h3>أداة موبايل تساعد صناع المحتوى على إعادة تدوير أفكارهم إلى سلسلة منشورات.</h3><p>إشارة متكررة في مجتمعات المبدعين، مع فجوة واضحة في تجربة الهاتف وسرعة تحويل الملاحظة إلى خطة محتوى.</p><div className="source-row"><span><Globe2 size={13} /> 8 مصادر</span><span><Target size={13} /> 3 منافسين</span><span><Clock3 size={13} /> تحقق أولي: 2 يوم</span></div><div className="feature-actions"><button className="primary-button small" onClick={() => toast("تم حفظ نسخة جديدة للفكرة") }><Plus size={14} /> احفظ كفكرة</button><button className="outline-button small" onClick={() => toast("تم فتح مصادر التقرير التجريبية") }><ExternalLink size={14} /> المصادر</button></div></div></div></section>
      <section className="panel next-panel"><div className="panel-head"><div><p className="eyebrow">Focus</p><h2>ماذا الآن؟</h2></div><button className="icon-button"><MoreHorizontal size={17} /></button></div><div className="focus-item active"><div className="focus-marker"><Zap size={15} /></div><div><strong>اختبر افتراض الجمهور</strong><p>اسأل 5 صناع محتوى عن سير العمل الحالي.</p><span>20 دقيقة · اليوم</span></div></div><div className="focus-item"><div className="focus-marker muted"><GitBranch size={15} /></div><div><strong>راجع نسخة Habit Loop</strong><p>التقرير الأسبوعي ينتظر قرارك.</p><span>45 دقيقة · غدًا</span></div></div><div className="focus-item"><div className="focus-marker muted"><FileText size={15} /></div><div><strong>حوّل الإشارة إلى PRD</strong><p>الفرصة الجديدة جاهزة للتوثيق.</p><span>30 دقيقة · الخميس</span></div></div><button className="full-ghost" onClick={() => go("projects")}>عرض كل الأولويات <ArrowUpRight size={14} /></button></section>
    </div>
    <div className="lower-grid"><section className="panel activity-panel"><div className="panel-head"><div><p className="eyebrow">Activity</p><h2>آخر ما تحرك</h2></div><button className="ghost-button" onClick={() => go("knowledge")}>كل السجل <ArrowUpRight size={14} /></button></div><div className="timeline"><div className="timeline-item"><div className="timeline-icon amber"><Sparkles size={15} /></div><div><strong>تم إنشاء نسخة جديدة من «تطبيق المصروفات»</strong><p>بناءً على 6 إشارات سوقية جديدة</p></div><time>منذ 3 س</time></div><div className="timeline-item"><div className="timeline-icon blue"><Bot size={15} /></div><div><strong>اكتملت مهمة «مراقبة منافسي الإنتاجية»</strong><p>تقرير من 14 مصدرًا · 3 منافسين جدد</p></div><time>أمس</time></div><div className="timeline-item"><div className="timeline-icon green"><Check size={15} /></div><div><strong>تم تحديث حالة Habit Loop</strong><p>من «تطوير» إلى «اختبار مغلق»</p></div><time>أمس</time></div></div></section><section className="panel projects-mini"><div className="panel-head"><div><p className="eyebrow">Projects</p><h2>مشاريعك الآن</h2></div><button className="icon-button" onClick={() => go("projects")}><ArrowUpRight size={16} /></button></div><ProjectRow icon={Gamepad2} title="Pocket Quest" meta="لعبة · اختبار مغلق" progress={72} tone="amber" /><ProjectRow icon={Target} title="Habit Loop" meta="تطبيق · تطوير" progress={48} tone="blue" /><ProjectRow icon={MessageCircle} title="Talkback AI" meta="تطبيق · فكرة" progress={14} tone="violet" /></section></div>
  </>;
}

function ProjectRow({ icon: Icon, title, meta, progress, tone }: { icon: typeof Gamepad2; title: string; meta: string; progress: number; tone: string }) { return <div className="project-row"><div className={`project-icon ${tone}`}><Icon size={17} /></div><div className="project-info"><strong>{title}</strong><span>{meta}</span></div><div className="project-progress"><div className="progress-track"><i style={{ width: `${progress}%` }} /></div><span>{progress}%</span></div></div>; }

function Tasks({ tasks, setTasks }: { tasks: Task[]; setTasks: React.Dispatch<React.SetStateAction<Task[]>> }) {
  const [open, setOpen] = useState(false);
  const [draftName, setDraftName] = useState("");
  const toggleTask = (id: number) => setTasks((items) => items.map((task) => task.id === id ? { ...task, status: task.status === "نشطة" ? "متوقفة" : "نشطة" } : task));
  const addTask = () => { if (!draftName.trim()) return; setTasks((items) => [...items, { id: Date.now(), name: draftName, desc: "مهمة جديدة — إعداد تجريبي", cadence: "يوميًا · 10:00", status: "نشطة", last: "لم تعمل بعد", next: "غدًا، 10:00", icon: Bot, tone: "blue" }]); setDraftName(""); setOpen(false); toast("تمت إضافة المهمة التجريبية"); };
  return <><div className="page-heading"><div><p className="eyebrow">{pageMeta.tasks.eyebrow}</p><h1>{pageMeta.tasks.title}</h1><p className="page-description">{pageMeta.tasks.description}</p></div><button className="primary-button" onClick={() => setOpen(true)}><Plus size={16} /> مهمة جديدة</button></div><div className="task-summary"><div><span>المهام النشطة</span><strong>{tasks.filter((t) => t.status === "نشطة").length}</strong></div><div><span>اكتملت اليوم</span><strong>02</strong></div><div><span>الوقت القادم</span><strong>غدًا 08:00</strong></div><div className="task-summary-note"><Sparkles size={16} /><span>كل نتيجة تحفظ كسجل مستقل ولا تستبدل القديم.</span></div></div><section className="panel tasks-panel"><div className="table-toolbar"><div className="toolbar-title"><h2>كل المهام</h2><span>{tasks.length} مهام</span></div><div className="toolbar-actions"><button className="outline-button small"><Filter size={14} /> تصفية</button><button className="outline-button small"><Archive size={14} /> المؤرشفة</button></div></div><div className="task-table">{tasks.map((task) => <div className="task-row" key={task.id}><div className={`task-icon ${task.tone}`}><task.icon size={17} /></div><div className="task-main"><strong>{task.name}</strong><span>{task.desc}</span></div><div className="task-cadence"><CalendarClock size={14} /><span>{task.cadence}</span></div><div className="task-run"><span>آخر تشغيل</span><strong>{task.last}</strong></div><div className="task-next"><span>التالي</span><strong>{task.next}</strong></div><div><Pill tone={task.status === "نشطة" ? "green" : "slate"}>{task.status}</Pill></div><div className="row-actions"><button className="icon-button" onClick={() => toggleTask(task.id)} title="إيقاف أو استئناف"><TimerReset size={16} /></button><button className="icon-button" onClick={() => toast("تم تشغيل المهمة تجريبيًا") } title="تشغيل الآن"><PlayIcon /></button><button className="icon-button" onClick={() => setTasks((items) => items.filter((item) => item.id !== task.id))} title="حذف"><X size={16} /></button></div></div>)}</div></section>{open && <div className="modal-backdrop" onClick={() => setOpen(false)}><div className="modal-card" onClick={(e) => e.stopPropagation()}><div className="modal-head"><div><p className="eyebrow">New AI Task</p><h2>أنشئ مهمة جديدة</h2></div><button className="icon-button" onClick={() => setOpen(false)}><X size={18} /></button></div><label>اسم المهمة<input value={draftName} onChange={(e) => setDraftName(e.target.value)} placeholder="مثال: راقب ألعاب الأطفال التعليمية" autoFocus /></label><label>التعليمات الأولية<textarea placeholder="ما الذي تريد من المساعد أن يبحث عنه أو يفعله؟" /></label><div className="modal-grid"><label>التكرار<select defaultValue="daily"><option value="daily">يوميًا</option><option value="weekly">أسبوعيًا</option><option value="manual">يدويًا فقط</option></select></label><label>وقت التشغيل<select defaultValue="10"><option value="08">08:00</option><option value="10">10:00</option><option value="18">18:00</option></select></label></div><div className="modal-footer"><button className="outline-button" onClick={() => setOpen(false)}>إلغاء</button><button className="primary-button" onClick={addTask}><Check size={15} /> حفظ المهمة</button></div></div></div>}</>;
}

function PlayIcon() { return <span className="play-icon">▶</span>; }

function Discovery() { const signals = [{ score: 86, title: "مساعد إعادة تدوير أفكار المحتوى", type: "تطبيق · فرصة جديدة", sources: "8 مصادر", tone: "amber" }, { score: 78, title: "لعبة عادات قصيرة للجلسات اليومية", type: "لعبة · تطوير محتمل", sources: "11 مصدرًا", tone: "blue" }, { score: 72, title: "أداة متابعة تحديات المطورين المستقلين", type: "تطبيق · إشارة مبكرة", sources: "5 مصادر", tone: "violet" }]; return <><div className="page-heading"><div><p className="eyebrow">{pageMeta.discovery.eyebrow}</p><h1>{pageMeta.discovery.title}</h1><p className="page-description">{pageMeta.discovery.description}</p></div><button className="outline-button" onClick={() => toast("سيتم تشغيل مسح جديد عند تفعيل التكامل") }><RefreshIcon /> شغّل مسحًا جديدًا</button></div><div className="discovery-banner"><div className="banner-signal-rule" /><div><Pill tone="green">اكتمل بنجاح</Pill><p className="briefing-label">MARKET BRIEF · 08:00</p><h2>تم تحليل 42 إشارة من السوق هذا الصباح.</h2><p>تمت إضافة 3 فرص جديدة، وتحديث 4 أفكار محفوظة، ورصد منافسين اثنين.</p></div><div className="radar-visual"><div className="radar-ring r1" /><div className="radar-ring r2" /><div className="radar-core"><Radar size={24} /></div><i /><i /><i /></div></div><div className="section-title-row"><div><p className="eyebrow">Opportunity feed</p><h2>الفرص الأعلى اليوم</h2></div><button className="ghost-button"><Filter size={14} /> كل الفلاتر</button></div><div className="opportunity-grid">{signals.map((signal) => <div className="opportunity-card" key={signal.title}><div className="opp-top"><Pill tone={signal.tone}>{signal.type}</Pill><span className={`score ${signal.tone}`}>{signal.score}</span></div><h3>{signal.title}</h3><p>تتقاطع مع مهاراتك في بناء تطبيقات الموبايل، ويمكن اختبارها بنموذج أولي واضح قبل التوسع.</p><div className="opp-meta"><span><Link2 size={13} /> {signal.sources}</span><span><Clock3 size={13} /> تحقق خلال 2 يوم</span></div><div className="opp-bottom"><button className="outline-button small" onClick={() => toast("تم فتح تفاصيل الفرصة التجريبية")}>التفاصيل</button><button className="icon-button"><MoreHorizontal size={16} /></button></div></div>)}</div></> }
function RefreshIcon() { return <span className="refresh-icon">↻</span>; }

function Ideas() { return <><div className="page-heading"><div><p className="eyebrow">{pageMeta.ideas.eyebrow}</p><h1>{pageMeta.ideas.title}</h1><p className="page-description">{pageMeta.ideas.description}</p></div><button className="primary-button" onClick={() => toast("سيتم فتح مولد الأفكار عند تفعيل الذكاء الاصطناعي") }><Sparkles size={16} /> ولّد فكرة</button></div><div className="idea-tabs"><button className="active">كل الأفكار <span>17</span></button><button>تحتاج قرارًا <span>4</span></button><button>مؤجلة <span>6</span></button><button>تم اختبارها <span>7</span></button></div><section className="idea-list panel">{[{ title: "مساعد إعادة تدوير أفكار المحتوى", tag: "فرصة جديدة", score: "86", version: "V3", status: "تحتاج اختبار", tone: "amber" }, { title: "Pocket Quest — موسم المهام اليومية", tag: "تطوير مشروع", score: "81", version: "V7", status: "قيد التنفيذ", tone: "blue" }, { title: "مدير مصروفات للمستقلين", tag: "فكرة محفوظة", score: "69", version: "V1", status: "مؤجلة", tone: "slate" }].map((idea) => <div className="idea-row" key={idea.title}><div className={`idea-bullet ${idea.tone}`}><Lightbulb size={17} /></div><div className="idea-body"><div className="idea-title"><h3>{idea.title}</h3><Pill tone={idea.tone}>{idea.tag}</Pill></div><p>نسخة {idea.version} · آخر تحديث من مهمة الاكتشاف اليومية · لديها فرضية تحتاج تحققًا.</p></div><div className="idea-score"><strong>{idea.score}</strong><span>ملاءمة</span></div><div className="idea-status"><span>{idea.status}</span><div className="mini-track"><i style={{ width: `${Number(idea.score) - 10}%` }} /></div></div><button className="icon-button"><ArrowUpRight size={16} /></button></div>)}</section></> }

function Projects() { return <><div className="page-heading"><div><p className="eyebrow">{pageMeta.projects.eyebrow}</p><h1>{pageMeta.projects.title}</h1><p className="page-description">{pageMeta.projects.description}</p></div><button className="primary-button" onClick={() => toast("إنشاء مشروع جديد — نموذج تجريبي") }><Plus size={16} /> مشروع جديد</button></div><div className="project-board">{[{ title: "Pocket Quest", type: "لعبة موبايل", status: "اختبار مغلق", tone: "amber", progress: 72, icon: Gamepad2, next: "تحليل جلسات اللاعب" }, { title: "Habit Loop", type: "تطبيق إنتاجية", status: "تطوير", tone: "blue", progress: 48, icon: Target, next: "إنهاء نظام التذكيرات" }, { title: "Talkback AI", type: "تطبيق اجتماعي", status: "فكرة", tone: "violet", progress: 14, icon: MessageCircle, next: "اختبار المشكلة" }, { title: "Pocket Ledger", type: "أداة مالية", status: "متوقف مؤقتًا", tone: "slate", progress: 31, icon: Database, next: "مراجعة فرضية العميل" }].map((project) => <div className="project-card" key={project.title}><div className="project-card-top"><div className={`large-project-icon ${project.tone}`}><project.icon size={20} /></div><button className="icon-button"><MoreHorizontal size={16} /></button></div><Pill tone={project.tone}>{project.status}</Pill><h3>{project.title}</h3><p>{project.type}</p><div className="project-card-progress"><div className="progress-track"><i style={{ width: `${project.progress}%` }} /></div><span>{project.progress}%</span></div><div className="project-next"><span>الخطوة التالية</span><strong>{project.next}</strong></div></div>)}</div></> }

function SettingsPage({ userName, setUserName, password, setPassword, logout }: { userName: string; setUserName: (value: string) => void; password: string; setPassword: (value: string) => void; logout: () => void }) { const [nameDraft, setNameDraft] = useState(userName); const [passwordDraft, setPasswordDraft] = useState(password); return <><div className="page-heading"><div><p className="eyebrow">{pageMeta.settings.eyebrow}</p><h1>{pageMeta.settings.title}</h1><p className="page-description">{pageMeta.settings.description}</p></div><button className="outline-button" onClick={logout}><UserRound size={15} /> تسجيل الخروج</button></div><div className="settings-grid"><section className="panel settings-card"><div className="panel-head"><div><p className="eyebrow">Profile</p><h2>بيانات المستخدم</h2></div><div className="settings-icon"><UserRound size={18} /></div></div><label>اسم المستخدم<input value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} /></label><label>وصف قصير<textarea defaultValue="مطور تطبيقات وألعاب موبايل" /></label><button className="primary-button small" onClick={() => { setUserName(nameDraft); toast("تم حفظ بيانات المستخدم تجريبيًا") }}><Check size={14} /> حفظ البيانات</button></section><section className="panel settings-card"><div className="panel-head"><div><p className="eyebrow">Security</p><h2>كلمة المرور</h2></div><div className="settings-icon"><Settings2 size={18} /></div></div><p className="settings-note">الدخول في هذا الـ Prototype يعتمد على كلمة مرور فقط. في النسخة الحقيقية سيتم حفظها بشكل آمن داخل Backend.</p><label>كلمة المرور الجديدة<input type="password" value={passwordDraft} onChange={(e) => setPasswordDraft(e.target.value)} /></label><button className="primary-button small" onClick={() => { setPassword(passwordDraft); toast("تم تغيير كلمة المرور تجريبيًا") }}><Check size={14} /> تحديث كلمة المرور</button></section></div></> }

function SimplePage({ page }: { page: PageKey }) { const meta = pageMeta[page]; const PageIcon = page === "telegram" ? MessageCircle : page === "competitors" ? Target : Database; return <><div className="page-heading"><div><p className="eyebrow">{meta.eyebrow}</p><h1>{meta.title}</h1><p className="page-description">{meta.description}</p></div><button className="outline-button" onClick={() => toast("هذه الشاشة تجريبية في الـ Prototype") }><Command size={15} /> إجراءات سريعة</button></div><div className="empty-hero panel"><div className="empty-icon"><PageIcon size={28} /></div><h2>{page === "telegram" ? "اربط Telegram عندما تكون جاهزًا" : page === "competitors" ? "خريطة المنافسين ستتسع مع كل مسح" : "معرفتك في مكان واحد"}</h2><p>هذه شاشة تمهيدية داخل الـ Prototype لتصور المكان النهائي. ستتصل بالبيانات الحقيقية عند بدء مرحلة التنفيذ.</p><button className="primary-button" onClick={() => toast("تم تسجيل اهتمامك بهذه الوحدة") }><Sparkles size={15} /> جرّب التفاعل</button></div></> }

function LoginScreen({ onLogin }: { onLogin: (password: string) => boolean }) { const [value, setValue] = useState(""); const [error, setError] = useState(""); const submit = (event: React.FormEvent) => { event.preventDefault(); if (!onLogin(value)) setError("كلمة المرور غير صحيحة"); }; return <div className="login-screen" dir="rtl"><div className="login-orbit" /><div className="login-card"><div className="login-logo"><img src="/manus-storage/venture-os-mark_cc2bdbe7.png" alt="" /></div><p className="eyebrow">Personal AI Venture OS</p><h1>مساحتك تبدأ من هنا.</h1><p>أدخل كلمة المرور للوصول إلى مختبر الأفكار والمشاريع.</p><form onSubmit={submit}><label>كلمة المرور<input type="password" value={value} onChange={(e) => { setValue(e.target.value); setError(""); }} placeholder="••••••••" autoFocus /></label>{error && <span className="login-error">{error}</span>}<button className="primary-button" type="submit"><ArrowUpRight size={15} /> دخول إلى المساحة</button></form><small>Prototype · كلمة المرور الافتراضية: 1234</small></div></div> }

export default function Home() {
  const [active, setActive] = useState<PageKey>("overview");
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState("1234");
  const [userName, setUserName] = useState("مطور مستقل");
  const content = useMemo(() => { if (active === "overview") return <Overview go={setActive} />; if (active === "tasks") return <Tasks tasks={tasks} setTasks={setTasks} />; if (active === "discovery") return <Discovery />; if (active === "ideas") return <Ideas />; if (active === "projects") return <Projects />; if (active === "settings") return <SettingsPage userName={userName} setUserName={setUserName} password={password} setPassword={setPassword} logout={() => setAuthenticated(false)} />; return <SimplePage page={active} />; }, [active, tasks, password, userName]);
  if (!authenticated) return <LoginScreen onLogin={(value) => { if (value === password) { setAuthenticated(true); return true; } return false; }} />;
  return <AppShell active={active} setActive={setActive}>{content}<footer className="prototype-footer"><span><CircleDot size={12} /> Prototype · بيانات تجريبية فقط</span><span>Personal AI Venture OS <span className="footer-divider">·</span> v0.2</span></footer></AppShell>;
}
