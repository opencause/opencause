import { useState, useEffect, useRef } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// Show full UI on OpenCause domains and localhost
const isFullUI = typeof window !== 'undefined' && 
  (window.location.hostname.includes('opencause') || window.location.hostname === 'localhost');

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const searchRef = useRef(null);

  // Debounced search
  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.length < 2) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }

    setIsSearching(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/v1/causes?q=${encodeURIComponent(searchQuery)}&limit=5`);
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data.causes || []);
          setShowDropdown(true);
        }
      } catch (err) {
        console.error('Search error:', err);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    setShowDropdown(false);
    if (searchQuery.trim()) {
      navigate(`/explore?q=${encodeURIComponent(searchQuery.trim())}`);
    } else {
      navigate('/explore');
    }
  };

  const handleResultClick = (slug) => {
    setShowDropdown(false);
    setSearchQuery('');
    navigate(`/causes/${slug}`);
  };

  return (
    <div className="min-h-screen bg-[var(--color-bg-canvas)]">
      {/* Header */}
      <header className="bg-[var(--color-bg-default)] border-b border-[var(--color-border-muted)] relative z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center gap-6">
              <Link to="/" className="flex items-center gap-2">
                <svg className="w-8 h-8 text-[var(--color-text-primary)]" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" 
                        stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span className="font-semibold text-[var(--color-text-primary)]">OpenCause</span>
              </Link>

              {/* Nav Links - only show in dev mode */}
              {isFullUI && (
                <nav className="hidden md:flex items-center gap-4">
                  <Link 
                    to="/explore" 
                    className={`text-sm ${location.pathname === '/explore' ? 'text-[var(--color-text-primary)]' : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'}`}
                  >
                    Explore
                  </Link>
                  <Link 
                    to="/leaderboard" 
                    className={`text-sm ${location.pathname === '/leaderboard' ? 'text-[var(--color-text-primary)]' : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'}`}
                  >
                    Leaderboard
                  </Link>
                  <Link 
                    to="/activity" 
                    className={`text-sm ${location.pathname === '/activity' ? 'text-[var(--color-text-primary)]' : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'}`}
                  >
                    Activity
                  </Link>
                </nav>
              )}
            </div>

            {/* Search - only in dev mode */}
            {isFullUI && (
              <div ref={searchRef} className="flex-1 max-w-md mx-4 hidden md:block relative">
                <form onSubmit={handleSearch}>
                  <div className="relative">
                    <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <input
                      type="text"
                      placeholder="Search causes..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onFocus={() => searchResults.length > 0 && setShowDropdown(true)}
                      className="input w-full text-sm pr-8"
                      style={{ paddingLeft: '30px' }}
                    />
                    {isSearching && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <div className="w-4 h-4 border-2 border-[var(--color-border-default)] border-t-[var(--color-text-link)] rounded-full animate-spin" />
                      </div>
                    )}
                  </div>
                </form>

                {/* Autocomplete Dropdown */}
                {showDropdown && searchResults.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-[var(--color-bg-default)] border border-[var(--color-border-default)] rounded-lg shadow-lg overflow-hidden z-50">
                    {searchResults.map((cause) => (
                      <button
                        key={cause.id}
                        onClick={() => handleResultClick(cause.slug)}
                        className="w-full px-4 py-3 text-left hover:bg-[var(--color-bg-emphasis)] transition-colors border-b border-[var(--color-border-muted)] last:border-b-0"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium text-[var(--color-text-primary)] truncate">
                              {cause.title}
                            </div>
                            <div className="text-xs text-[var(--color-text-muted)] truncate mt-0.5">
                              {cause.description?.substring(0, 80)}...
                            </div>
                          </div>
                          <span className={`badge text-xs flex-shrink-0 ${
                            cause.status === 'active' ? 'badge-success' : 'badge-neutral'
                          }`}>
                            {cause.status}
                          </span>
                        </div>
                      </button>
                    ))}
                    <button
                      onClick={handleSearch}
                      className="w-full px-4 py-2 text-sm text-[var(--color-text-link)] hover:bg-[var(--color-bg-emphasis)] text-center"
                    >
                      View all results →
                    </button>
                  </div>
                )}

                {/* No results message */}
                {showDropdown && searchQuery.length >= 2 && searchResults.length === 0 && !isSearching && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-[var(--color-bg-default)] border border-[var(--color-border-default)] rounded-lg shadow-lg p-4 text-center z-50">
                    <p className="text-sm text-[var(--color-text-muted)]">No causes found</p>
                  </div>
                )}
              </div>
            )}

            {/* Auth buttons */}
            <div className="flex items-center gap-3">
              {!isFullUI && (
                <span className="badge badge-info">Coming Soon</span>
              )}
              {isFullUI && (
                user ? (
                  <div className="flex items-center gap-3">
                    <Link to="/dashboard" className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]">
                      Dashboard
                    </Link>
                    <button 
                      onClick={signOut}
                      className="btn btn-secondary text-sm"
                    >
                      Sign Out
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Link to="/login" className="btn btn-secondary text-sm">
                      Sign In
                    </Link>
                    <Link to="/signup" className="btn btn-primary text-sm">
                      Get Started
                    </Link>
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main>
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="border-t border-[var(--color-border-muted)] py-8 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2 text-[var(--color-text-muted)] text-sm">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" 
                      stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span>© 2026 OpenCause by Wishing Well Studios</span>
            </div>
            <nav className="flex items-center gap-6 text-sm text-[var(--color-text-muted)]">
              <Link to="/whitepaper" className="hover:text-[var(--color-text-secondary)]">Whitepaper</Link>
              <Link to="/docs/safety" className="hover:text-[var(--color-text-secondary)]">Safety</Link>
              <a href="https://github.com/wishing-well-studios/guild" className="hover:text-[var(--color-text-secondary)]">GitHub</a>
            </nav>
          </div>
        </div>
      </footer>
    </div>
  );
}
