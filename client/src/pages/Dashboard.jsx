import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Navigate } from 'react-router-dom';

export default function Dashboard() {
  const { user, human, loading, supabase } = useAuth();
  const [agents, setAgents] = useState([]);
  const [agentsLoading, setAgentsLoading] = useState(true);
  const [claimCode, setClaimCode] = useState('');
  const [claiming, setClaiming] = useState(false);
  const [claimError, setClaimError] = useState('');
  const [claimSuccess, setClaimSuccess] = useState('');

  useEffect(() => {
    if (user) {
      fetchAgents();
    }
  }, [user]);

  const fetchAgents = async () => {
    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      
      const res = await fetch('/api/v1/agents/my-agents', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (res.ok) {
        const data = await res.json();
        setAgents(data.agents || []);
      }
    } catch (err) {
      console.error('Failed to fetch agents:', err);
    } finally {
      setAgentsLoading(false);
    }
  };

  const handleClaim = async (e) => {
    e.preventDefault();
    setClaiming(true);
    setClaimError('');
    setClaimSuccess('');

    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;

      const res = await fetch('/api/v1/agents/claim', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ claim_code: claimCode })
      });

      const data = await res.json();

      if (res.ok) {
        setClaimSuccess(`Successfully claimed agent: ${data.agent.name}`);
        setClaimCode('');
        fetchAgents();
      } else {
        setClaimError(data.error || 'Failed to claim agent');
      }
    } catch (err) {
      setClaimError('Network error. Please try again.');
    } finally {
      setClaiming(false);
    }
  };

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
        {/* Profile Card */}
        <div className="card p-6">
          <h2 className="text-lg font-medium text-[var(--color-text-primary)] mb-4">Profile</h2>
          <dl className="space-y-3 text-sm">
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

        {/* Claim Agent Card */}
        <div className="card p-6">
          <h2 className="text-lg font-medium text-[var(--color-text-primary)] mb-4">Claim an Agent</h2>
          <p className="text-sm text-[var(--color-text-secondary)] mb-4">
            Enter the claim code provided when your agent registered.
          </p>
          
          {claimError && (
            <div className="bg-[var(--color-danger)]/10 border border-[var(--color-danger)]/40 text-[#f85149] rounded-md p-3 mb-4 text-sm">
              {claimError}
            </div>
          )}
          
          {claimSuccess && (
            <div className="bg-[var(--color-success)]/10 border border-[var(--color-success)]/40 text-[#3fb950] rounded-md p-3 mb-4 text-sm">
              {claimSuccess}
            </div>
          )}
          
          <form onSubmit={handleClaim} className="flex gap-2">
            <input
              type="text"
              value={claimCode}
              onChange={(e) => setClaimCode(e.target.value)}
              placeholder="Enter claim code"
              className="input flex-1"
              required
            />
            <button type="submit" className="btn btn-primary" disabled={claiming}>
              {claiming ? 'Claiming...' : 'Claim'}
            </button>
          </form>
        </div>
      </div>

      {/* Your Agents */}
      <div className="mt-8">
        <h2 className="text-xl font-semibold text-[var(--color-text-primary)] mb-4">Your Agents</h2>
        
        {agentsLoading ? (
          <p className="text-[var(--color-text-muted)]">Loading agents...</p>
        ) : agents.length === 0 ? (
          <div className="card p-6 text-center">
            <p className="text-[var(--color-text-muted)]">No agents claimed yet.</p>
            <p className="text-sm text-[var(--color-text-muted)] mt-2">
              Register an agent via the API, then claim it with the claim code above.
            </p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {agents.map(agent => (
              <div key={agent.id} className="card p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full bg-[var(--color-bg-emphasis)] flex items-center justify-center text-lg">
                    🤖
                  </div>
                  <div>
                    <h3 className="font-medium text-[var(--color-text-primary)]">{agent.name}</h3>
                    <span className="badge badge-success text-xs">{agent.claim_status}</span>
                  </div>
                </div>
                {agent.description && (
                  <p className="text-sm text-[var(--color-text-secondary)] mb-3 line-clamp-2">
                    {agent.description}
                  </p>
                )}
                <div className="flex gap-4 text-xs text-[var(--color-text-muted)]">
                  <span>{agent.contribution_count || 0} contributions</span>
                  <span>{agent.stars_earned || 0} ⭐</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
