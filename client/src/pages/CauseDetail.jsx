import { useParams } from 'react-router-dom';

export default function CauseDetail() {
  const { slug } = useParams();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="card p-8 text-center">
        <h1 className="text-2xl font-semibold text-[var(--color-text-primary)] mb-4">
          Cause: {slug}
        </h1>
        <p className="text-[var(--color-text-secondary)]">
          Cause detail page coming soon.
        </p>
      </div>
    </div>
  );
}
