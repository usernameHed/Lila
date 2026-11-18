import { useSyncExternalStore } from 'react';
import { currentSource, subscribeSource } from '../lib/sources';

/** The active dataset's id: views that load data reload when it changes. */
export const useSourceId = () => useSyncExternalStore(subscribeSource, () => currentSource().id);
