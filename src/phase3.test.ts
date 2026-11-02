import { describe, expect, it, vi } from 'vitest';
import { isIos, shouldShowInstallHint } from './installHint';
import { holdScreenAwake, type VisibilityDoc, type WakeLockApi, type WakeLockSentinelLike } from './wakeLock';

function fakeDoc(): VisibilityDoc & { hidden: boolean; fire(): void } {
  const listeners = new Set<() => void>();
  return {
    hidden: false,
    addEventListener: (_t, l) => void listeners.add(l),
    removeEventListener: (_t, l) => void listeners.delete(l),
    fire() {
      listeners.forEach((l) => l());
    },
  };
}

function fakeWakeLock() {
  const sentinels: Array<WakeLockSentinelLike & { released: boolean; drop(): void }> = [];
  const api: WakeLockApi = {
    request: vi.fn(async () => {
      let onRelease = () => {};
      const s = {
        released: false,
        release: async () => {
          s.released = true;
          onRelease();
        },
        addEventListener: (_t: 'release', l: () => void) => {
          onRelease = l;
        },
        // What the browser does when the page is hidden
        drop: () => {
          s.released = true;
          onRelease();
        },
      };
      sentinels.push(s);
      return s;
    }),
  };
  return { api, sentinels };
}

const tick = () => new Promise((r) => setTimeout(r, 0));

describe('holdScreenAwake', () => {
  it('asks for the lock straight away', async () => {
    const { api, sentinels } = fakeWakeLock();
    holdScreenAwake(api, fakeDoc());
    await tick();
    expect(sentinels).toHaveLength(1);
  });

  it('asks again when the page becomes visible after the browser dropped the lock', async () => {
    const { api, sentinels } = fakeWakeLock();
    const doc = fakeDoc();
    holdScreenAwake(api, doc);
    await tick();

    doc.hidden = true;
    sentinels[0].drop();
    doc.fire();
    await tick();
    expect(sentinels).toHaveLength(1); // not while hidden

    doc.hidden = false;
    doc.fire();
    await tick();
    expect(sentinels).toHaveLength(2);
  });

  it('does not stack locks when the page becomes visible but the lock is still held', async () => {
    const { api, sentinels } = fakeWakeLock();
    const doc = fakeDoc();
    holdScreenAwake(api, doc);
    await tick();
    doc.fire();
    doc.fire();
    await tick();
    expect(sentinels).toHaveLength(1);
  });

  it('releases the lock and stops listening when stopped', async () => {
    const { api, sentinels } = fakeWakeLock();
    const doc = fakeDoc();
    const stop = holdScreenAwake(api, doc);
    await tick();
    stop();
    await tick();
    expect(sentinels[0].released).toBe(true);
    doc.fire();
    await tick();
    expect(sentinels).toHaveLength(1);
  });

  it('does not keep a lock that arrives after stopping', async () => {
    const { api, sentinels } = fakeWakeLock();
    const stop = holdScreenAwake(api, fakeDoc());
    stop(); // before the request resolves
    await tick();
    expect(sentinels[0].released).toBe(true);
  });

  it('carries on quietly when the browser refuses or has no Wake Lock', async () => {
    const refusing: WakeLockApi = { request: vi.fn(async () => Promise.reject(new Error('NotAllowed'))) };
    expect(() => holdScreenAwake(refusing, fakeDoc())).not.toThrow();
    await tick();
    expect(() => holdScreenAwake(undefined, fakeDoc())()).not.toThrow();
  });
});

describe('install hint', () => {
  const iphone = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1';
  const mac = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15';
  const android = 'Mozilla/5.0 (Linux; Android 14) Chrome/120 Mobile Safari/537.36';

  it('recognises iPhones, iPads and iPadOS pretending to be a Mac', () => {
    expect(isIos({ userAgent: iphone })).toBe(true);
    expect(isIos({ userAgent: mac, maxTouchPoints: 5 })).toBe(true);
    expect(isIos({ userAgent: mac, maxTouchPoints: 0 })).toBe(false);
    expect(isIos({ userAgent: android })).toBe(false);
  });

  it('shows only on iOS, before install, until dismissed', () => {
    expect(shouldShowInstallHint({ userAgent: iphone, standalone: false, dismissed: false })).toBe(true);
    expect(shouldShowInstallHint({ userAgent: iphone, standalone: true, dismissed: false })).toBe(false);
    expect(shouldShowInstallHint({ userAgent: iphone, standalone: false, dismissed: true })).toBe(false);
    expect(shouldShowInstallHint({ userAgent: android, standalone: false, dismissed: false })).toBe(false);
  });
});
