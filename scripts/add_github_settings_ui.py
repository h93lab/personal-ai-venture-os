from pathlib import Path

path = Path('/home/ubuntu/personal-ai-venture-os/client/src/pages/Home.tsx')
text = path.read_text()
component = r'''function GithubSettingsCard() {
  const settingsQuery = trpc.github.getSettings.useQuery();
  const save = trpc.github.saveSettings.useMutation({ onSuccess: () => { settingsQuery.refetch(); toast("تم حفظ إعدادات GitHub بأمان"); }, onError: (error) => toast(`تعذر حفظ GitHub: ${error.message}`) });
  const deleteConnection = trpc.github.deleteSettings.useMutation({ onSuccess: () => { settingsQuery.refetch(); toast("تم حذف اتصال GitHub"); } });
  const statusQuery = trpc.github.status.useQuery(undefined, { enabled: Boolean(settingsQuery.data?.connected) });
  const [token, setToken] = useState("");
  const [repoOwner, setRepoOwner] = useState("");
  const [repoName, setRepoName] = useState("");
  useEffect(() => { if (settingsQuery.data) { setRepoOwner(settingsQuery.data.repoOwner); setRepoName(settingsQuery.data.repoName); } }, [settingsQuery.data]);
  const connected = settingsQuery.data?.connected;
  return <section className="panel settings-card github-settings-card"><div className="panel-head"><div><p className="eyebrow">Repository intelligence</p><h2>GitHub</h2></div><div className="settings-icon"><GitBranch size={18} /></div></div><p className="settings-note">أدخل Token بصلاحية قراءة فقط، وسيتم حفظه في Backend ولن يظهر كاملًا مرة أخرى في الواجهة.</p><label>GitHub Token<input type="password" value={token} onChange={(e) => setToken(e.target.value)} placeholder={connected ? settingsQuery.data?.token ?? "محفوظ" : "ghp_..."} /></label><div className="github-repo-fields"><label>Owner<input value={repoOwner} onChange={(e) => setRepoOwner(e.target.value)} placeholder="username أو organization" /></label><label>Repository<input value={repoName} onChange={(e) => setRepoName(e.target.value)} placeholder="repository-name" /></label></div><div className="api-actions"><button className="primary-button small" disabled={save.isPending || !repoOwner || !repoName || (!token && !connected)} onClick={() => save.mutate({ token: token || undefined, repoOwner, repoName })}>{save.isPending ? <><Loader2 size={14} className="spin" /> جارٍ الحفظ</> : <><Check size={14} /> حفظ الاتصال</>}</button>{connected && <button className="outline-button small" disabled={deleteConnection.isPending} onClick={() => deleteConnection.mutate()}><X size={14} /> حذف الاتصال</button>}</div>{connected && <div className="github-health-inline">{statusQuery.isLoading ? <><Loader2 size={14} className="spin" /> جارٍ قراءة حالة المستودع</> : statusQuery.data?.connected ? <><CheckCircle2 size={14} /> {statusQuery.data.repo} · صحة {statusQuery.data.health}% · {statusQuery.data.recentCommits} commits حديثة</> : <><AlertTriangle size={14} /> تعذر قراءة المستودع</>}</div>}</section>;
}
'''
needle = 'function ProductToolsStrip'
if 'function GithubSettingsCard()' not in text:
    text = text.replace(needle, component + '\n' + needle, 1)
old = '</section></div></> }\n\nfunction ProductToolsStrip'
new = '</section><GithubSettingsCard /></div></> }\n\n' + component + '\nfunction ProductToolsStrip'
if old in text:
    text = text.replace(old, new, 1)
else:
    # If component was already inserted, only inject the card into SettingsPage.
    text = text.replace('</section></div></> }\n\nfunction ProductToolsStrip', '</section><GithubSettingsCard /></div></> }\n\nfunction ProductToolsStrip', 1)
path.write_text(text)
print('added GithubSettingsCard')
