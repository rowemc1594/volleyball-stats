import { MatchDetailScreen } from './screens/MatchDetail';
import { MatchesScreen, SeasonScreen } from './screens/Home';
import { TrackScreen } from './screens/Track';
import { ViewerScreen } from './screens/Viewer';
import { useAppData } from './hooks';
import { useRoute } from './router';
import { useErrorBoundary } from 'preact/hooks';
import { Shell } from './ui/Shell';

export function App() {
  const route = useRoute();
  const { data, failed } = useAppData();
  // If a screen crashes, say so plainly instead of leaving a blank page. Saved stats are untouched.
  const [crash, clearCrash] = useErrorBoundary((err) => console.error('Screen crashed', err));

  // A shared link never needs this device's own data, so show it without waiting for the local database.
  if (route.name === 'share') return <ViewerScreen token={route.token} />;

  if (crash) {
    return (
      <Shell title="Side Out Stats" sub="Something went wrong">
        <div class="card form" role="alert">
          <h2>Something went wrong</h2>
          <div class="note">Your stats are saved on this device. Reload to carry on.</div>
          <button
            class="big g-blue"
            onClick={() => {
              clearCrash();
              location.hash = '#/';
              location.reload();
            }}
          >
            Reload
          </button>
        </div>
      </Shell>
    );
  }

  if (failed && !data) {
    return (
      <Shell title="Side Out Stats" sub="Can’t open storage">
        <div class="card form" role="alert">
          <h2>Can’t save on this device</h2>
          <div class="note">
            This browser is not letting the app store data. This happens in private windows and when storage is
            blocked. Open the app in a normal Safari or Chrome window, or add it to your Home Screen.
          </div>
        </div>
      </Shell>
    );
  }

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
