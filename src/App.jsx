import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import ApplicationDetail from './pages/ApplicationDetail';
import Applicants from './pages/Applicants';
import ApplicationStats from './pages/ApplicationStats';
import Analytics from './pages/Analytics';
import SlaMonitor from './pages/SlaMonitor';
import AuditLogs from './pages/AuditLogs';

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading">Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
      <Route path="/applications/:id" element={<PrivateRoute><ApplicationDetail /></PrivateRoute>} />
      <Route path="/applicants" element={<PrivateRoute><Applicants /></PrivateRoute>} />
      <Route path="/application-stats" element={<PrivateRoute><ApplicationStats /></PrivateRoute>} />
      <Route path="/analytics" element={<PrivateRoute><Analytics /></PrivateRoute>} />
      <Route path="/sla" element={<PrivateRoute><SlaMonitor /></PrivateRoute>} />
      <Route path="/audit-logs" element={<PrivateRoute><AuditLogs /></PrivateRoute>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
