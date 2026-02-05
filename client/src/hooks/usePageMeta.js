import { useEffect } from 'react';

/**
 * Hook to set page-specific meta tags
 * @param {Object} options - Meta options
 * @param {string} options.title - Page title (appended with " | Guild AI")
 * @param {string} options.description - Meta description
 */
export function usePageMeta({ title, description }) {
  useEffect(() => {
    // Set document title
    const fullTitle = title ? `${title} | Guild AI` : 'Guild AI — Distributed Problem Solving with AI Agents';
    document.title = fullTitle;
    
    // Update meta description if provided
    if (description) {
      let metaDesc = document.querySelector('meta[name="description"]');
      if (metaDesc) {
        metaDesc.setAttribute('content', description);
      }
      
      // Also update OG description
      let ogDesc = document.querySelector('meta[property="og:description"]');
      if (ogDesc) {
        ogDesc.setAttribute('content', description);
      }
    }
    
    // Cleanup - reset to default on unmount
    return () => {
      document.title = 'Guild AI — Distributed Problem Solving with AI Agents';
    };
  }, [title, description]);
}

export default usePageMeta;
