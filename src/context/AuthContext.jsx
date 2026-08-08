import { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';
import useIdleTimeout from '../hooks/useIdleTimeout';
import IdleWarning from '../components/IdleWarning';

const AuthContext = createContext(null);

/**
 * Two kinds of staff sign in here.
 *
 * Administrators run the register. Ward councillors capture applications door to
 * door. They share a login, a layout and a design language, and differ only in
 * what the navigation offers them — which is why this is one portal with a
 * role-aware shell rather than two applications to keep in step.
 *
 * Residents are turned away: this portal has no resident-facing screens, so
 * letting an APPLICANT in would only strand them somewhere useless.
 */
const STAFF_ROLES = ['ADMIN', 'COUNCILLOR', 'CAPTURE_OFFICER', 'VERIFICATION_OFFICER', 'ASSESSMENT_OFFICER', 'SUPERVISOR'];

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('admin_user')); } catch { return null; }
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('admin_token');
    if (token) {
      api.get('/auth/me')
        .then((res) => {
          if (!STAFF_ROLES.includes(res.data.data.role)) throw new Error('Not staff');
          /**
           * Merged over what was cached rather than replacing it.
           *
           * /auth/me returns the account, not the session, so overwriting would
           * drop the idle-timeout policy on every page reload and silently fall
           * back to the defaults below.
           */
          let cached = {};
          try { cached = JSON.parse(localStorage.getItem('admin_user')) || {}; } catch { /* ignore */ }
          const merged = { session: cached.session, previousSignIn: cached.previousSignIn, ...res.data.data };
          setUser(merged);
          localStorage.setItem('admin_user', JSON.stringify(merged));
        })
        .catch(() => {
          localStorage.removeItem('admin_token');
          localStorage.removeItem('admin_user');
          setUser(null);
        })
        .finally(() => setLoading(false));
    } else setLoading(false);
  }, []);

  const login = async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    const { user, token, session, previousSignIn } = res.data.data;
    if (!STAFF_ROLES.includes(user.role)) {
      throw new Error('This portal is for municipal staff. Residents should use the applicant portal.');
    }
    // The session policy and the previous sign-in ride along with the user, so the
    // idle timer and the "last signed in" line survive a page reload.
    const withSession = { ...user, session, previousSignIn };
    localStorage.setItem('admin_token', token);
    localStorage.setItem('admin_user', JSON.stringify(withSession));
    sessionStorage.removeItem('admin_signout_reason');
    setUser(withSession);
    return withSession;
  };

  /**
   * End the session.
   *
   * `reason` is stashed for the sign-in screen to read, because a session that
   * ends without explanation looks like the site broke. Somebody signed out for
   * being idle should be told that is what happened, and that nothing is wrong.
   */
  const logout = (reason = null) => {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_user');
    if (reason) sessionStorage.setItem('admin_signout_reason', reason);
    else sessionStorage.removeItem('admin_signout_reason');
    setUser(null);
  };

  /**
   * Sign out for inactivity.
   *
   * Redirects rather than only clearing state: the person is not at the screen, so
   * leaving them on a page that will now fail every request would mean they come
   * back to a wall of errors instead of a sign-in box.
   */
  const idleSignOut = () => {
    logout('idle');
    if (!window.location.pathname.includes('/login')) window.location.href = '/login';
  };

  const session = useIdleTimeout({
    enabled: Boolean(user),
    // Read from the sign-in response, so the policy is set once on the server.
    idleMinutes: user?.session?.idleMinutes ?? 20,
    warningMinutes: user?.session?.idleWarningMinutes ?? 2,
    onTimeout: idleSignOut,
    // Shared so two tabs do not count each other as idle.
    storageKey: 'admin_last_active',
  });

  /**
   * Merge a partial update into the cached user.
   *
   * Needed when a councillor replaces their temporary password: the session is
   * otherwise still carrying mustChangePassword and would bounce them straight
   * back to the screen they just completed.
   */
  const updateUser = (patch) => {
    setUser((current) => {
      const next = { ...current, ...patch };
      localStorage.setItem('admin_user', JSON.stringify(next));
      return next;
    });
  };

  const isAdmin = user?.role === 'ADMIN';
  const isCouncillor = user?.role === 'COUNCILLOR';
  const canCapture = ['ADMIN', 'COUNCILLOR', 'CAPTURE_OFFICER'].includes(user?.role);
  const canVerify = ['ADMIN', 'VERIFICATION_OFFICER'].includes(user?.role);
  const canApprove = ['ADMIN', 'VERIFICATION_OFFICER', 'ASSESSMENT_OFFICER', 'SUPERVISOR'].includes(user?.role);

  return (
    <AuthContext.Provider
      value={{ user, loading, login, logout, updateUser, isAdmin, isCouncillor, canCapture, canVerify, canApprove }}
    >
      {children}
      {session.warning ? (
        <IdleWarning
          secondsLeft={session.secondsLeft}
          onStay={session.staySignedIn}
          onSignOutNow={idleSignOut}
        />
      ) : null}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
