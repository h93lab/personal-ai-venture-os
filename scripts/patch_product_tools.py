from pathlib import Path
import re

path = Path('/home/ubuntu/personal-ai-venture-os/client/src/pages/Home.tsx')
text = path.read_text()

new_product_brief = r'''function ProductBrief() {
  const [idea, setIdea] = useState("مساعد إعادة تدوير أفكار المحتوى");
  const [productType, setProductType] = useState("تطبيق موبايل");
  const [focus, setFocus] = useState("ابنِ نسخة أولى صغيرة، واضحة، قابلة للقياس، مع اختبارات أساسية.");
  const [generated, setGenerated] = useState(false);
  const brief = useMemo(() => ({
    problem: `المستخدمون يحتاجون حلًا واضحًا لمشكلة مرتبطة بـ ${idea || "الفكرة"} دون تعقيد تجربة البداية.`,
    scope: `نسخة MVP من ${productType} تركز على الوظيفة الأساسية، مع قياس الاستخدام والاستعداد للدفع.`,
    screens: "Onboarding، الشاشة الرئيسية، التدفق الأساسي، الإعدادات، وحالة النجاح أو الخطأ.",
    stories: "كمستخدم أريد إكمال المهمة الأساسية بسرعة، وكمطور أريد قياس الاستخدام ومعرفة أين يتوقف المستخدم.",
    data: "Users، Projects، Events، Feedback، وSettings مع علاقات بسيطة قابلة للتوسع.",
    acceptance: "المسار الأساسي يعمل من البداية للنهاية، البيانات تحفظ، الحالات الفارغة والأخطاء واضحة، وتوجد اختبارات للوظيفة الأساسية.",
    focus,
  }), [idea, productType, focus]);
  const briefRows = [["الفكرة", idea], ["النوع", productType], ["المشكلة", brief.problem], ["النطاق", brief.scope], ["الشاشات", brief.screens], ["User Stories", brief.stories], ["Data Model", brief.data], ["Acceptance Criteria", brief.acceptance]];
  const context = `# ${idea}\n\n## Product Brief\n\n### Problem\n${brief.problem}\n\n### Scope\n${brief.scope}\n\n### Screens\n${brief.screens}\n\n### User Stories\n${brief.stories}\n\n### Data Model\n${brief.data}\n\n### Acceptance Criteria\n${brief.acceptance}\n\n### Implementation Focus\n${brief.focus}`;
  return <><div className="page-heading"><div><p className="eyebrow">{pageMeta.briefs.eyebrow}</p><h1>{pageMeta.briefs.title}</h1><p className="page-description">{pageMeta.briefs.description}</p></div><div className="page-actions"><button className="outline-button small" onClick={() => printPdf("Product Brief — Venture OS", ["القسم", "المحتوى"], briefRows)}><ExternalLink size={14} /> PDF</button><button className="primary-button" onClick={() => { setGenerated(true); toast("تم إنشاء Product Brief من مدخلاتك"); }}><Sparkles size={16} /> ولّد الوثيقة</button></div></div><div className="brief-layout"><section className="panel tool-form-card"><div className="panel-head"><div><p className="eyebrow">Input</p><h2>من الفكرة إلى المنتج</h2></div><FileCode2 size={20} /></div><label>اسم الفكرة<input value={idea} onChange={(e) => { setIdea(e.target.value); setGenerated(false); }} /></label><label>نوع المنتج<select value={productType} onChange={(e) => { setProductType(e.target.value); setGenerated(false); }}><option>تطبيق موبايل</option><option>لعبة موبايل</option><option>منتج رقمي</option></select></label><label>تركيز Claude Code<textarea value={focus} onChange={(e) => { setFocus(e.target.value); setGenerated(false); }} /></label><button className="primary-button" onClick={() => { setGenerated(true); toast("تم تجهيز ملف سياق منظم"); }}><FileCode2 size={15} /> إنشاء ملف السياق</button></section><section className="panel brief-preview"><div className="brief-document-head"><span className="document-mark">V</span><div><strong>VENTURE OS / PRODUCT BRIEF</strong><small>مخرجات منظمة جاهزة للنسخ إلى Claude Code</small></div></div>{generated ? <div className="brief-document"><h2>{idea}</h2>{[["01", "المشكلة والفرصة", brief.problem], ["02", "نطاق النسخة الأولى", brief.scope], ["03", "الشاشات", brief.screens], ["04", "User Stories", brief.stories], ["05", "Data Model", brief.data], ["06", "Acceptance Criteria", brief.acceptance]].map(([number, title, body]) => <div className="brief-section" key={number}><span>{number}</span><div><strong>{title}</strong><p>{body}</p></div></div>)}<div className="brief-actions"><button className="outline-button" onClick={() => { navigator.clipboard?.writeText(context); toast("تم نسخ Product Brief كاملًا"); }}><FileCode2 size={14} /> نسخ السياق الكامل</button><button className="outline-button" onClick={() => downloadCsv("product-brief.csv", ["القسم", "المحتوى"], briefRows)}><Download size={14} /> CSV</button></div></div> : <div className="empty-state"><FileCode2 size={30} /><h3>الوثيقة ستظهر هنا</h3><p>اكتب الفكرة واضغط «ولّد الوثيقة» لإنشاء مخرجات منظمة فعلية.</p></div>}</section></div></>;
}
'''

text, count = re.subn(r'function ProductBrief\(\) \{.*?\nfunction ProjectHealth', new_product_brief + '\nfunction ProjectHealth', text, count=1, flags=re.S)
if count != 1:
    raise SystemExit(f'ProductBrief replacement count={count}')

widget = r'''function ProjectHealthWidget({ go }: { go: (key: PageKey) => void }) {
  const projects = [{ name: "Pocket Quest", health: 82, next: "تحليل جلسات اللاعب" }, { name: "Habit Loop", health: 61, next: "إنهاء نظام التذكيرات" }, { name: "Talkback AI", health: 38, next: "اختبار المشكلة" }];
  return <section className="panel health-widget"><div className="panel-head"><div><p className="eyebrow">Project Health Monitor</p><h2>صحة مشاريعك الآن</h2><span className="chart-note">ملخص سريع للقرار التالي في كل مشروع</span></div><button className="ghost-button" onClick={() => go("health")}>التفاصيل <ArrowUpRight size={14} /></button></div><div className="health-widget-list">{projects.map((project) => <div className="health-widget-row" key={project.name}><div><strong>{project.name}</strong><span>{project.next}</span></div><div className="health-widget-meter"><i style={{ width: `${project.health}%` }} /></div><b>{project.health}%</b></div>)}</div></section>;
}
'''
text = text.replace('function ProjectHealth() {', widget + '\nfunction ProjectHealth() {', 1)
text = text.replace('    <ProductToolsStrip go={go} />\n    <DashboardCharts />', '    <ProductToolsStrip go={go} />\n    <ProjectHealthWidget go={go} />\n    <DashboardCharts />', 1)
path.write_text(text)
print('patched ProductBrief and Overview health widget')
