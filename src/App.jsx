import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Overview from './pages/Overview';
import Dashboard from './pages/Dashboard';
import ApplicationDetail from './pages/ApplicationDetail';
import Applicants from './pages/Applicants';
import ApplicantDetail from './pages/ApplicantDetail';
import ApplicationStats from './pages/ApplicationStats';
import Analytics from './pages/Analytics';
import SlaMonitor from './pages/SlaMonitor';
import AuditLogs from './pages/AuditLogs';
import Notifications from './pages/Notifications';
import Staff from './pages/Staff';
import SmsOutbox from './pages/SmsOutbox';
import VerificationQueue from './pages/VerificationQueue';
import VerificationDetail from './pages/VerificationDetail';
import Capture from './pages/Capture';
import CaptureApplication from './pages/CaptureApplication';
import MyWork from './pages/MyWork';
import MyCaptures from './pages/MyCaptures';
import Profile from './pages/Profile';

/**
 * Any signed-in staff member.
 *
 * Also the gate for a password that was issued and sent by SMS: until it is
 * replaced the API refuses everything else, so there is no point rendering a
 * page whose every request will fail. Sending them to the profile once, rather
 * than letting them wander into permission errors, is the difference between an
 * instruction and a fault.
 */
function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <div className="loading"><span className="spinner" /> Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (user.mustChangePassword && location.pathname !== '/profile') {
    return <Navigate to="/profile" replace />;
  }
  return children;
}

/** Administrators only. Other staff are sent to their own home rather than a dead end. */
function AdminRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading"><span className="spinner" /> Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (user.mustChangePassword) return <Navigate to="/profile" replace />;
  if (user.role !== 'ADMIN') return <Navigate to="/" replace />;
  return children;
}

/**
 * Verification officers and administrators.
 *
 * Deliberately excludes everyone who captures. Capture, verify and decide are
 * three different pairs of hands, and the routing says so as plainly as the API.
 */
function VerifierRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading"><span className="spinner" /> Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (user.mustChangePassword) return <Navigate to="/profile" replace />;
  if (!['ADMIN', 'VERIFICATION_OFFICER'].includes(user.role)) return <Navigate to="/" replace />;
  return children;
}

/**
 * "/" means something different to each role: a review queue for an
 * administrator, a day's fieldwork for a councillor or capture officer, a work
 * queue for a verification officer.
 */
function Home() {
  const { user } = useAuth();
  if (['COUNCILLOR', 'CAPTURE_OFFICER'].includes(user?.role)) return <MyWork />;
  if (user?.role === 'VERIFICATION_OFFICER') return <VerificationQueue />;
  return <Overview />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route path="/" element={<PrivateRoute><Home /></PrivateRoute>} />
      <Route path="/profile" element={<PrivateRoute><Profile /></PrivateRoute>} />
      <Route path="/notifications" element={<PrivateRoute><Notifications /></PrivateRoute>} />

      {/* Fieldwork — councillors and administrators */}
      <Route path="/capture" element={<PrivateRoute><Capture /></PrivateRoute>} />
      <Route path="/captures" element={<PrivateRoute><MyCaptures /></PrivateRoute>} />
      <Route path="/applications/:id/capture" element={<PrivateRoute><CaptureApplication /></PrivateRoute>} />

      {/* Verification — officers and administrators */}
      <Route path="/verification" element={<VerifierRoute><VerificationQueue /></VerifierRoute>} />
      <Route path="/verification/:id" element={<VerifierRoute><VerificationDetail /></VerifierRoute>} />

      {/* Review and oversight — administrators only */}
      <Route path="/applications" element={<AdminRoute><Dashboard /></AdminRoute>} />
      <Route path="/applications/:id" element={<AdminRoute><ApplicationDetail /></AdminRoute>} />
      <Route path="/applicants" element={<AdminRoute><Applicants /></AdminRoute>} />
      <Route path="/applicants/:id" element={<AdminRoute><ApplicantDetail /></AdminRoute>} />
      <Route path="/application-stats" element={<AdminRoute><ApplicationStats /></AdminRoute>} />
      <Route path="/analytics" element={<AdminRoute><Analytics /></AdminRoute>} />
      <Route path="/sla" element={<AdminRoute><SlaMonitor /></AdminRoute>} />
      <Route path="/staff" element={<AdminRoute><Staff /></AdminRoute>} />
      <Route path="/sms" element={<AdminRoute><SmsOutbox /></AdminRoute>} />
      <Route path="/audit-logs" element={<AdminRoute><AuditLogs /></AdminRoute>} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
