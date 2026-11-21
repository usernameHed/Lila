import { useEffect, useState } from 'react';
import { INSTALL_LATER, installWay, offerPopup, useInstall, type InstallWay } from '../lib/install';
import { Icon } from './Icon';

const laterAt = () => {
  try {
    return Number(localStorage.getItem(INSTALL_LATER)) || null;
  } catch {
    return null;
  }
};
const isPhone = () => window.matchMedia('(max-width: 760px), (pointer: coarse)').matches;

/** What installing gives, and how, in one line. */
export function installText(way: InstallWay): string {
  if (way === 'safari') return 'In Safari: File, then Add to Dock.';
  if (way === 'ios') return 'In Safari: Share, then Add to Home Screen.';
  return 'Its own window and icon, opens with no connection, and updates itself when a new version is out.';
}

/** A small popup offering to install the tool on a computer, a few seconds after opening, as on Ugo's dashboard. */
export function InstallOffer() {
  const install = useInstall();
  const [later, setLater] = useState(laterAt);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setShown(true), 4000);
    return () => clearTimeout(t);
  }, []);
  const way = installWay(install);
  if (!shown || !way || !offerPopup({ phone: isPhone(), way, laterAt: later, now: Date.now() })) return null;
  const notNow = () => {
    try {
      localStorage.setItem(INSTALL_LATER, String(Date.now()));
    } catch {
      // storage blocked: hidden for this visit only
    }
    setLater(Date.now());
  };
  return (
    <div className="install-offer" role="dialog" aria-label="Install the app">
      <img src="/app/icon-192.png" alt="" />
      <div>
        <strong>Install LILA Journeys</strong>
        <p>{installText(way)}</p>
        <div className="install-offer-btns">
          {way === 'prompt' && (
            <button className="install-btn" onClick={() => void install.prompt()}>
              <Icon name="download" size={14} /> Install
            </button>
          )}
          <button className="install-later" onClick={notNow}>
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}
