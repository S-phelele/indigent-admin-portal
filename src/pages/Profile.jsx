import { useState } from 'react';
import AdminLayout from '../components/AdminLayout';
import Icon from '../components/ui/Icon';
import { useToast } from '../components/ui/Toast';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { friendlyError } from '../utils/apiError';

/**
 * A staff member's own details and password.
 *
 * Also the destination for anybody still carrying a password that was issued to
 * them and sent by SMS. Until they replace it the API refuses every other route,
 * so this page is the only place they can go — and it says why rather than
 * leaving them looking at a wall of permission errors.
 */
export default function Profile() {
  const { user, updateUser, isCouncillor } = useAuth();
  const toast = useToast();

  const [details, setDetails] = useState({
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    cellNumber: user?.cellNumber || '',
  });
  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [busy, setBusy] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  const mustChange = Boolean(user?.mustChangePassword);

  const saveDetails = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await api.patch('/auth/me', details);
      updateUser(res.data.data);
      toast.success('Your details were updated.');
    } catch (err) {
      toast.error(friendlyError(err, 'Could not save your details.'));
    } finally {
      setBusy(false);
    }
  };

  const changePassword = async (e) => {
    e.preventDefault();
    setPasswordError('');

    if (passwords.newPassword !== passwords.confirmPassword) {
      setPasswordError('The two new passwords do not match.');
      return;
    }

    setBusy(true);
    try {
      await api.post('/auth/change-password', {
        currentPassword: passwords.currentPassword,
        newPassword: passwords.newPassword,
      });
      // Clear the lock locally too, or the session keeps redirecting back here.
      updateUser({ mustChangePassword: false });
      setPasswords({ currentPassword: '', newPassword: '', confirmPassword: '' });
      toast.success('Your password was changed.');
    } catch (err) {
      setPasswordError(friendlyError(err, 'Could not change your password.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AdminLayout
      title="My profile"
      description={isCouncillor ? 'Your details as a ward councillor.' : 'Your administrator account.'}
    >
      {mustChange ? (
        <div className="alert alert-warning" role="alert">
          <Icon name="key" size={16} />
          <span>
            <strong>Choose your own password to continue.</strong> The password you were given was sent by SMS, so at
            least one other person has seen it. Everything else stays locked until you replace it.
          </span>
        </div>
      ) : null}

      <section className="panel">
        <div className="panel-header">
          <h2>Sign in and security</h2>
        </div>
        <form onSubmit={changePassword} className="form-grid">
          {passwordError ? <div className="alert alert-error span-2">{passwordError}</div> : null}

          <label className="form-group span-2">
            <span>{mustChange ? 'The password you were sent' : 'Current password'}</span>
            <input
              type="password"
              autoComplete="current-password"
              value={passwords.currentPassword}
              onChange={(e) => setPasswords((p) => ({ ...p, currentPassword: e.target.value }))}
              required
            />
          </label>
          <label className="form-group">
            <span>New password</span>
            <input
              type="password"
              autoComplete="new-password"
              value={passwords.newPassword}
              onChange={(e) => setPasswords((p) => ({ ...p, newPassword: e.target.value }))}
              required
            />
            <small>At least 8 characters, with a capital, a small letter and a symbol.</small>
          </label>
          <label className="form-group">
            <span>Confirm new password</span>
            <input
              type="password"
              autoComplete="new-password"
              value={passwords.confirmPassword}
              onChange={(e) => setPasswords((p) => ({ ...p, confirmPassword: e.target.value }))}
              required
            />
          </label>

          <div className="form-actions span-2">
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? 'Saving…' : 'Change my password'}
            </button>
          </div>
        </form>
      </section>

      <section className="panel">
        <div className="panel-header">
          <h2>My details</h2>
        </div>
        <form onSubmit={saveDetails} className="form-grid">
          <label className="form-group"><span>First name</span>
            <input value={details.firstName} onChange={(e) => setDetails((d) => ({ ...d, firstName: e.target.value }))} />
          </label>
          <label className="form-group"><span>Surname</span>
            <input value={details.lastName} onChange={(e) => setDetails((d) => ({ ...d, lastName: e.target.value }))} />
          </label>
          <label className="form-group"><span>Cell number</span>
            <input value={details.cellNumber} onChange={(e) => setDetails((d) => ({ ...d, cellNumber: e.target.value }))} inputMode="tel" />
          </label>
          <label className="form-group"><span>Email address</span>
            <input value={user?.email || ''} disabled />
            <small>Changing this needs an administrator — it is your username.</small>
          </label>

          {isCouncillor ? (
            <label className="form-group span-2"><span>Ward</span>
              <input value={user?.ward || 'Not assigned'} disabled />
              <small>Set by an administrator. It is recorded on every household you capture.</small>
            </label>
          ) : null}

          <div className="form-actions span-2">
            <button type="submit" className="btn btn-primary" disabled={busy || mustChange}>
              {busy ? 'Saving…' : 'Save my details'}
            </button>
            {mustChange ? <span className="field-hint">Change your password first.</span> : null}
          </div>
        </form>
      </section>
    </AdminLayout>
  );
}
