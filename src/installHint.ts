/**
 * iPhones never show an install prompt, so the app explains Add to Home Screen itself.
 * Installing matters here: Safari can clear a plain website's saved data after a few
 * weeks unused, but an installed app keeps it.
 */
export interface InstallContext {
  userAgent: string;
  /** Already running as an installed app. */
  standalone: boolean;
  /** The user closed the hint before. */
  dismissed: boolean;
  /** iPadOS reports a Mac user agent; touch points give it away. */
  maxTouchPoints?: number;
}

export function isIos({ userAgent, maxTouchPoints = 0 }: Pick<InstallContext, 'userAgent' | 'maxTouchPoints'>): boolean {
  if (/iPhone|iPad|iPod/.test(userAgent)) return true;
  return /Macintosh/.test(userAgent) && maxTouchPoints > 1;
}

export function shouldShowInstallHint(ctx: InstallContext): boolean {
  return isIos(ctx) && !ctx.standalone && !ctx.dismissed;
}

const KEY = 'sideout.installHintDismissed';

export function readInstallContext(): InstallContext {
  let dismissed = false;
  try {
    dismissed = localStorage.getItem(KEY) === '1';
  } catch {
    // Private mode or blocked storage: just show the hint.
  }
  const standalone =
    (navigator as unknown as { standalone?: boolean }).standalone === true ||
    window.matchMedia?.('(display-mode: standalone)').matches === true;
  return {
    userAgent: navigator.userAgent,
    standalone,
    dismissed,
    maxTouchPoints: navigator.maxTouchPoints,
  };
}

export function dismissInstallHint(): void {
  try {
    localStorage.setItem(KEY, '1');
  } catch {
    // Nothing to do; the hint will return next visit.
  }
}
