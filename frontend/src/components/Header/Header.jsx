import { NavLink } from 'react-router-dom';
import firisLogo from '../../assets/images/firis-logo.png';
import './Header.css';

const navigationItems = [
  { to: '/dashboard', label: '대시보드' },
  { to: '/history', label: '이력 조회' },
  { to: '/admin', label: '관리자' },
];

export default function Header() {
  return (
    <header className="app-header">
      <NavLink className="app-header__brand" to="/dashboard" aria-label="FIRIS 대시보드">
        <img src={firisLogo} alt="FIRIS" />
      </NavLink>
      <nav className="app-header__navigation" aria-label="주요 메뉴">
        {navigationItems.map(({ to, label }) => (
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
    </header>
  );
}