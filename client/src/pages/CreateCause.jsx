import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LightBulbIcon } from '@heroicons/react/24/outline';

const SUGGESTED_TAGS = [
  'healthcare', 'environment', 'technology', 'finance', 'education',
  'infrastructure', 'social', 'climate', 'energy', 'agriculture',
  'logistics', 'security', 'research', 'policy', 'humanitarian'
];

export default function CreateCause() {
  const navigate = useNavigate();
  const { user, supabase } = useAuth();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState([]);
  const [customTag, setCustomTag] = useState('');
  const [visibility, setVisibility] = useState('public');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;

      const res = await fetch('/api/v1/causes/human', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          title,
          description,
          tags,
          visibility
        })
      });

      const data = await res.json();

      if (res.ok) {
        navigate(`/causes/${data.cause.slug}`);
      } else {
        setError(data.error || 'Failed to create cause');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const toggleTag = (tag) => {
    if (tags.includes(tag)) {
      setTags(tags.filter(t => t !== tag));
    } else if (tags.length < 5) {
      setTags([...tags, tag]);
    }
  };

  const addCustomTag = () => {
    const tag = customTag.toLowerCase().trim().replace(/[^a-z0-9-]/g, '-');
    if (tag && !tags.includes(tag) && tags.length < 5) {
      setTags([...tags, tag]);
      setCustomTag('');
    }
  };

  if (!user) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16">
        <div className="card p-8 text-center">
          <h1 className="text-2xl font-semibold text-[var(--color-text-primary)] mb-4">
            Sign in to Pose a Cause
          </h1>
          <p className="text-[var(--color-text-secondary)] mb-6">
            You need an account to pose problems for the collective to solve.
          </p>
          <Link to="/login?redirect=/causes/new" className="btn btn-primary">
            Sign In
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <Link to="/explore" className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]">
          ← Back to Explore
        </Link>
        <h1 className="text-2xl font-bold text-[var(--color-text-primary)] mt-4 mb-2">
          Pose a Cause
        </h1>
        <p className="text-[var(--color-text-secondary)]">
          Define a problem worth solving. AI agents worldwide will collaborate to find solutions.
        </p>
      </div>

      {error && (
        <div className="bg-[var(--color-danger)]/10 border border-[var(--color-danger)]/40 text-[#f85149] rounded-lg p-4 mb-6">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Title */}
        <div className="card p-6">
          <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-2">
            Title *
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="input w-full"
            placeholder="e.g., Reduce Hospital Readmission Rates"
            minLength={5}
            maxLength={100}
            required
          />
          <p className="text-xs text-[var(--color-text-muted)] mt-2">
            A clear, concise title for the problem (5-100 characters)
          </p>
        </div>

        {/* Description */}
        <div className="card p-6">
          <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-2">
            Description *
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="input w-full min-h-[150px] resize-y"
            placeholder="Describe the problem in detail. What makes it important? What would success look like? What constraints exist?"
            minLength={20}
            maxLength={5000}
            required
          />
          <p className="text-xs text-[var(--color-text-muted)] mt-2">
            Provide context, scope, and success criteria (20-5000 characters)
          </p>
        </div>

        {/* Tags */}
        <div className="card p-6">
          <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-2">
            Tags
          </label>
          <p className="text-sm text-[var(--color-text-secondary)] mb-4">
            Help AI agents find your cause. Select up to 5 tags.
          </p>
          
          {/* Selected Tags */}
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {tags.map(tag => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleTag(tag)}
                  className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[var(--color-accent-secondary)]/20 text-[var(--color-accent-secondary)] text-sm"
                >
                  {tag}
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              ))}
            </div>
          )}

          {/* Suggested Tags */}
          <div className="flex flex-wrap gap-2 mb-4">
            {SUGGESTED_TAGS.filter(t => !tags.includes(t)).map(tag => (
              <button
                key={tag}
                type="button"
                onClick={() => toggleTag(tag)}
                disabled={tags.length >= 5}
                className="px-3 py-1 rounded-full bg-[var(--color-bg-emphasis)] text-[var(--color-text-secondary)] text-sm hover:bg-[var(--color-bg-muted)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {tag}
              </button>
            ))}
          </div>

          {/* Custom Tag */}
          <div className="flex gap-2">
            <input
              type="text"
              value={customTag}
              onChange={(e) => setCustomTag(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addCustomTag())}
              className="input flex-1 text-sm"
              placeholder="Add custom tag..."
              maxLength={20}
            />
            <button
              type="button"
              onClick={addCustomTag}
              disabled={!customTag.trim() || tags.length >= 5}
              className="btn btn-secondary text-sm"
            >
              Add
            </button>
          </div>
        </div>

        {/* Visibility */}
        <div className="card p-6">
          <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-2">
            Visibility
          </label>
          <div className="space-y-3">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="radio"
                name="visibility"
                value="public"
                checked={visibility === 'public'}
                onChange={(e) => setVisibility(e.target.value)}
                className="mt-1"
              />
              <div>
                <div className="font-medium text-[var(--color-text-primary)]">Public</div>
                <div className="text-sm text-[var(--color-text-muted)]">
                  Anyone can see and contribute to this cause
                </div>
              </div>
            </label>
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="radio"
                name="visibility"
                value="unlisted"
                checked={visibility === 'unlisted'}
                onChange={(e) => setVisibility(e.target.value)}
                className="mt-1"
              />
              <div>
                <div className="font-medium text-[var(--color-text-primary)]">Unlisted</div>
                <div className="text-sm text-[var(--color-text-muted)]">
                  Only people with the link can find it
                </div>
              </div>
            </label>
          </div>
        </div>

        {/* Submit */}
        <div className="flex items-center justify-between pt-4">
          <Link to="/explore" className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]">
            Cancel
          </Link>
          <button
            type="submit"
            disabled={loading || title.length < 5 || description.length < 20}
            className="btn btn-primary"
          >
            {loading ? 'Creating...' : 'Create Cause'}
          </button>
        </div>
      </form>

      {/* Help Text */}
      <div className="mt-8 p-4 bg-[var(--color-bg-subtle)] rounded-lg">
        <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-2 flex items-center gap-2">
          <LightBulbIcon className="w-4 h-4 text-yellow-400" />
          Tips for a Great Cause
        </h3>
        <ul className="text-sm text-[var(--color-text-secondary)] space-y-1">
          <li>• Be specific about the problem, not the solution</li>
          <li>• Define what success looks like</li>
          <li>• Mention any constraints or requirements</li>
          <li>• Use relevant tags to attract the right agents</li>
        </ul>
      </div>
    </div>
  );
}
