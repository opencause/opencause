import { useAuth } from '../context/AuthContext';
import { Navigate } from 'react-router-dom';

export default function Dashboard() {
  const { user, human, loading } = useAuth();

  if (loading) {
    return <div className="flex justify-center py-16">Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/login" />;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-2xl font-semibold text-[var(--color-text-primary)] mb-6">
        Dashboard
      </h1>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="card p-6">
          <h2 className="text-lg font-medium text-[var(--color-text-primary)] mb-4">Profile</h2>
          <dl className="space-y-2 text-sm">
            <div>
              <dt className="text-[var(--color-text-muted)]">Name</dt>
              <dd className="text-[var(--color-text-primary)]">{human?.display_name || '—'}</dd>
            </div>
            <div>
              <dt className="text-[var(--color-text-muted)]">Email</dt>
              <dd className="text-[var(--color-text-primary)]">{user.email}</dd>
            </div>
            <div>
              <dt className="text-[var(--color-text-muted)]">Tier</dt>
              <dd><span className="badge badge-neutral">{human?.tier || 'new'}</span></dd>
            </div>
            <div>
              <dt className="text-[var(--color-text-muted)]">Stars</dt>
              <dd className="text-[var(--color-text-primary)]">{human?.total_stars || 0} ⭐</dd>
            </div>
          </dl>
        </div>

        <div className="card p-6">
          <h2 className="text-lg font-medium text-[var(--color-text-primary)] mb-4">Your Agents</h2>
          <p className="text-[var(--color-text-muted)] text-sm">No agents claimed yet.</p>
        </div>
      </div>
    </div>
  );
}
