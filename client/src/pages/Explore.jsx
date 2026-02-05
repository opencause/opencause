import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CurrencyDollarIcon } from '@heroicons/react/24/outline';

// Common categories for causes
const CATEGORIES = [
  { value: 'all', label: 'All Categories' },
  { value: 'healthcare', label: 'Healthcare' },
  { value: 'environment', label: 'Environment' },
  { value: 'technology', label: 'Technology' },
  { value: 'finance', label: 'Finance' },
  { value: 'education', label: 'Education' },
  { value: 'infrastructure', label: 'Infrastructure' },
  { value: 'social', label: 'Social Impact' },
];

export default function Explore() {
  const [searchParams] = useSearchParams();
  const searchQuery = searchParams.get('q') || '';
  
  const [causes, setCauses] = useState([]);
  const [featuredCauses, setFeaturedCauses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [category, setCategory] = useState('all');
  const [sort, setSort] = useState('newest');

  useEffect(() => {
    fetchCauses();
  }, [filter, category, sort, searchQuery]);

  // Fetch featured causes (with bounties) on initial load
  useEffect(() => {
    if (!searchQuery) {
      fetchFeaturedCauses();
    }
  }, []);

  const fetchFeaturedCauses = async () => {
    try {
      const res = await fetch('/api/v1/causes?sort=bounty&limit=3&has_bounty=true');
      if (res.ok) {
        const data = await res.json();
        setFeaturedCauses(data.causes || []);
      }
    } catch (err) {
      console.error('Failed to fetch featured causes:', err);
    }
  };

  const fetchCauses = async () => {
    setLoading(true);
    
    try {
      const params = new URLSearchParams({ sort, limit: '20' });
      if (filter !== 'all') {
        params.set('status', filter);
      }
      if (category !== 'all') {
        params.set('category', category);
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
            <Link to="/explore" className="text-sm text-[var(--color-text-link)] mt-1 inline-block">
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

      {/* Featured Causes - Only show when not searching */}
      {!searchQuery && featuredCauses.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <CurrencyDollarIcon className="w-5 h-5 text-amber-400" />
            <h2 className="text-lg font-medium text-[var(--color-text-primary)]">Featured Bounties</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            {featuredCauses.map((cause) => (
              <Link 
                key={cause.id} 
                to={`/causes/${cause.slug}`}
                className="card p-4 border-amber-500/30 hover:border-amber-500/60 hover:bg-[var(--color-bg-emphasis)] transition-all duration-150"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="text-sm font-semibold text-[var(--color-text-primary)] line-clamp-2">
                    {cause.title}
                  </h3>
                  <span className="badge bg-amber-500/20 text-amber-400 border-amber-500/40 flex-shrink-0 inline-flex items-center gap-1">
                    <CurrencyDollarIcon className="w-3 h-3" />
                    ${(cause.total_bounty / 100).toLocaleString()}
                  </span>
                </div>
                <p className="text-xs text-[var(--color-text-muted)] line-clamp-2">
                  {cause.description}
                </p>
                <div className="flex items-center gap-3 mt-3 text-xs text-[var(--color-text-muted)]">
                  <span>{cause.contributor_count} contributors</span>
                  <span>{cause.insight_count} insights</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row flex-wrap gap-4 mb-6">
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
          <label className="text-sm text-[var(--color-text-muted)]">Category:</label>
          <select 
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="input text-sm py-1"
          >
            {CATEGORIES.map(cat => (
              <option key={cat.value} value={cat.value}>{cat.label}</option>
            ))}
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
            <option value="bounty">Highest Bounty</option>
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
            {searchQuery || category !== 'all' || filter !== 'all' ? 'No matching causes' : 'No causes yet'}
          </h3>
          <p className="text-[var(--color-text-secondary)] mb-6">
            {searchQuery || category !== 'all' || filter !== 'all' 
              ? 'Try adjusting your filters or search terms.'
              : 'Be the first to pose a problem for the collective to solve.'
            }
          </p>
          {!searchQuery && category === 'all' && filter === 'all' && (
            <Link to="/causes/new" className="btn btn-primary">
              Create First Cause
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {causes.map((cause) => (
            <Link 
              key={cause.id} 
              to={`/causes/${cause.slug}`}
              className="card p-4 block hover:bg-[var(--color-bg-emphasis)] hover:border-[var(--color-border-active)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent-secondary)] focus:ring-offset-2 focus:ring-offset-[var(--color-bg-canvas)] transition-all duration-150"
            >
              <div className="flex items-start gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h3 className="text-base font-semibold text-[var(--color-text-primary)] truncate">
                      {cause.title}
                    </h3>
                    {getStatusBadge(cause.status)}
                    {cause.total_bounty > 0 && (
                      <span className="badge bg-amber-500/20 text-amber-400 border-amber-500/40 inline-flex items-center gap-1">
                        <CurrencyDollarIcon className="w-3 h-3" />
                        ${(cause.total_bounty / 100).toLocaleString()}
                      </span>
                    )}
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
                          <span key={tag} className="bg-[var(--color-bg-emphasis)] text-[var(--color-text-secondary)] px-2 py-0.5 rounded-full truncate max-w-[100px]">
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
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
