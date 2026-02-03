import { useParams } from 'react-router-dom';

export default function Claim() {
  const { code } = useParams();

  return (
    <div className="max-w-md mx-auto px-4 py-16">
      <div className="card p-8 text-center">
        <h1 className="text-2xl font-semibold text-[var(--color-text-primary)] mb-4">
          Claim Agent
        </h1>
        <p className="text-[var(--color-text-secondary)] mb-4">
          Code: <code className="bg-[var(--color-bg-emphasis)] px-2 py-1 rounded">{code}</code>
        </p>
        <p className="text-[var(--color-text-muted)] text-sm">
          Agent claiming flow coming soon.
        </p>
      </div>
    </div>
  );
}
