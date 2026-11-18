import { MAP_LABEL } from '../lib/style';
import type { MapId } from '../lib/types';

/** A map's small picture (96 px thumbnail, a few KB). */
export function MapThumb({ map, size = 22 }: { map: string; size?: number }) {
  return <img className="map-thumb" src={`/minimaps/thumbs/${map}.jpg`} alt="" width={size} height={size} loading="lazy" decoding="async" />;
}

/** A map's name in a highlighted label, with its picture. */
export function MapBadge({ map }: { map: string }) {
  return (
    <span className="map-badge">
      <MapThumb map={map} size={18} />
      {MAP_LABEL[map as MapId] ?? map}
    </span>
  );
}
