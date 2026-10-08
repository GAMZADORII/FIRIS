import { useEffect, useRef, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { clearSession } from '../../api/client.js';
import firisLogo from '../../assets/images/firis-logo.png';
import './Header.css';

const navigationItems = [
  { to: '/dashboard', label: '대시보드' },
  { to: '/history', label: '이력 조회' },
  { to: '/admin', label: '관리자' },
];

export default function Header({ user = null }) {
  const navigate = useNavigate();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const notificationRef = useRef(null);
  const notificationButtonRef = useRef(null);
  const location = useLocation();

  useEffect(() => {
    setNotificationsOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!notificationsOpen) return;
    function handleOutsideClick(event) {
      if (!notificationRef.current?.contains(event.target)) {
        setNotificationsOpen(false);
      }
    }
    function handleEscape(event) {
      if (event.key === 'Escape') {
        setNotificationsOpen(false);
        notificationButtonRef.current?.focus();
      }
    }
    document.addEventListener('pointerdown', handleOutsideClick);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('pointerdown', handleOutsideClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [notificationsOpen]);

  return (
    <header className="app-header">
      <NavLink className="app-header__brand" to="/dashboard" aria-label="FIRIS 대시보드">
        <img src={firisLogo} alt="FIRIS" />
      </NavLink>
      <nav className="app-header__navigation" aria-label="주요 메뉴">
        {navigationItems.filter(({ to }) => to !== '/admin' || user?.role === 'ADMIN').map(({ to, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `app-header__link${isActive ? ' app-header__link--active' : ''}`
            }
          >
            {label}
          </NavLink>
        ))}
      </nav>
      <div className="app-header__account">
        <div className="app-header__notifications" ref={notificationRef}>
          <button
            ref={notificationButtonRef}
            type="button"
            className="app-header__notification-button"
            aria-label="알림"
            aria-expanded={notificationsOpen}
            aria-controls="header-notifications"
            onClick={() => setNotificationsOpen((open) => !open)}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
              <path d="M10 21h4" />
            </svg>
          </button>
          {notificationsOpen && (
            <section id="header-notifications" className="app-header__notification-panel" aria-label="알림 목록">
              <div className="app-header__notification-heading">
                <h2>알림</h2>
                <button type="button" aria-label="알림 닫기" onClick={() => {
                  setNotificationsOpen(false);
                  notificationButtonRef.current?.focus();
                }}>×</button>
              </div>
              <p>새로운 알림이 없습니다.</p>
              <small>알림 서비스 연결 대기</small>
            </section>
          )}
        </div>
        <div className="app-header__user">
          <span className="app-header__avatar" aria-hidden="true">{(user?.name || '?').slice(0, 1)}</span>
          <div><strong>{user?.name || '사용자'}</strong><small>{user?.role === 'ADMIN' ? '관리자' : '작업자'}</small></div>
        </div>
        <button className="app-header__logout" type="button" aria-label="로그아웃" title="로그아웃" onClick={() => { clearSession(); navigate('/login', { replace: true }); }}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M9 5H5v14h4M10 12h11m-4-4 4 4-4 4" />
          </svg>
          <span>로그아웃</span>
        </button>
      </div>
    </header>
  );
}
