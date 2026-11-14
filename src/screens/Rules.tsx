import { useState } from 'preact/hooks';
import { filterRules, rulesByTopic } from '../rules';
import { navigate, paths } from '../router';
import { Shell } from '../ui/Shell';

/** Static page: needs no saved data, so it works offline and for people on a shared link. */
export function RulesScreen() {
  const [query, setQuery] = useState('');
  const matches = filterRules(query);
  const groups = rulesByTopic(matches);
  // Back goes to wherever the reader came from (home, or a shared stats link).
  const back = () => (history.length > 1 ? history.back() : navigate(paths.matches));

  return (
    <Shell viewer back onBack={back} title="Know the rules" sub="Volleyball in plain English">
      <div class="card form">
        <div class="field">
          <label for="rules-q">Search</label>
          <input
            id="rules-q"
            type="search"
            placeholder="double hit, net, rotation…"
            autocomplete="off"
            value={query}
            onInput={(e) => setQuery(e.currentTarget.value)}
          />
        </div>
        <div class="note">
          These are the standard indoor volleyball rules in everyday words. Leagues and age levels differ in the
          details, so your league’s rules and the officials’ calls are final.
        </div>
      </div>

      {groups.length === 0 ? (
        <div class="card empty" role="status">
          Nothing matches “{query}”. Try a shorter word, like “net” or “serve”.
        </div>
      ) : null}

      {groups.map((g) => (
        <div class="card" key={g.topic}>
          <h2>{g.topic}</h2>
          {g.entries.map((r) => (
            <details class="rule" key={r.id} open={query.trim() !== '' && matches.length <= 3}>
              <summary>
                <span class="rt">{r.term}</span>
                <span class="rs">{r.short}</span>
              </summary>
              {r.see ? <div class="rsee">{r.see}</div> : null}
            </details>
          ))}
        </div>
      ))}
    </Shell>
  );
}
