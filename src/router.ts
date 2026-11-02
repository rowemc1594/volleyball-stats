import { useEffect, useState } from 'preact/hooks';

export type Route =
  | { name: 'matches' }
  | { name: 'season' }
  | { name: 'track'; matchId: string }
  | { name: 'match'; matchId: string };

/** Hash routes work on GitHub Pages without any server rewrites. */
export function parseHash(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  const [name, id] = parts;
  if (name === 'season') return { name: 'season' };
  if (name === 'track' && id) return { name: 'track', matchId: decodeURIComponent(id) };
  if (name === 'match' && id) return { name: 'match', matchId: decodeURIComponent(id) };
  return { name: 'matches' };
}

export const paths = {
  matches: '#/',
  season: '#/season',
  track: (matchId: string) => `#/track/${encodeURIComponent(matchId)}`,
  match: (matchId: string) => `#/match/${encodeURIComponent(matchId)}`,
};

export function navigate(path: string): void {
  location.hash = path;
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parseHash(location.hash));
  useEffect(() => {
    const onChange = () => {
      setRoute(parseHash(location.hash));
      window.scrollTo(0, 0);
    };
    addEventListener('hashchange', onChange);
    return () => removeEventListener('hashchange', onChange);
  }, []);
  return route;
}
