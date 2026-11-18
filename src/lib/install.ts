// "Install as an app", the same way as Ugo's dashboard and Rina's Recipes: Chrome and Edge (Windows, macOS, Android,
// ChromeOS) fire beforeinstallprompt, kept here so a button can open the browser's own install dialog later.
// iPhone / iPad: Share, then Add to Home Screen. Safari on a Mac: File, then Add to Dock.
import { useEffect, useState } from 'react';

interface PromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
}

let deferred: PromptEvent | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as PromptEvent;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    notify();
  });
}

export type Platform = 'ios' | 'mac-safari' | 'other';

export function platformOf(ua: string, touchPoints: number): Platform {
  const ios = /iPhone|iPad|iPod/.test(ua) || (ua.includes('Macintosh') && touchPoints > 1);
  if (ios) return 'ios';
  if (ua.includes('Macintosh') && ua.includes('Safari') && !/Chrome|Chromium|Edg|Firefox/.test(ua)) return 'mac-safari';
  return 'other';
}

export const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true;

export function useInstall() {
  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force((n) => n + 1);
    listeners.add(l);
    return () => void listeners.delete(l);
  }, []);
  return {
    canPrompt: !!deferred,
    installed: isStandalone(),
    platform: platformOf(navigator.userAgent, navigator.maxTouchPoints),
    async prompt() {
      if (!deferred) return;
      await deferred.prompt();
      await deferred.userChoice.catch(() => null);
      deferred = null;
      notify(); // every install button updates, not only this one
    },
  };
}

// The install popup on a computer, as on the dashboard: a few seconds after opening, in a browser on a computer
// (not a phone, not the installed app); "Not now" hides it for 30 days.
export const INSTALL_LATER = 'lila-install-later';
const PAUSE = 30 * 24 * 3600 * 1000;

export type InstallWay = 'prompt' | 'safari' | 'ios';

/** How this browser installs the app, or null when it cannot (or already is). Pure, for tests. */
export function installWay(o: { installed: boolean; canPrompt: boolean; platform: Platform }): InstallWay | null {
  if (o.installed) return null;
  if (o.canPrompt) return 'prompt';
  if (o.platform === 'mac-safari') return 'safari';
  if (o.platform === 'ios') return 'ios';
  return null;
}

/** Whether to show the popup now. Pure, for tests. */
export function offerPopup(o: { phone: boolean; way: InstallWay | null; laterAt: number | null; now: number }): boolean {
  if (o.phone || !o.way || o.way === 'ios') return false;
  return !(o.laterAt && o.now - o.laterAt < PAUSE);
}
