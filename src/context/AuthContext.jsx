import { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

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
const STAFF_ROLES = ['ADMIN', 'COUNCILLOR', 'CAPTURE_OFFICER', 'VERIFICATION_OFFICER'];

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
          setUser(res.data.data);
          localStorage.setItem('admin_user', JSON.stringify(res.data.data));
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
    const { user, token } = res.data.data;
    if (!STAFF_ROLES.includes(user.role)) {
      throw new Error('This portal is for municipal staff. Residents should use the applicant portal.');
    }
    localStorage.setItem('admin_token', token);
    localStorage.setItem('admin_user', JSON.stringify(user));
    setUser(user);
    return user;
  };

  const logout = () => {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_user');
    setUser(null);
  };

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

  return (
    <AuthContext.Provider
      value={{ user, loading, login, logout, updateUser, isAdmin, isCouncillor, canCapture, canVerify }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
