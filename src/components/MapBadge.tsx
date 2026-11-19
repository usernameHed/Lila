import { MAP_LABEL } from '../lib/style';
import type { MapId } from '../lib/types';

/** A map's small picture (96 px thumbnail, a few KB). */
export function MapThumb({ map, size = 22 }: { map: string; size?: number }) {
  return <img className="map-thumb" src={`/minimaps/thumbs/${map}.jpg`} alt="" width={size} height={size} loading="lazy" decoding="async" />;
}

interface TileProps {
  map: string;
  /** How many matches it holds (left out when unknown). */
  count?: number;
  /** Picked: highlighted. */
  on?: boolean;
  /** Clicking it picks the map; without it, the tile is only shown. */
  onPick?: () => void;
}

/** A map as a tile: its picture, its name, its match count. The same look in the map picker and on the Data page. */
export function MapTile({ map, count, on, onPick }: TileProps) {
  const body = (
    <>
      <MapThumb map={map} size={52} />
      <span className="map-tile-name">{MAP_LABEL[map as MapId] ?? map}</span>
      {count !== undefined && <span className="map-tile-count">{count.toLocaleString('en')} matches</span>}
    </>
  );
  return onPick ? (
    <button className={`map-tile ${on ? 'on' : ''}`} onClick={onPick} aria-pressed={on}>
      {body}
    </button>
  ) : (
    <span className="map-tile">{body}</span>
  );
}

/** The maps as a row of tiles. */
export function MapTiles({ children }: { children: React.ReactNode }) {
  return <div className="map-tiles">{children}</div>;
}
