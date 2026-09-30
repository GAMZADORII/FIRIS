import { Navigate, Route, Routes } from 'react-router-dom';
import Login from './pages/Login/Login.js';
import Dashboard from './pages/Dashboard/Dashboard.js';
import History from './pages/History/History.js';
import Admin from './pages/Admin/Admin.js';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<Login />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/history" element={<History />} />
      <Route path="/admin" element={<Admin />} />
      <Route path="*" element={<p>페이지를 찾을 수 없습니다.</p>} />
    </Routes>
  );
}
