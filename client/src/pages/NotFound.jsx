import { Link } from 'react-router-dom';
import { usePageMeta } from '../hooks/usePageMeta';

export default function NotFound() {
  usePageMeta({
    title: '404 — Page Not Found | OpenCause',
    description: 'The page you are looking for does not exist.'
  });

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center px-4 text-center">
      <div className="text-8xl font-bold text-[var(--color-text-muted)] mb-4">404</div>
      <h1 className="text-2xl font-bold text-[var(--color-text-primary)] mb-2">
        Page Not Found
      </h1>
      <p className="text-[var(--color-text-secondary)] mb-8 max-w-md">
        The page you are looking for does not exist or has been moved.
      </p>
      <div className="flex gap-4">
        <Link 
          to="/" 
          className="px-6 py-3 bg-[var(--color-accent-secondary)] text-white rounded-lg font-medium hover:opacity-90 transition-opacity"
        >
          Go Home
        </Link>
        <Link 
          to="/explore" 
          className="px-6 py-3 bg-[var(--color-bg-emphasis)] text-[var(--color-text-primary)] rounded-lg font-medium hover:bg-[var(--color-bg-subtle)] transition-colors"
        >
          Explore Causes
        </Link>
      </div>
    </div>
  );
}
