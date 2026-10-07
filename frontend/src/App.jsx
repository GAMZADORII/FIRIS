import { Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { getSession } from './api/client.js';
import Login from './pages/Login/Login.jsx';
import Dashboard from './pages/Dashboard/Dashboard.jsx';
import History from './pages/History/History.jsx';
import Admin from './pages/Admin/Admin.jsx';
import MainLayout from './layouts/MainLayout.jsx';
import { useEffect, useState } from 'react';

function Protected({ session, admin = false }) {
  if (!session?.accessToken) return <Navigate to="/login" replace />;
  if (session.account?.mustChangePassword) return <Navigate to="/change-password" replace />;
  if (admin && session.account?.role !== 'ADMIN') return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}

export default function App() {
  const [session, setSession] = useState(getSession);
  useEffect(() => {
    const update = () => setSession(getSession());
    window.addEventListener('firis-session-change', update);
    return () => window.removeEventListener('firis-session-change', update);
  }, []);
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<Login />} />
      <Route path="/change-password" element={<Login changePassword />} />
      <Route element={<Protected session={session} />}>
        <Route element={<MainLayout />}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/history" element={<History />} />
        <Route element={<Protected session={session} admin />}>
        <Route path="/admin" element={<Admin />} />
        </Route>
        </Route>
      </Route>
      <Route path="*" element={<p>페이지를 찾을 수 없습니다.</p>} />
    </Routes>
  );
}
