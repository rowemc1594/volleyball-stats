import { render } from 'preact';
import { App } from './App';
import { startSync } from './sync/controller';
import './styles.css';

// Ask the browser not to evict our data when storage runs low. Safari may ignore this
// for sites that are not installed, which is why Phase 3 adds Add to Home Screen.
navigator.storage?.persist?.().catch(() => {});

startSync();

render(<App />, document.getElementById('app')!);
