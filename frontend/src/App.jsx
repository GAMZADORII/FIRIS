import { Navigate, Route, Routes } from 'react-router-dom';
import Login from './pages/Login/Login.jsx';
import Dashboard from './pages/Dashboard/Dashboard.jsx';
import History from './pages/History/History.jsx';
import Admin from './pages/Admin/Admin.jsx';
import MainLayout from './layouts/MainLayout.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<Login />} />
      <Route element={<MainLayout />}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/history" element={<History />} />
        <Route path="/admin" element={<Admin />} />
      </Route>
      <Route path="*" element={<p>페이지를 찾을 수 없습니다.</p>} />
    </Routes>
  );
}
