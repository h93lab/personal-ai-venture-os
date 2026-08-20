import { useState } from "react";
import { LockKeyhole, Loader2, ShieldCheck } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";

export default function LoginPage() {
  const { login } = useAuth();
  const [pin, setPin] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!/^\d{4,12}$/.test(pin)) {
      setMessage("أدخل رمز PIN من 4 إلى 12 رقمًا.");
      return;
    }
    setSubmitting(true);
    setMessage(null);
    try {
      const result = await login(pin);
      if (!result.ok) {
        setMessage(result.locked ? "تم إيقاف المحاولات مؤقتًا. انتظر 15 دقيقة ثم حاول مجددًا." : "رمز PIN غير صحيح.");
        return;
      }
      if (!rememberMe) sessionStorage.setItem("venture-os-session", "short");
    } catch {
      setMessage("تعذر تسجيل الدخول. تحقق من إعدادات الخادم وحاول مجددًا.");
    } finally {
      setSubmitting(false);
    }
  }

  return <main className="login-screen" dir="rtl"><section className="login-card"><div className="login-mark"><LockKeyhole size={22} /></div><p className="eyebrow">PERSONAL AI VENTURE OS</p><h1>مرحبًا بعودتك</h1><p className="login-description">أدخل رمز PIN المحلي للوصول إلى مساحة العمل الخاصة بك.</p><form onSubmit={submit} className="login-form"><label htmlFor="local-pin">رمز PIN<input id="local-pin" inputMode="numeric" autoComplete="current-password" type="password" maxLength={12} value={pin} onChange={event => setPin(event.target.value.replace(/\D/g, ""))} placeholder="••••" autoFocus /></label><label className="remember-row"><input type="checkbox" checked={rememberMe} onChange={event => setRememberMe(event.target.checked)} /> تذكرني على هذا الجهاز</label>{message && <p className="login-error" role="alert">{message}</p>}<button className="primary-button login-submit" type="submit" disabled={submitting}>{submitting ? <><Loader2 size={16} className="spin" /> جارٍ التحقق...</> : <><ShieldCheck size={16} /> دخول آمن</>}</button></form><p className="login-footnote">يمكن تغيير رمز PIN من إعدادات التشغيل بعد تثبيت المنصة على الخادم.</p></section></main>;
}
