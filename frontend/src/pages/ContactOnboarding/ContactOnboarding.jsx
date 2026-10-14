import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { apiClient, apiError, clearSession, getSession, saveSession } from '../../api/client.js';
import logo from '../../assets/images/firis-logo.png';
import '../Login/Login.css';
import './ContactOnboarding.css';

export default function ContactOnboarding() {
  const navigate = useNavigate();
  const session = getSession();
  const eligible = Boolean(session?.accessToken && session.account?.role === 'WORKER' && !session.account.mustChangePassword && session.account.contactOnboardingRequired);
  const [phone, setPhone] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [contactAccepted, setContactAccepted] = useState(false);
  const [version, setVersion] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (!eligible) return;
    let active = true;
    setLoading(true); setVersion(''); setMessage('');
    Promise.all([apiClient.get('/api/auth/contact-consent'), apiClient.get('/api/auth/contact')])
      .then(([consent, contact]) => {
        if (!active) return;
        if (!contact.data.contactOnboardingRequired) {
          saveSession({ ...getSession(), account: { ...getSession().account, contactOnboardingRequired: false, contactPhone: contact.data.contactPhone } });
          navigate('/dashboard', { replace: true });
          return;
        }
        if (!consent.data.version) throw new Error('약관 정보를 확인할 수 없습니다. 다시 시도해주세요.');
        setVersion(consent.data.version);
        setPhone(contact.data.contactPhone || '');
      })
      .catch((error) => { if (active) setMessage(apiError(error)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [eligible, navigate, retry]);

  if (!session?.accessToken) return <Navigate to="/login" replace />;
  if (session.account?.mustChangePassword) return <Navigate to="/change-password" replace />;
  if (!eligible) return <Navigate to="/dashboard" replace />;

  async function submit(event) {
    event.preventDefault();
    if (busy || loading || !version) return;
    if (!termsAccepted || !contactAccepted) { setMessage('이용 약관과 연락처 수집·이용 안내에 모두 동의해주세요.'); return; }
    if (!/^0\d{1,2}-?\d{3,4}-?\d{4}$/.test(phone.trim())) { setMessage('올바른 전화번호를 입력해주세요. 예: 010-1234-5678'); return; }
    const normalizedPhone = phone.trim().replace(/-/g, '');
    setBusy(true); setMessage('');
    try {
      const { data } = await apiClient.patch('/api/auth/contact', { contactPhone: normalizedPhone, consentAccepted: termsAccepted && contactAccepted, consentVersion: version });
      const current = getSession();
      if (!current?.accessToken) return;
      saveSession({ ...current, account: { ...current.account, contactOnboardingRequired: data.contactOnboardingRequired, contactPhone: data.contactPhone } });
      navigate('/dashboard', { replace: true });
    } catch (error) {
      setMessage(apiError(error));
    } finally { setBusy(false); }
  }

  return <main className="login-page">
    <div className="login-shell onboarding-shell">
      <header className="login-statusbar"><span>FIRIS / OPERATOR REGISTRATION</span><span>최초 로그인 · 기본 정보 등록</span></header>
      <section className="onboarding-panel" aria-labelledby="onboarding-title">
        <div className="login-access__brand"><img src={logo} alt="FIRIS" /><span>관제 시스템</span></div>
        <h1 id="onboarding-title">관제관 이용 약관 및 연락처 등록</h1>
        <p className="onboarding-intro">{session.account.name}님, 관제 화면을 이용하기 전에 약관을 확인하고 담당자 전화번호를 등록해주세요.</p>
        <form className="login-form" onSubmit={submit}>
          <section className="onboarding-terms" aria-labelledby="terms-title">
            <h2 id="terms-title">FIRIS 이용 약관 <span>시연용</span></h2>
            <ol>
              <li>FIRIS는 CCTV 영상과 AI 탐지 결과를 확인하는 관제 보조 시스템입니다. 탐지 결과는 관제관이 영상과 현장 상황을 확인하여 판단합니다.</li>
              <li>발급받은 계정은 본인만 사용하며, 계정과 비밀번호를 다른 사람에게 공유하지 않습니다.</li>
              <li>CCTV 영상, 탐지 기록과 담당자 정보는 관제 업무 목적으로만 이용하고 무단으로 외부에 공유하지 않습니다.</li>
              <li>119 모의 신고는 시연용 접수센터로 전달되며 실제 긴급 신고가 아닙니다. 긴급 상황은 현장 대응 절차에 따라 별도로 신고합니다.</li>
            </ol>
          </section>
          <label className="onboarding-check"><input type="checkbox" checked={termsAccepted} onChange={(event) => setTermsAccepted(event.target.checked)} required disabled={busy} /><span>[필수] FIRIS 이용 약관을 확인하고 동의합니다.</span></label>
          <section className="onboarding-terms" aria-labelledby="contact-title">
            <h2 id="contact-title">연락처 수집·이용 안내</h2>
            <p>등록한 전화번호는 FIRIS 계정의 담당자 연락처로 저장하며, 관제 업무 연락과 119 모의 신고의 신고자 연락처 전달에 사용합니다.</p>
            <p>전화번호와 동의 버전·동의 시각을 기록합니다. 동의하지 않으면 신규 관제관 등록을 완료할 수 없습니다.</p>
          </section>
          <label className="onboarding-check"><input type="checkbox" checked={contactAccepted} onChange={(event) => setContactAccepted(event.target.checked)} required disabled={busy} /><span>[필수] 연락처 수집·이용 안내를 확인하고 동의합니다.</span></label>
          <label htmlFor="operator-phone">담당자 전화번호</label>
          <div className="login-input"><input id="operator-phone" type="tel" autoComplete="tel" inputMode="tel" maxLength={20} placeholder="010-1234-5678" value={phone} onChange={(event) => { setPhone(event.target.value); setMessage(''); }} required disabled={busy || loading} aria-describedby="phone-help" /></div>
          <p id="phone-help" className="onboarding-intro">하이픈(-)은 입력해도 됩니다. 등록한 정보는 다음 로그인에도 유지됩니다.</p>
          {message && <p className="login-message" role="alert">{message}</p>}
          {!loading && !version && <button type="button" className="onboarding-secondary" onClick={() => setRetry((value) => value + 1)}>등록 정보 다시 불러오기</button>}
          <button type="submit" className="login-submit" disabled={loading || busy || !version || !termsAccepted || !contactAccepted || !phone.trim()}>{loading ? '등록 정보 확인 중…' : busy ? '저장 중…' : '동의 및 등록 완료'}</button>
          <button type="button" className="onboarding-secondary" disabled={busy} onClick={() => { clearSession(); navigate('/login', { replace: true }); }}>로그아웃</button>
        </form>
      </section>
    </div>
  </main>;
}
