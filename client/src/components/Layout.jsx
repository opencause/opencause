import { Link, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Layout() {
  const { user, signOut } = useAuth();
  const location = useLocation();

  return (
    <div className="min-h-screen bg-[var(--color-bg-canvas)]">
      {/* Header */}
      <header className="bg-[var(--color-bg-default)] border-b border-[var(--color-border-muted)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center gap-6">
              <Link to="/" className="flex items-center gap-2">
                <svg className="w-8 h-8 text-[var(--color-text-primary)]" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" 
                        stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span className="font-semibold text-[var(--color-text-primary)]">Guild</span>
              </Link>

              {/* Nav Links */}
              <nav className="hidden md:flex items-center gap-4">
                <Link 
                  to="/explore" 
                  className={`text-sm ${location.pathname === '/explore' ? 'text-[var(--color-text-primary)]' : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'}`}
                >
                  Explore Causes
                </Link>
                {user && (
                  <Link 
                    to="/causes/new" 
                    className={`text-sm ${location.pathname === '/causes/new' ? 'text-[var(--color-text-primary)]' : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'}`}
                  >
                    Create Cause
                  </Link>
                )}
              </nav>
            </div>

            {/* Search */}
            <div className="flex-1 max-w-md mx-4 hidden md:block">
              <input
                type="text"
                placeholder="Search causes..."
                className="input w-full text-sm"
              />
            </div>

            {/* Auth */}
            <div className="flex items-center gap-3">
              {user ? (
                <>
                  <Link to="/dashboard" className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]">
                    Dashboard
                  </Link>
                  <button 
                    onClick={signOut}
                    className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                  >
                    Sign out
                  </button>
                </>
              ) : (
                <>
                  <Link to="/login" className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]">
                    Sign in
                  </Link>
                  <Link to="/signup" className="btn btn-primary text-sm">
                    Sign up
                  </Link>
                </>
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
              <span>© 2026 Guild by Wishing Well Studios</span>
            </div>
            <nav className="flex items-center gap-6 text-sm text-[var(--color-text-muted)]">
              <a href="#" className="hover:text-[var(--color-text-secondary)]">Terms</a>
              <a href="#" className="hover:text-[var(--color-text-secondary)]">Privacy</a>
              <a href="#" className="hover:text-[var(--color-text-secondary)]">Docs</a>
              <a href="https://github.com/wishing-well-studios/guild" className="hover:text-[var(--color-text-secondary)]">GitHub</a>
            </nav>
          </div>
        </div>
      </footer>
    </div>
  );
}
