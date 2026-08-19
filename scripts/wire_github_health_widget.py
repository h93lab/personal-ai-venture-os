from pathlib import Path
import re

path = Path('/home/ubuntu/personal-ai-venture-os/client/src/pages/Home.tsx')
text = path.read_text()
new = r'''function ProjectHealthWidget({ go }: { go: (key: PageKey) => void }) {
  const { isAuthenticated } = useAuth();
  const statusQuery = trpc.github.status.useQuery(undefined, { enabled: isAuthenticated, retry: false });
  const demoProjects = [{ name: "Pocket Quest", health: 82, next: "تحليل جلسات اللاعب" }, { name: "Habit Loop", health: 61, next: "إنهاء نظام التذكيرات" }, { name: "Talkback AI", health: 38, next: "اختبار المشكلة" }];
  const github = statusQuery.data?.connected ? { name: statusQuery.data.repo, health: statusQuery.data.health, next: `${statusQuery.data.recentCommits} commits حديثة · ${statusQuery.data.openIssues} issues مفتوحة` } : null;
  const projects = github ? [github, ...demoProjects.slice(0, 2)] : demoProjects;
  return <section className="panel health-widget"><div className="panel-head"><div><p className="eyebrow">Project Health Monitor</p><h2>صحة مشاريعك الآن</h2><span className="chart-note">{github ? "بيانات GitHub محدثة تلقائيًا" : "بيانات تجريبية — اربط GitHub من Settings"}</span></div><button className="ghost-button" onClick={() => go("health")}>التفاصيل <ArrowUpRight size={14} /></button></div><div className="health-widget-list">{projects.map((project) => <div className="health-widget-row" key={project.name}><div><strong>{project.name}</strong><span>{project.next}</span></div><div className="health-widget-meter"><i style={{ width: `${project.health}%` }} /></div><b>{project.health}%</b></div>)}</div>{statusQuery.isFetching && <div className="github-health-inline"><Loader2 size={13} className="spin" /> جارٍ تحديث بيانات GitHub</div>}</section>;
}
'''
text, count = re.subn(r'function ProjectHealthWidget\(\{ go \}: \{ go: \(key: PageKey\) => void \}\) \{.*?\nfunction ProjectHealth', new + '\nfunction ProjectHealth', text, count=1, flags=re.S)
if count != 1:
    raise SystemExit(f'ProjectHealthWidget replacement count={count}')
path.write_text(text)
print('wired GitHub status into health widget')
