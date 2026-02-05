import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function AuthCallback() {
  const navigate = useNavigate();
  const { supabase } = useAuth();
  const [error, setError] = useState(null);

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          setError(error.message);
          return;
        }

        if (session?.user) {
          // Check if human record exists, create if not (for OAuth users)
          const { data: existingHuman } = await supabase
            .from('humans')
            .select('id')
            .eq('id', session.user.id)
            .single();

          if (!existingHuman) {
            await supabase.from('humans').insert({
              id: session.user.id,
              email: session.user.email,
              display_name: session.user.user_metadata?.full_name || 
                           session.user.user_metadata?.name || 
                           session.user.email?.split('@')[0],
              avatar_url: session.user.user_metadata?.avatar_url,
              email_verified: session.user.email_confirmed_at ? true : false,
              tier: 'new'
            });
          }

          navigate('/dashboard');
        } else {
          navigate('/login');
        }
      } catch (err) {
        console.error('Auth callback error:', err);
        setError('Authentication failed. Please try again.');
      }
    };

    handleCallback();
  }, [navigate, supabase]);

  if (error) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <div className="card p-8">
          <h1 className="text-xl font-semibold text-[var(--color-text-primary)] mb-4">
            Authentication Error
          </h1>
          <p className="text-[var(--color-text-secondary)] mb-6">{error}</p>
          <a href="/login" className="btn btn-primary">
            Back to Sign In
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto px-4 py-16 text-center">
      <div className="card p-8">
        <div className="inline-block w-8 h-8 border-2 border-[var(--color-border-default)] border-t-[var(--color-text-link)] rounded-full animate-spin mb-4" />
        <p className="text-[var(--color-text-secondary)]">Completing sign in...</p>
      </div>
    </div>
  );
}
