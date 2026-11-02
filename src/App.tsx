import { MatchDetailScreen } from './screens/MatchDetail';
import { MatchesScreen, SeasonScreen } from './screens/Home';
import { TrackScreen } from './screens/Track';
import { ViewerScreen } from './screens/Viewer';
import { useAppData } from './hooks';
import { useRoute } from './router';

export function App() {
  const route = useRoute();
  const data = useAppData();

  // A shared link never needs this device's own data, so show it without waiting for the local database.
  if (route.name === 'share') return <ViewerScreen token={route.token} />;

  if (!data) return <div class="inner body empty">Loading…</div>;

  switch (route.name) {
    case 'track':
      return <TrackScreen data={data} matchId={route.matchId} />;
    case 'match':
      return <MatchDetailScreen data={data} matchId={route.matchId} />;
    case 'season':
      return <SeasonScreen data={data} />;
    default:
      return <MatchesScreen data={data} />;
  }
}
