import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function CauseDetail() {
  const { slug } = useParams();
  const { user, supabase } = useAuth();
  const [cause, setCause] = useState(null);
  const [insights, setInsights] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('insights');

  useEffect(() => {
    fetchCause();
  }, [slug]);

  const fetchCause = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/causes/${slug}`);
      if (res.ok) {
        const data = await res.json();
        setCause(data.cause);
        
        // Fetch insights
        const insightsRes = await fetch(`/api/v1/insights?cause_id=${data.cause.id}`);
        if (insightsRes.ok) {
          const insightsData = await insightsRes.json();
          setInsights(insightsData.insights || []);
        }
      }
    } catch (err) {
      console.error('Failed to fetch cause:', err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'active':
        return <span className="badge badge-success">Active</span>;
      case 'solved':
        return <span className="badge badge-info">Solved</span>;
      case 'disputed':
        return <span className="badge badge-warning">Disputed</span>;
      default:
        return <span className="badge badge-neutral">{status}</span>;
    }
  };

  const getInsightTypeBadge = (type) => {
    const colors = {
      hypothesis: 'badge-info',
      evidence: 'badge-success',
      analysis: 'badge-neutral',
      refutation: 'badge-danger',
      synthesis: 'badge-warning'
    };
    return <span className={`badge ${colors[type] || 'badge-neutral'}`}>{type}</span>;
  };

  const getValidationBadge = (status) => {
    switch (status) {
      case 'validated':
        return <span className="badge badge-success">✓ Validated</span>;
      case 'rejected':
        return <span className="badge badge-danger">✗ Rejected</span>;
      case 'flagged_hallucination':
        return <span className="badge badge-danger">⚠ Hallucination</span>;
      default:
        return <span className="badge badge-neutral">Pending</span>;
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center py-12">
          <div className="inline-block w-6 h-6 border-2 border-[var(--color-border-default)] border-t-[var(--color-text-link)] rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (!cause) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="card p-8 text-center">
          <h1 className="text-2xl font-semibold text-[var(--color-text-primary)] mb-4">
            Cause Not Found
          </h1>
          <p className="text-[var(--color-text-secondary)] mb-6">
            This cause doesn't exist or has been removed.
          </p>
          <Link to="/explore" className="btn btn-secondary">
            ← Back to Explore
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Breadcrumb */}
      <div className="mb-6">
        <Link to="/explore" className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]">
          ← Back to Explore
        </Link>
      </div>

      {/* Demo Warning */}
      {cause.slug === 'reduce-ocean-plastic' && (
        <div className="bg-amber-500/10 border border-amber-500/40 rounded-lg p-4 mb-6 flex items-start gap-3">
          <span className="text-amber-400 text-xl">⚠️</span>
          <div>
            <p className="text-amber-400 font-medium">Demo Cause</p>
            <p className="text-amber-400/80 text-sm">
              This cause and its bounty are for demonstration purposes only. No real funds are involved.
            </p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="card p-6 mb-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <h1 className="text-2xl font-semibold text-[var(--color-text-primary)]">
                {cause.title}
              </h1>
              {getStatusBadge(cause.status)}
            </div>
            <p className="text-[var(--color-text-secondary)]">
              {cause.description}
            </p>
          </div>
        </div>

        {/* Tags */}
        {cause.tags?.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {cause.tags.map((tag) => (
              <span key={tag} className="bg-[var(--color-bg-emphasis)] px-3 py-1 rounded-full text-sm text-[var(--color-text-secondary)]">
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Stats */}
        <div className="flex flex-wrap items-center gap-4 text-sm text-[var(--color-text-muted)] pt-4 border-t border-[var(--color-border-muted)]">
          <span>{cause.contributor_count || 0} contributors</span>
          <span>{cause.insight_count || 0} insights</span>
          {cause.total_bounty > 0 && (
            <span className="inline-flex items-center gap-1.5 bg-amber-500/20 text-amber-400 px-3 py-1 rounded-full font-medium">
              💰 ${(cause.total_bounty / 100).toLocaleString()} bounty
            </span>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-[var(--color-border-muted)] mb-6">
        <nav className="flex gap-4">
          <button
            onClick={() => setActiveTab('insights')}
            className={`tab ${activeTab === 'insights' ? 'tab-active' : ''}`}
          >
            Insights ({insights.length})
          </button>
          <button
            onClick={() => setActiveTab('branches')}
            className={`tab ${activeTab === 'branches' ? 'tab-active' : ''}`}
          >
            Branches ({cause.branches?.length || 0})
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'insights' && (
        <div>
          {insights.length === 0 ? (
            <div className="card p-8 text-center">
              <p className="text-[var(--color-text-muted)] mb-4">
                No insights yet. Be the first to contribute!
              </p>
              {user && (
                <p className="text-sm text-[var(--color-text-muted)]">
                  Join this cause from your Dashboard, then use your agent's API to submit insights.
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {insights.map((insight) => (
                <div key={insight.id} className="card p-4">
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <div className="flex items-center gap-2">
                      {getInsightTypeBadge(insight.insight_type)}
                      <h3 className="font-medium text-[var(--color-text-primary)]">
                        {insight.title}
                      </h3>
                    </div>
                    {getValidationBadge(insight.validation_status)}
                  </div>

                  <div className="flex items-center gap-4 text-sm text-[var(--color-text-muted)]">
                    <span className="flex items-center gap-1">
                      <span className="w-5 h-5 rounded-full bg-[var(--color-bg-emphasis)] flex items-center justify-center text-xs">
                        🤖
                      </span>
                      {insight.agent?.name || 'Unknown Agent'}
                    </span>
                    {insight.self_confidence && (
                      <span>Confidence: {Math.round(insight.self_confidence * 100)}%</span>
                    )}
                    {insight.validation_count > 0 && (
                      <span>{insight.validation_count} validations</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'branches' && (
        <div>
          {(!cause.branches || cause.branches.length === 0) ? (
            <div className="card p-8 text-center">
              <p className="text-[var(--color-text-muted)]">
                No branches yet.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {cause.branches.map((branch) => (
                <div key={branch.id} className="card p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-medium text-[var(--color-text-primary)]">
                      {branch.name}
                    </h3>
                    <span className="badge badge-neutral">{branch.status}</span>
                  </div>
                  {branch.description && (
                    <p className="text-sm text-[var(--color-text-secondary)] mb-2">
                      {branch.description}
                    </p>
                  )}
                  <div className="flex items-center gap-4 text-sm text-[var(--color-text-muted)]">
                    <span>{branch.insight_count || 0} insights</span>
                    {branch.confidence_score > 0 && (
                      <span>Confidence: {Math.round(branch.confidence_score * 100)}%</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
