import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AdminLayout from '../../components/AdminLayout';
import Icon from '../../components/ui/Icon';
import LoadError, { loadErrorMessage } from '../../components/LoadError';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';

/**
 * A ward councillor's home page.
 *
 * Not a dashboard. The one thing this page has to do is get somebody who has
 * just opened it on a phone into the field in one tap, and then show them the
 * households they started and never finished — which is the only backlog a
 * councillor actually owns.
 */
export default function MyWork() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/fieldwork/summary')
      .then((res) => setSummary(res.data.data))
      .catch((err) => setError(loadErrorMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  const stats = [
    { label: 'Households captured', value: summary?.captured ?? 0, icon: 'users' },
    { label: 'Awaiting a decision', value: summary?.pending ?? 0, icon: 'clock' },
    { label: 'Approved', value: summary?.approved ?? 0, icon: 'check' },
    { label: 'In the last 30 days', value: summary?.last30Days ?? 0, icon: 'trending' },
  ];

  return (
    <AdminLayout
      title={`Good day, ${user?.firstName || 'Councillor'}`}
      description={
        summary?.ward
          ? `You are capturing for ${summary.ward}.`
          : 'You are capturing applications on behalf of residents.'
      }
    >
      <LoadError message={error} />

      <div className="hero-action">
        <div>
          <h2>Out in the field?</h2>
          <p className="muted">
            Check whether the household is already registered, then capture their application with them.
          </p>
        </div>
        <button type="button" className="btn btn-primary btn-lg" onClick={() => navigate('/capture')}>
          <Icon name="userPlus" size={18} /> Register a household
        </button>
      </div>

      <div className="stats-grid">
        {stats.map((s) => (
          <div key={s.label} className="stat-card">
            <span className="stat-icon"><Icon name={s.icon} size={18} /></span>
            <div>
              <span className="stat-value">{loading ? '—' : s.value}</span>
              <span className="stat-label">{s.label}</span>
            </div>
          </div>
        ))}
      </div>

      <section className="panel">
        <div className="panel-header">
          <h2>Unfinished captures</h2>
          <p className="muted">
            Households you started but never submitted. Until one is submitted, nobody is reviewing it.
          </p>
        </div>

        {loading ? (
          <div className="loading"><span className="spinner" /> Loading…</div>
        ) : summary?.unfinished?.length ? (
          <ul className="doc-list">
            {summary.unfinished.map((item) => (
              <li key={item.id}>
                <div>
                  <strong>{item.name}</strong>
                  <small className="muted">
                    Started {new Date(item.capturedAt).toLocaleDateString('en-ZA')}
                  </small>
                </div>
                <Link className="btn btn-sm" to={`/applications/${item.id}/capture`}>
                  <Icon name="edit" size={14} /> Continue
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="table-empty">
            <Icon name="check" size={28} />
            <p>Nothing unfinished. Every household you have started has been submitted.</p>
          </div>
        )}
      </section>

      <div className="quick-links">
        <Link className="quick-link" to="/captures">
          <Icon name="applications" size={18} />
          <span><strong>My captures</strong><small>Everything you have registered, and where it stands</small></span>
        </Link>
        <Link className="quick-link" to="/profile">
          <Icon name="user" size={18} />
          <span><strong>My profile</strong><small>Your details and password</small></span>
        </Link>
      </div>
    </AdminLayout>
  );
}
