from pathlib import Path
import re

path = Path('/home/ubuntu/personal-ai-venture-os/client/src/pages/Home.tsx')
text = path.read_text()
new = r'''function GithubSettingsCard() {
  const settingsQuery = trpc.github.getSettings.useQuery();
  const aiTest = trpc.ai.testConnection.useQuery(undefined, { enabled: false, retry: false });
  const save = trpc.github.saveSettings.useMutation({ onSuccess: () => { settingsQuery.refetch(); toast("تم حفظ إعدادات GitHub بأمان"); }, onError: (error) => toast(`تعذر حفظ GitHub: ${error.message}`) });
  const test = trpc.github.testConnection.useMutation({ onSuccess: (data) => toast(`اتصال GitHub ناجح: ${data.repo} · صحة ${data.health}%`), onError: (error) => toast(`فشل اتصال GitHub: ${error.message}`) });
  const refresh = trpc.github.configureRefresh.useMutation({ onSuccess: (data) => { settingsQuery.refetch(); toast(`تم تفعيل التحديث كل ${data.refreshMinutes} دقيقة`); }, onError: (error) => toast(`تعذر تفعيل التحديث: ${error.message}`) });
  const deleteConnection = trpc.github.deleteSettings.useMutation({ onSuccess: () => { settingsQuery.refetch(); toast("تم حذف اتصال GitHub"); } });
  const statusQuery = trpc.github.status.useQuery(undefined, { enabled: Boolean(settingsQuery.data?.connected), retry: false, refetchInterval: settingsQuery.data?.connected ? settingsQuery.data.refreshMinutes * 60_000 : false });
  const [token, setToken] = useState("");
  const [repoOwner, setRepoOwner] = useState("");
  const [repoName, setRepoName] = useState("");
  const [healthThreshold, setHealthThreshold] = useState(50);
  const [refreshMinutes, setRefreshMinutes] = useState(60);
  useEffect(() => { if (settingsQuery.data) { setRepoOwner(settingsQuery.data.repoOwner); setRepoName(settingsQuery.data.repoName); setHealthThreshold(settingsQuery.data.healthThreshold); setRefreshMinutes(settingsQuery.data.refreshMinutes); } }, [settingsQuery.data]);
  const connected = settingsQuery.data?.connected;
  const testAi = async () => { try { const result = await aiTest.refetch(); if (result.data) toast(`مزود الذكاء الاصطناعي متصل: ${result.data.modelCount} نموذج`); } catch (error) { toast(`فشل اتصال مزود AI: ${String(error)}`); } };
  const testGithub = () => test.mutate({ token: token || undefined, repoOwner, repoName });
  return <section className="panel settings-card github-settings-card"><div className="panel-head"><div><p className="eyebrow">Repository intelligence</p><h2>GitHub وAI Provider</h2></div><div className="settings-icon"><GitBranch size={18} /></div></div><p className="settings-note">التوكن محفوظ في Backend ولا يظهر كاملًا داخل الواجهة.</p><label>GitHub Token<input type="password" value={token} onChange={(e) => setToken(e.target.value)} placeholder={connected ? settingsQuery.data?.token ?? "محفوظ" : "ghp_..."} /></label><div className="github-repo-fields"><label>Owner<input value={repoOwner} onChange={(e) => setRepoOwner(e.target.value)} placeholder="username أو organization" /></label><label>Repository<input value={repoName} onChange={(e) => setRepoName(e.target.value)} placeholder="repository-name" /></label></div><div className="api-actions"><button className="outline-button small" disabled={test.isPending || !repoOwner || !repoName || (!token && !connected)} onClick={testGithub}>{test.isPending ? <><Loader2 size={14} className="spin" /> اختبار...</> : <><Activity size={14} /> اختبار GitHub</>}</button><button className="outline-button small" disabled={aiTest.isFetching} onClick={testAi}>{aiTest.isFetching ? <><Loader2 size={14} className="spin" /> اختبار...</> : <><BrainCircuit size={14} /> اختبار AI</>}</button><button className="primary-button small" disabled={save.isPending || !repoOwner || !repoName || (!token && !connected)} onClick={() => save.mutate({ token: token || undefined, repoOwner, repoName, healthThreshold, refreshMinutes })}>{save.isPending ? <><Loader2 size={14} className="spin" /> جارٍ الحفظ</> : <><Check size={14} /> حفظ الإعدادات</>}</button>{connected && <button className="outline-button small" disabled={deleteConnection.isPending} onClick={() => deleteConnection.mutate()}><X size={14} /> حذف</button>}</div><div className="github-controls"><label>حد التنبيه الصحي<select value={healthThreshold} onChange={(e) => setHealthThreshold(Number(e.target.value))}><option value={30}>30% — منخفض جدًا</option><option value={50}>50% — متوسط</option><option value={70}>70% — مرتفع</option><option value={85}>85% — صارم</option></select></label><label>تحديث GitHub كل<select value={refreshMinutes} onChange={(e) => setRefreshMinutes(Number(e.target.value))}><option value={15}>15 دقيقة</option><option value={30}>30 دقيقة</option><option value={60}>ساعة</option><option value={360}>6 ساعات</option><option value={1440}>يوميًا</option></select></label><button className="outline-button small" disabled={refresh.isPending || !connected} onClick={() => refresh.mutate({ refreshMinutes, healthThreshold })}>{refresh.isPending ? <Loader2 size={14} className="spin" /> : <CalendarClock size={14} />} تفعيل التحديث التلقائي</button></div>{connected && <div className="github-health-inline">{statusQuery.isLoading ? <><Loader2 size={14} className="spin" /> جارٍ قراءة حالة المستودع</> : statusQuery.data?.connected ? <><CheckCircle2 size={14} /> {statusQuery.data.repo} · صحة {statusQuery.data.health}% {statusQuery.data.warning ? "· تنبيه: الصحة أقل من الحد" : "· ضمن الحد"}</> : <><AlertTriangle size={14} /> تعذر قراءة المستودع</>}</div>}</section>;
}
'''
text, count = re.subn(r'function GithubSettingsCard\(\) \{.*?\nfunction ProductToolsStrip', new + '\nfunction ProductToolsStrip', text, count=1, flags=re.S)
if count != 1:
    raise SystemExit(f'GithubSettingsCard replacement count={count}')
path.write_text(text)
print('updated Settings integration controls')
