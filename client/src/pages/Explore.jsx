import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

export default function Explore() {
  const [searchParams] = useSearchParams();
  const searchQuery = searchParams.get('q') || '';
  
  const [causes, setCauses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [sort, setSort] = useState('newest');

  useEffect(() => {
    fetchCauses();
  }, [filter, sort, searchQuery]);

  const fetchCauses = async () => {
    setLoading(true);
    
    try {
      const params = new URLSearchParams({ sort, limit: '20' });
      if (filter !== 'all') {
        params.set('status', filter);
      }
      if (searchQuery) {
        params.set('q', searchQuery);
      }
      
      const res = await fetch(`/api/v1/causes?${params}`);
      if (res.ok) {
        const data = await res.json();
        setCauses(data.causes || []);
      }
    } catch (err) {
      console.error('Failed to fetch causes:', err);
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

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--color-text-primary)]">
            {searchQuery ? `Search: "${searchQuery}"` : 'Explore Causes'}
          </h1>
          <p className="text-[var(--color-text-secondary)] mt-1">
            {searchQuery 
              ? `${causes.length} cause${causes.length !== 1 ? 's' : ''} found`
              : 'Problems waiting to be solved by collective intelligence'
            }
          </p>
          {searchQuery && (
            <Link to="/explore" className="text-sm text-[var(--color-text-link)] hover:underline mt-1 inline-block">
              ← Clear search
            </Link>
          )}
        </div>

        <Link to="/causes/new" className="btn btn-primary">
          <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Cause
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="flex items-center gap-2">
          <label className="text-sm text-[var(--color-text-muted)]">Status:</label>
          <select 
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="input text-sm py-1"
          >
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="solved">Solved</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm text-[var(--color-text-muted)]">Sort:</label>
          <select 
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="input text-sm py-1"
          >
            <option value="newest">Newest</option>
            <option value="popular">Most Contributors</option>
            <option value="active">Recently Active</option>
          </select>
        </div>
      </div>

      {/* Cause List */}
      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block w-6 h-6 border-2 border-[var(--color-border-default)] border-t-[var(--color-text-link)] rounded-full animate-spin" />
        </div>
      ) : causes.length === 0 ? (
        <div className="card p-12 text-center">
          <svg className="w-12 h-12 mx-auto text-[var(--color-text-muted)] mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
          <h3 className="text-lg font-medium text-[var(--color-text-primary)] mb-2">
            No causes yet
          </h3>
          <p className="text-[var(--color-text-secondary)] mb-6">
            Be the first to pose a problem for the collective to solve.
          </p>
          <Link to="/causes/new" className="btn btn-primary">
            Create First Cause
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {causes.map((cause) => (
            <Link 
              key={cause.id} 
              to={`/causes/${cause.slug}`}
              className="card p-4 block hover:border-[var(--color-border-default)] transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-base font-semibold text-[var(--color-text-link)] truncate">
                      {cause.title}
                    </h3>
                    {getStatusBadge(cause.status)}
                  </div>
                  
                  <p className="text-sm text-[var(--color-text-secondary)] line-clamp-2 mb-3">
                    {cause.description}
                  </p>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-[var(--color-text-muted)]">
                    <span className="flex items-center gap-1 flex-shrink-0">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      {cause.contributor_count} contributors
                    </span>
                    <span className="flex items-center gap-1 flex-shrink-0">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      {cause.insight_count} insights
                    </span>
                    {cause.tags?.length > 0 && (
                      <div className="hidden sm:flex items-center gap-1 flex-wrap">
                        {cause.tags.slice(0, 2).map((tag) => (
                          <span key={tag} className="bg-[var(--color-bg-emphasis)] px-2 py-0.5 rounded-full truncate max-w-[100px]">
                            {tag}
                          </span>
                        ))}
                        {cause.tags.length > 2 && (
                          <span className="text-[var(--color-text-muted)]">+{cause.tags.length - 2}</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <svg className="w-5 h-5 text-[var(--color-text-muted)] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
