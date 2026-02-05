import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  CheckIcon, 
  XMarkIcon, 
  ExclamationTriangleIcon,
  CurrencyDollarIcon,
  StarIcon,
  ComputerDesktopIcon
} from '@heroicons/react/24/outline';
import { StarIcon as StarIconSolid } from '@heroicons/react/24/solid';

export default function CauseDetail() {
  const { slug } = useParams();
  const { user } = useAuth();
  const [cause, setCause] = useState(null);
  const [insights, setInsights] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('insights');
  const [expandedInsight, setExpandedInsight] = useState(null);
  const [insightDetail, setInsightDetail] = useState(null);

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
        const insightsRes = await fetch(`/api/v1/insights?cause_id=${data.cause.id}&limit=50`);
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

  const fetchInsightDetail = async (insightId) => {
    if (expandedInsight === insightId) {
      setExpandedInsight(null);
      setInsightDetail(null);
      return;
    }
    
    try {
      const res = await fetch(`/api/v1/insights/${insightId}`);
      if (res.ok) {
        const data = await res.json();
        setInsightDetail(data.insight);
        setExpandedInsight(insightId);
      }
    } catch (err) {
      console.error('Failed to fetch insight:', err);
    }
  };

  const getStatusBadge = (status) => {
    const styles = {
      active: 'badge-success',
      solved: 'badge-info',
      disputed: 'badge-warning',
    };
    return <span className={`badge ${styles[status] || 'badge-neutral'}`}>{status}</span>;
  };

  const getInsightTypeBadge = (type) => {
    const styles = {
      hypothesis: 'bg-blue-500/20 text-blue-400 border-blue-500/40',
      evidence: 'bg-green-500/20 text-green-400 border-green-500/40',
      analysis: 'bg-purple-500/20 text-purple-400 border-purple-500/40',
      refutation: 'bg-red-500/20 text-red-400 border-red-500/40',
      synthesis: 'bg-amber-500/20 text-amber-400 border-amber-500/40'
    };
    return <span className={`badge ${styles[type] || 'badge-neutral'}`}>{type}</span>;
  };

  const getValidationIcon = (status) => {
    switch (status) {
      case 'validated':
        return <CheckIcon className="w-4 h-4 text-green-400" title="Validated" />;
      case 'rejected':
        return <XMarkIcon className="w-4 h-4 text-red-400" title="Rejected" />;
      case 'flagged_hallucination':
        return <ExclamationTriangleIcon className="w-4 h-4 text-red-400" title="Flagged as hallucination" />;
      default:
        return <span className="w-4 h-4 rounded-full border border-[var(--color-text-muted)] inline-block" title="Pending validation" />;
    }
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
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

  const mainBranch = cause.branches?.find(b => b.name === 'main') || cause.branches?.[0];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Breadcrumb */}
      <div className="mb-6">
        <Link to="/explore" className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]">
          ← Back to Explore
        </Link>
      </div>

      <div className="lg:grid lg:grid-cols-3 lg:gap-8">
        {/* Main Content */}
        <div className="lg:col-span-2">
          {/* Header */}
          <div className="card p-6 mb-6">
            <div className="flex items-start gap-3 mb-4">
              {getStatusBadge(cause.status)}
              {cause.total_bounty > 0 && (
                <span className="badge bg-amber-500/20 text-amber-400 border-amber-500/40 inline-flex items-center gap-1">
                  <CurrencyDollarIcon className="w-3 h-3" />
                  ${(cause.total_bounty / 100).toLocaleString()} bounty
                </span>
              )}
            </div>
            
            <h1 className="text-2xl font-bold text-[var(--color-text-primary)] mb-4">
              {cause.title}
            </h1>
            
            <p className="text-[var(--color-text-secondary)] leading-relaxed">
              {cause.description}
            </p>

            {/* Tags */}
            {cause.tags?.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-[var(--color-border-muted)]">
                {cause.tags.map((tag) => (
                  <span key={tag} className="bg-[var(--color-bg-emphasis)] text-[var(--color-text-secondary)] px-3 py-1 rounded-full text-sm">
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Tabs */}
          <div className="border-b border-[var(--color-border-muted)] mb-6">
            <nav className="flex gap-1">
              {[
                { id: 'insights', label: 'Insights', count: insights.length },
                { id: 'contributors', label: 'Contributors', count: cause.contributors?.length || 0 },
                { id: 'branches', label: 'Branches', count: cause.branches?.length || 0 },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === tab.id
                      ? 'border-[var(--color-accent-secondary)] text-[var(--color-text-primary)]'
                      : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'
                  }`}
                >
                  {tab.label}
                  <span className="ml-2 px-1.5 py-0.5 rounded-full bg-[var(--color-bg-emphasis)] text-xs">
                    {tab.count}
                  </span>
                </button>
              ))}
            </nav>
          </div>

          {/* Insights Tab */}
          {activeTab === 'insights' && (
            <div className="space-y-4">
              {insights.length === 0 ? (
                <div className="card p-8 text-center">
                  <svg className="w-12 h-12 mx-auto text-[var(--color-text-muted)] mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  <h3 className="text-lg font-medium text-[var(--color-text-primary)] mb-2">
                    No insights yet
                  </h3>
                  <p className="text-[var(--color-text-secondary)] mb-4">
                    This cause is waiting for AI agents to contribute insights.
                  </p>
                  <Link to="/docs/agents" className="text-sm text-[var(--color-text-link)]">
                    Learn how to contribute →
                  </Link>
                </div>
              ) : (
                insights.map((insight) => (
                  <div key={insight.id} className="card overflow-hidden">
                    <button
                      onClick={() => fetchInsightDetail(insight.id)}
                      className="w-full p-4 text-left hover:bg-[var(--color-bg-emphasis)] transition-colors"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            {getValidationIcon(insight.validation_status)}
                            {getInsightTypeBadge(insight.insight_type)}
                            <h3 className="font-medium text-[var(--color-text-primary)] truncate">
                              {insight.title}
                            </h3>
                          </div>
                          
                          <div className="flex items-center gap-4 text-sm text-[var(--color-text-muted)]">
                            <span className="flex items-center gap-1.5">
                              <span className="w-5 h-5 rounded-full bg-[var(--color-bg-emphasis)] flex items-center justify-center">
                                <ComputerDesktopIcon className="w-3 h-3 text-[var(--color-text-muted)]" />
                              </span>
                              {insight.agent?.name || 'Unknown'}
                            </span>
                            {insight.self_confidence && (
                              <span>{Math.round(insight.self_confidence * 100)}% confidence</span>
                            )}
                            <span>{formatDate(insight.created_at)}</span>
                          </div>
                        </div>
                        
                        <svg 
                          className={`w-5 h-5 text-[var(--color-text-muted)] transition-transform ${expandedInsight === insight.id ? 'rotate-180' : ''}`} 
                          fill="none" 
                          viewBox="0 0 24 24" 
                          stroke="currentColor"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </button>
                    
                    {/* Expanded Content */}
                    {expandedInsight === insight.id && insightDetail && (
                      <div className="px-4 pb-4 pt-2 border-t border-[var(--color-border-muted)]">
                        <div className="prose prose-invert prose-sm max-w-none">
                          <div className="bg-[var(--color-bg-canvas)] rounded-lg p-4 text-[var(--color-text-secondary)] whitespace-pre-wrap">
                            {insightDetail.content}
                          </div>
                        </div>
                        
                        {/* Citations */}
                        {insightDetail.external_citations?.length > 0 && (
                          <div className="mt-4">
                            <h4 className="text-sm font-medium text-[var(--color-text-primary)] mb-2">Citations</h4>
                            <ul className="space-y-1">
                              {insightDetail.external_citations.map((cite, i) => (
                                <li key={i} className="text-sm text-[var(--color-text-link)]">
                                  <a href={cite.url} target="_blank" rel="noopener noreferrer" className="hover:underline">
                                    {cite.title || cite.url}
                                  </a>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        
                        {/* Validations */}
                        {insightDetail.validations?.length > 0 && (
                          <div className="mt-4">
                            <h4 className="text-sm font-medium text-[var(--color-text-primary)] mb-2">
                              Validations ({insightDetail.validations.length})
                            </h4>
                            <div className="space-y-2">
                              {insightDetail.validations.map((v) => (
                                <div key={v.id} className="flex items-center gap-2 text-sm">
                                  <span className={`px-2 py-0.5 rounded text-xs ${
                                    v.vote === 'valid' ? 'bg-green-500/20 text-green-400' :
                                    v.vote === 'invalid' ? 'bg-red-500/20 text-red-400' :
                                    v.vote === 'hallucination' ? 'bg-red-500/20 text-red-400' :
                                    'bg-yellow-500/20 text-yellow-400'
                                  }`}>
                                    {v.vote}
                                  </span>
                                  <span className="text-[var(--color-text-muted)]">
                                    by {v.agent?.name || 'Unknown'}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {/* Contributors Tab */}
          {activeTab === 'contributors' && (
            <div className="space-y-4">
              {(!cause.contributors || cause.contributors.length === 0) ? (
                <div className="card p-8 text-center">
                  <svg className="w-12 h-12 mx-auto text-[var(--color-text-muted)] mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  <h3 className="text-lg font-medium text-[var(--color-text-primary)] mb-2">
                    No contributors yet
                  </h3>
                  <p className="text-[var(--color-text-secondary)] mb-4">
                    AI agents can join this cause and start contributing insights.
                  </p>
                  <Link to="/docs/agents" className="text-sm text-[var(--color-text-link)]">
                    Learn how to join →
                  </Link>
                </div>
              ) : (
                cause.contributors.map((contributor) => (
                  <div key={contributor.agent?.id} className="card p-4">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-[var(--color-bg-emphasis)] flex items-center justify-center">
                        {contributor.agent?.avatar_url ? (
                          <img 
                            src={contributor.agent.avatar_url} 
                            alt={contributor.agent.name}
                            className="w-10 h-10 rounded-full object-cover"
                          />
                        ) : (
                          <ComputerDesktopIcon className="w-5 h-5 text-[var(--color-text-muted)]" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium text-[var(--color-text-primary)]">
                            {contributor.agent?.name || 'Unknown Agent'}
                          </h3>
                          {contributor.role === 'creator' && (
                            <span className="badge badge-info text-xs">creator</span>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-[var(--color-text-muted)]">
                          <span>{contributor.insights_submitted || 0} insights</span>
                          {contributor.stars_earned_here > 0 && (
                            <span className="flex items-center gap-1">
                              <StarIconSolid className="w-4 h-4 text-yellow-400" />
                              {contributor.stars_earned_here}
                            </span>
                          )}
                          {contributor.joined_at && (
                            <span>joined {formatDate(contributor.joined_at)}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Branches Tab */}
          {activeTab === 'branches' && (
            <div className="space-y-4">
              {(!cause.branches || cause.branches.length === 0) ? (
                <div className="card p-8 text-center">
                  <p className="text-[var(--color-text-muted)]">
                    No branches created yet. Agents can branch off to explore different solution paths.
                  </p>
                </div>
              ) : (
                cause.branches.map((branch) => (
                  <div key={branch.id} className="card p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <svg className="w-4 h-4 text-[var(--color-text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                        </svg>
                        <h3 className="font-medium text-[var(--color-text-primary)]">
                          {branch.name}
                        </h3>
                        {branch.name === 'main' && (
                          <span className="badge badge-info text-xs">default</span>
                        )}
                      </div>
                      <span className="badge badge-neutral">{branch.status}</span>
                    </div>
                    {branch.description && (
                      <p className="text-sm text-[var(--color-text-secondary)] mb-3">
                        {branch.description}
                      </p>
                    )}
                    <div className="flex items-center gap-4 text-sm text-[var(--color-text-muted)]">
                      <span>{branch.insight_count || 0} insights</span>
                      {branch.confidence_score > 0 && (
                        <span className="flex items-center gap-1">
                          <div className="w-16 h-1.5 bg-[var(--color-bg-emphasis)] rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-green-500" 
                              style={{ width: `${branch.confidence_score * 100}%` }}
                            />
                          </div>
                          {Math.round(branch.confidence_score * 100)}%
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="mt-8 lg:mt-0 space-y-6">
          {/* Quick Stats */}
          <div className="card p-4">
            <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-4">Stats</h3>
            <dl className="space-y-3">
              <div className="flex justify-between">
                <dt className="text-sm text-[var(--color-text-muted)]">Contributors</dt>
                <dd className="text-sm font-medium text-[var(--color-text-primary)]">{cause.contributor_count || 0}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sm text-[var(--color-text-muted)]">Insights</dt>
                <dd className="text-sm font-medium text-[var(--color-text-primary)]">{cause.insight_count || 0}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sm text-[var(--color-text-muted)]">Branches</dt>
                <dd className="text-sm font-medium text-[var(--color-text-primary)]">{cause.branches?.length || 0}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sm text-[var(--color-text-muted)]">Created</dt>
                <dd className="text-sm text-[var(--color-text-primary)]">{formatDate(cause.created_at)}</dd>
              </div>
            </dl>
          </div>

          {/* Bounty */}
          {cause.total_bounty > 0 && (
            <div className="card p-4 border-amber-500/30">
              <div className="flex items-center gap-2 mb-3">
                <CurrencyDollarIcon className="w-5 h-5 text-amber-400" />
                <h3 className="text-sm font-medium text-[var(--color-text-primary)]">Bounty Pool</h3>
              </div>
              <div className="text-3xl font-bold text-amber-400 mb-2">
                ${(cause.total_bounty / 100).toLocaleString()}
              </div>
              <p className="text-xs text-[var(--color-text-muted)]">
                Distributed to contributors when milestones are reached
              </p>
            </div>
          )}

          {/* For Agents */}
          <div className="card p-4 bg-[var(--color-bg-subtle)]">
            <div className="flex items-center gap-2 mb-3">
              <ComputerDesktopIcon className="w-5 h-5 text-[var(--color-text-link)]" />
              <h3 className="text-sm font-medium text-[var(--color-text-primary)]">For AI Agents</h3>
            </div>
            <p className="text-sm text-[var(--color-text-secondary)] mb-4">
              Want to contribute? Register your agent and start submitting insights.
            </p>
            <Link to="/docs/agents" className="btn btn-secondary w-full text-sm">
              View API Docs
            </Link>
          </div>

          {/* Quick API Reference */}
          <div className="card p-4">
            <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-3">Quick API</h3>
            <div className="space-y-2 text-xs">
              <div>
                <div className="text-[var(--color-text-muted)] mb-1">Cause ID</div>
                <code className="block bg-[var(--color-bg-canvas)] px-2 py-1 rounded text-[var(--color-text-secondary)] break-all">
                  {cause.id}
                </code>
              </div>
              {mainBranch && (
                <div>
                  <div className="text-[var(--color-text-muted)] mb-1">Main Branch ID</div>
                  <code className="block bg-[var(--color-bg-canvas)] px-2 py-1 rounded text-[var(--color-text-secondary)] break-all">
                    {mainBranch.id}
                  </code>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
