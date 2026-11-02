import { useEffect, useState } from 'preact/hooks';
import type { AppData } from '../db/repo';
import { showToast } from '../hooks';
import { syncNow, useSyncState } from '../sync/controller';
import { createShareLink, listShareLinks, revokeShareLink, shareUrl, type ShareLink } from '../sync/share';

const when = (iso: string) => new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric' });

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function LinkRow({ link, onChanged }: { link: ShareLink; onChanged: () => void }) {
  const [confirm, setConfirm] = useState(false);
  const [shown, setShown] = useState(false);
  const url = shareUrl(link.token);
  const active = !link.revokedAt;
  const canShare = typeof navigator.share === 'function';

  const copy = async () => {
    if (await copyText(url)) showToast('Link copied');
    else setShown(true); // clipboard blocked: show the text so it can be selected by hand
  };
  const share = async () => {
    try {
      await navigator.share({ title: 'Volleyball stats', url });
    } catch {
      /* the share sheet was dismissed */
    }
  };
  const revoke = async () => {
    try {
      await revokeShareLink(link.id);
      showToast('Link turned off');
      onChanged();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not turn off the link');
    }
  };

  return (
    <div class="slink" style={active ? '' : 'opacity:.55'}>
      <div class="slhead">
        <b>{link.label || 'Share link'}</b>
        <span class="note" style="margin:0">
          {active ? `Created ${when(link.createdAt)}` : `Turned off ${when(link.revokedAt!)}`}
          {active && link.lastViewedAt ? ` · opened ${when(link.lastViewedAt)}` : active ? ' · not opened yet' : ''}
        </span>
      </div>
      {active ? (
        <>
          <div class="row2">
            <button class="btn2" onClick={copy}>
              📋 Copy link
            </button>
            {canShare ? (
              <button class="btn2" onClick={share}>
                Send…
              </button>
            ) : null}
          </div>
          {shown ? (
            <textarea readOnly class="fallback" value={url} onFocus={(e) => e.currentTarget.select()} ref={(el) => el?.select()} />
          ) : null}
          <div class="confirm">
            {confirm ? (
              <>
                <span>Turn off this link? It stops working right away.</span>
                <button class="ghost danger" onClick={revoke}>
                  Turn off
                </button>
                <button class="ghost" onClick={() => setConfirm(false)}>
                  Keep
                </button>
              </>
            ) : (
              <button class="ghost danger" onClick={() => setConfirm(true)}>
                Turn off link
              </button>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}

/** Create and manage the read-only links. Needs sign-in and a connection, since links live in the cloud. */
export function ShareCard({ data }: { data: AppData }) {
  const s = useSyncState();
  const [links, setLinks] = useState<ShareLink[] | null>(null);
  const [label, setLabel] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const signedIn = s.phase !== 'off' && s.phase !== 'signed-out';

  const reload = () =>
    listShareLinks().then(
      (l) => {
        setLinks(l);
        setProblem(null);
      },
      () => setProblem('Could not load your links. Check your connection.'),
    );

  useEffect(() => {
    if (signedIn) void reload();
  }, [signedIn]);

  if (!signedIn) return null;

  const create = async (e: Event) => {
    e.preventDefault();
    if (!data.player) {
      setProblem('Add a match or save the player first, so there are stats to share.');
      return;
    }
    setBusy(true);
    setProblem(null);
    try {
      await syncNow(); // the link points at the player, which must already be in the cloud
      await createShareLink(data.player.id, label);
      setLabel('');
      await reload();
      showToast('Link created');
    } catch (err) {
      setProblem(err instanceof Error ? err.message : 'Could not create the link');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div class="card form">
      <h2>Share with family</h2>
      <div class="note">
        Anyone with a link can see {data.player?.name || 'the'} stats, read-only and without an account. Make one
        link per person so you can turn off just theirs.
      </div>
      <form class="row" style="align-items:flex-end" onSubmit={create}>
        <div class="field" style="flex:2">
          <label for="slLabel">Who is it for? (optional)</label>
          <input
            id="slLabel"
            placeholder="Grandma, Coach…"
            autocomplete="off"
            value={label}
            onInput={(e) => setLabel(e.currentTarget.value)}
          />
        </div>
        <button class="ghost" type="submit" disabled={busy} style="flex:1">
          Create link
        </button>
      </form>
      {problem ? (
        <div class="note" role="alert" style="color:var(--red,#f87171)">
          {problem}
        </div>
      ) : null}
      {links?.length ? links.map((l) => <LinkRow key={l.id} link={l} onChanged={reload} />) : null}
      {links && !links.length ? <div class="empty">No links yet.</div> : null}
    </div>
  );
}
