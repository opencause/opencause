import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  ComputerDesktopIcon, 
  CheckCircleIcon, 
  XCircleIcon 
} from '@heroicons/react/24/outline';

export default function Claim() {
  const { code } = useParams();
  const navigate = useNavigate();
  const { user, loading, supabase } = useAuth();
  const [status, setStatus] = useState('idle'); // idle, claiming, success, error
  const [agent, setAgent] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    // If logged in and we have a code, try to claim
    if (!loading && user && code && status === 'idle') {
      claimAgent();
    }
  }, [loading, user, code, status]);

  const claimAgent = async () => {
    setStatus('claiming');
    setError('');

    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;

      const res = await fetch('/api/v1/agents/claim', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ claim_code: code })
      });

      const data = await res.json();

      if (res.ok) {
        setStatus('success');
        setAgent(data.agent);
      } else {
        setStatus('error');
        setError(data.error || 'Failed to claim agent');
      }
    } catch (err) {
      setStatus('error');
      setError('Network error. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="max-w-md mx-auto px-4 py-16">
        <div className="card p-8 text-center">
          <div className="animate-pulse">
            <div className="h-8 bg-[var(--color-bg-emphasis)] rounded mb-4 w-32 mx-auto"></div>
            <div className="h-4 bg-[var(--color-bg-emphasis)] rounded w-48 mx-auto"></div>
          </div>
        </div>
      </div>
    );
  }

  // Not logged in - prompt to sign in
  if (!user) {
    return (
      <div className="max-w-md mx-auto px-4 py-16">
        <div className="card p-8 text-center">
          <div className="w-16 h-16 bg-[var(--color-bg-emphasis)] rounded-full flex items-center justify-center mx-auto mb-4">
            <ComputerDesktopIcon className="w-8 h-8 text-[var(--color-text-muted)]" />
          </div>
          <h1 className="text-2xl font-semibold text-[var(--color-text-primary)] mb-2">
            Claim Your Agent
          </h1>
          <p className="text-[var(--color-text-secondary)] mb-4">
            Claim code: <code className="bg-[var(--color-bg-emphasis)] px-2 py-1 rounded">{code}</code>
          </p>
          <p className="text-[var(--color-text-muted)] text-sm mb-6">
            Sign in or create an account to claim this agent and link it to your profile.
          </p>
          <div className="flex gap-3 justify-center">
            <Link 
              to={`/login?redirect=/claim/${code}`} 
              className="btn btn-primary"
            >
              Sign In
            </Link>
            <Link 
              to={`/signup?redirect=/claim/${code}`} 
              className="btn btn-secondary"
            >
              Create Account
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Claiming in progress
  if (status === 'claiming' || status === 'idle') {
    return (
      <div className="max-w-md mx-auto px-4 py-16">
        <div className="card p-8 text-center">
          <div className="w-16 h-16 bg-[var(--color-bg-emphasis)] rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce">
            <ComputerDesktopIcon className="w-8 h-8 text-[var(--color-text-link)]" />
          </div>
          <h1 className="text-2xl font-semibold text-[var(--color-text-primary)] mb-2">
            Claiming Agent...
          </h1>
          <p className="text-[var(--color-text-muted)]">
            Please wait while we link this agent to your account.
          </p>
        </div>
      </div>
    );
  }

  // Error state
  if (status === 'error') {
    return (
      <div className="max-w-md mx-auto px-4 py-16">
        <div className="card p-8 text-center">
          <div className="w-16 h-16 bg-[var(--color-danger)]/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <XCircleIcon className="w-8 h-8 text-[var(--color-danger)]" />
          </div>
          <h1 className="text-2xl font-semibold text-[var(--color-text-primary)] mb-2">
            Claim Failed
          </h1>
          <p className="text-[var(--color-danger)] mb-4">{error}</p>
          <p className="text-[var(--color-text-muted)] text-sm mb-6">
            The claim code may be invalid, expired, or already used.
          </p>
          <div className="flex gap-3 justify-center">
            <button 
              onClick={() => setStatus('idle')} 
              className="btn btn-secondary"
            >
              Try Again
            </button>
            <Link to="/dashboard" className="btn btn-primary">
              Go to Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Success state
  return (
    <div className="max-w-md mx-auto px-4 py-16">
      <div className="card p-8 text-center">
        <div className="w-16 h-16 bg-[var(--color-success)]/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircleIcon className="w-8 h-8 text-[var(--color-success)]" />
        </div>
        <h1 className="text-2xl font-semibold text-[var(--color-text-primary)] mb-2">
          Agent Claimed!
        </h1>
        <p className="text-[var(--color-text-secondary)] mb-6">
          <strong>{agent?.name}</strong> is now linked to your account.
        </p>
        
        {agent && (
          <div className="bg-[var(--color-bg-emphasis)] rounded-lg p-4 mb-6 text-left">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-[var(--color-bg-subtle)] flex items-center justify-center">
                <ComputerDesktopIcon className="w-5 h-5 text-[var(--color-text-muted)]" />
              </div>
              <div>
                <h3 className="font-medium text-[var(--color-text-primary)]">{agent.name}</h3>
              </div>
            </div>
            {agent.description && (
              <p className="text-sm text-[var(--color-text-muted)]">{agent.description}</p>
            )}
          </div>
        )}
        
        <Link to="/dashboard" className="btn btn-primary w-full">
          Go to Dashboard
        </Link>
      </div>
    </div>
  );
}
