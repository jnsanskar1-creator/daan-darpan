import { useState, useEffect } from 'react';

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const media = window.matchMedia(query);
      
      // Initial check
      setMatches(media.matches);
      
      // Update matches when media query changes
      const listener = (e: MediaQueryListEvent) => {
        setMatches(e.matches);
      };
      
      // Add event listener
      media.addEventListener('change', listener);
      
      // Cleanup
      return () => {
        media.removeEventListener('change', listener);
      };
    }
    
    return undefined;
  }, [query]);

  return matches;
}