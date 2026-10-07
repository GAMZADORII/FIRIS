import { useState } from "react";
import logo from "../../assets/images/firis-logo.png";
import loginImage from "../../assets/images/login.png";
import "./Login.css";

function LoginIcon({ type, ...props }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {type === "lock" ? (
        <>
          <rect x="5" y="10" width="14" height="11" rx="2" />
          <path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3" />
        </>
      ) : type === "eye" ? (
        <>
          <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z" />
          <circle cx="12" cy="12" r="3" />
        </>
      ) : type === "power" ? (
        <>
          <path d="M12 2v10M6 5a9 9 0 1 0 12 0" />
        </>
      ) : (
        <>
          <rect x="3" y="5" width="18" height="15" rx="2" />
          <circle cx="9" cy="11" r="2" />
          <path d="M6 16c0-3 6-3 6 0M15 10h3M15 14h3M9 2v5" />
        </>
      )}
    </svg>
  );
}

export default function Login() {
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");
  function handleSubmit(event) {
    event.preventDefault();
    if (!loginId.trim() || !password.trim()) {
      setMessage("로그인 ID와 비밀번호를 입력해 주세요.");
      return;
    }
    setMessage(
      "로그인 서비스 연결 대기 중입니다.",
    );
  }
  return (
    <main className="login-page">
      <div className="login-shell">
        <header className="login-statusbar">
          <div>
            <span className="login-node">
              <i /> FIRIS / CONTROL SYSTEM
            </span>
            <span className="login-statusbar__description">
              AI 기반 화재 감지 및 통합 관제 시스템
            </span>
          </div>
          <span className="login-statusbar__mode">연결 대기</span>
        </header>
        <div className="login-layout">
          <section
            className="login-overview"
            aria-labelledby="login-overview-title"
          >
            <div className="login-overview__heading">
              <h2 id="login-overview-title">
                <svg
                  className="login-overview__icon"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                  focusable="false"
                >
                  <path d="M12 2.5 20 6v5.5c0 4.5-3.3 8-8 10-4.7-2-8-5.5-8-10V6l8-3.5Z" />
                  <path d="M12.5 7.5c.5 3-3.5 3.5-3.5 6a3 3 0 0 0 6 0c0-1.2-.5-2.3-1.5-3-.1 1-.6 1.5-1 1.7.5-1.7.5-3.2 0-4.7Z" />
                </svg>
                화재 감지 통합 관제
              </h2>
              <span>FIRE & SMOKE</span>
            </div>
            <div className="login-monitor">
              <img src={loginImage} alt="FIRIS 로그인 페이지 이미지" />
            </div>
            <div className="login-features">
              {[
                ["01", "CCTV 모니터링", "관제 구역 통합 확인"],
                ["02", "화재·연기 감지", "AI 기반 위험 감지"],
                ["03", "이벤트 이력", "발생 기록 및 검수"],
              ].map(([number, title, detail]) => (
                <article key={number}>
                  <span>{number} / SYSTEM MODULE</span>
                  <h3>{title}</h3>
                  <p>{detail}</p>
                </article>
              ))}
            </div>
            <div className="login-overview__footer">
              <span>FIRIS MONITORING CONSOLE</span>
              <span>FIRE / SMOKE</span>
            </div>
          </section>
          <section className="login-access" aria-labelledby="login-title">
            <div className="login-access__brand">
              <img src={logo} alt="FIRIS" />
              <span>관제 시스템</span>
            </div>
            <div className="login-access__intro">
              <p className="login-eyebrow">OPERATOR ACCESS</p>
              <h1 id="login-title">통합관제 접속</h1>
              <p>발급받은 계정으로 FIRIS에 로그인하세요.</p>
            </div>
            <form className="login-form" onSubmit={handleSubmit}>
              <label htmlFor="login-id">로그인 ID</label>
              <div className="login-input">
                <LoginIcon type="user" />
                <input
                  id="login-id"
                  name="username"
                  autoComplete="username"
                  placeholder="로그인 ID를 입력하세요"
                  required
                  maxLength={100}
                  value={loginId}
                  onChange={(e) => {
                    setLoginId(e.target.value);
                    setMessage("");
                  }}
                />
              </div>
              <label htmlFor="login-password">비밀번호</label>
              <div className="login-input">
                <LoginIcon type="lock" />
                <input
                  id="login-password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="비밀번호를 입력하세요"
                  required
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setMessage("");
                  }}
                />
                <button
                  type="button"
                  className="login-password-toggle"
                  aria-label={
                    showPassword ? "비밀번호 숨기기" : "비밀번호 표시"
                  }
                  aria-pressed={showPassword}
                  onClick={() => setShowPassword((value) => !value)}
                >
                  <LoginIcon type="eye" />
                </button>
              </div>
              <p className="login-account-help">
                계정 발급 및 비밀번호 초기화는 관리자에게 문의하세요.
              </p>
              {message && (
                <p className="login-message" role="status">
                  {message}
                </p>
              )}
              <button type="submit" className="login-submit">
                <LoginIcon type="power" /> 로그인 <span>SYSTEM ACCESS</span>
              </button>
            </form>
            <div className="login-access__footer">
              <span>FIRIS</span>
              <span>FIRE DETECTION & MONITORING</span>
            </div>
          </section>
        </div>
        <footer className="login-footer">
          <div>
            <span className="login-footer__badge">SYSTEM STANDBY</span>
            <span>화재 감지 · 실시간 관제 · 이벤트 관리</span>
          </div>
          <span>FIRIS / INTEGRATED MONITORING</span>
        </footer>
      </div>
    </main>
  );
}
