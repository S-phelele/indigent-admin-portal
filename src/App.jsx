import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext';

// Shared by every role
import Login from './pages/Login';
import Profile from './pages/Profile';
import Notifications from './pages/Notifications';

// Fieldwork — councillors and capture officers
import MyWork from './pages/council/MyWork';
import Capture from './pages/council/Capture';
import CaptureApplication from './pages/council/CaptureApplication';
import MyCaptures from './pages/council/MyCaptures';

// The approval chain — verification, assessment, sign-off
import ApprovalQueue from './pages/approver/ApprovalQueue';
import ApprovalDetail from './pages/approver/ApprovalDetail';
import VerificationQueue from './pages/approver/VerificationQueue';
import VerificationDetail from './pages/approver/VerificationDetail';

// Administration
import Overview from './pages/admin/Overview';
import Dashboard from './pages/admin/Dashboard';
import ApplicationDetail from './pages/admin/ApplicationDetail';
import Applicants from './pages/admin/Applicants';
import ApplicantDetail from './pages/admin/ApplicantDetail';
import ApplicationStats from './pages/admin/ApplicationStats';
import Analytics from './pages/admin/Analytics';
import SlaMonitor from './pages/admin/SlaMonitor';
import AuditLogs from './pages/admin/AuditLogs';
import Privacy from './pages/admin/Privacy';
import StatisticsReport from './pages/admin/StatisticsReport';
import Staff from './pages/admin/Staff';
import SmsOutbox from './pages/admin/SmsOutbox';
import Renewals from './pages/admin/Renewals';
import PrintApplication from './pages/admin/PrintApplication';

const FIELD_ROLES = ['COUNCILLOR', 'CAPTURE_OFFICER'];
const APPROVER_ROLES = ['VERIFICATION_OFFICER', 'ASSESSMENT_OFFICER', 'SUPERVISOR'];

/**
 * Any signed-in staff member.
 *
 * Also the gate for a password that was issued and sent by SMS: until it is
 * replaced the API refuses everything else, so there is no point rendering a
 * page whose every request will fail.
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

/** Restrict a route to particular roles, sending everyone else to their own home. */
function RoleRoute({ roles, children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading"><span className="spinner" /> Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (user.mustChangePassword) return <Navigate to="/profile" replace />;
  if (!roles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
}

const AdminRoute = ({ children }) => <RoleRoute roles={['ADMIN']}>{children}</RoleRoute>;
const ApproverRoute = ({ children }) => <RoleRoute roles={['ADMIN', ...APPROVER_ROLES]}>{children}</RoleRoute>;

/**
 * "/" means something different to each role: a review queue for an
 * administrator, a day's fieldwork for a councillor, a work queue for anybody
 * in the approval chain.
 */
function Home() {
  const { user } = useAuth();
  if (FIELD_ROLES.includes(user?.role)) return <MyWork />;
  if (APPROVER_ROLES.includes(user?.role)) return <ApprovalQueue />;
  return <Overview />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route path="/" element={<PrivateRoute><Home /></PrivateRoute>} />
      <Route path="/profile" element={<PrivateRoute><Profile /></PrivateRoute>} />
      <Route path="/notifications" element={<PrivateRoute><Notifications /></PrivateRoute>} />

      {/* Fieldwork */}
      <Route path="/capture" element={<PrivateRoute><Capture /></PrivateRoute>} />
      <Route path="/captures" element={<PrivateRoute><MyCaptures /></PrivateRoute>} />
      <Route path="/applications/:id/capture" element={<PrivateRoute><CaptureApplication /></PrivateRoute>} />

      {/* The approval chain */}
      <Route path="/approvals" element={<ApproverRoute><ApprovalQueue /></ApproverRoute>} />
      <Route path="/approvals/:id" element={<ApproverRoute><ApprovalDetail /></ApproverRoute>} />
      <Route path="/verification" element={<ApproverRoute><VerificationQueue /></ApproverRoute>} />
      <Route path="/verification/:id" element={<ApproverRoute><VerificationDetail /></ApproverRoute>} />
      <Route path="/applications/:id/print" element={<ApproverRoute><PrintApplication /></ApproverRoute>} />

      {/* Administration */}
      <Route path="/applications" element={<AdminRoute><Dashboard /></AdminRoute>} />
      <Route path="/applications/:id" element={<AdminRoute><ApplicationDetail /></AdminRoute>} />
      <Route path="/applicants" element={<AdminRoute><Applicants /></AdminRoute>} />
      <Route path="/applicants/:id" element={<AdminRoute><ApplicantDetail /></AdminRoute>} />
      <Route path="/application-stats" element={<AdminRoute><ApplicationStats /></AdminRoute>} />
      <Route path="/analytics" element={<AdminRoute><Analytics /></AdminRoute>} />
      <Route path="/renewals" element={<RoleRoute roles={['ADMIN', 'ASSESSMENT_OFFICER', 'SUPERVISOR']}><Renewals /></RoleRoute>} />
      <Route path="/sla" element={<AdminRoute><SlaMonitor /></AdminRoute>} />
      <Route path="/staff" element={<AdminRoute><Staff /></AdminRoute>} />
      <Route path="/sms" element={<AdminRoute><SmsOutbox /></AdminRoute>} />
      <Route path="/audit-logs" element={<AdminRoute><AuditLogs /></AdminRoute>} />
      <Route path="/privacy" element={<AdminRoute><Privacy /></AdminRoute>} />
      <Route path="/statistics-report" element={<AdminRoute><StatisticsReport /></AdminRoute>} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
