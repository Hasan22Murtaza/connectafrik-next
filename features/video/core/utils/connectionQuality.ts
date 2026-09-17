import type { ConnectionQuality } from '@/features/video/core/models';

type RtcStatLike = {
  network?: string;
  rtt?: number;
  packetsLost?: number;
  totalPackets?: number;
};

const QUALITY_LABEL: Record<ConnectionQuality, string> = {
  excellent: 'Excellent network',
  good: 'Good network',
  fair: 'Unstable network',
  poor: 'Poor network',
  unknown: 'Checking network',
};

export function connectionQualityLabel(quality: ConnectionQuality | undefined): string {
  return QUALITY_LABEL[quality || 'unknown'];
}

export function mapLiveKitConnectionQuality(raw: string | undefined | null): ConnectionQuality {
  switch ((raw || '').toLowerCase()) {
    case 'excellent':
      return 'excellent';
    case 'good':
      return 'good';
    case 'poor':
    case 'lost':
      return 'poor';
    default:
      return 'unknown';
  }
}

export function mapVideoSendQuality(
  raw: 'low' | 'med' | 'high' | string | undefined | null,
): ConnectionQuality {
  switch (raw) {
    case 'high':
      return 'excellent';
    case 'med':
      return 'good';
    case 'low':
      return 'poor';
    default:
      return 'unknown';
  }
}

function mapNamedNetwork(raw: string | undefined): ConnectionQuality | null {
  const n = (raw || '').trim().toLowerCase();
  if (!n) return null;
  if (n.includes('excel')) return 'excellent';
  if (n.includes('good')) return 'good';
  if (n.includes('avg') || n.includes('average') || n.includes('fair') || n.includes('med')) {
    return 'fair';
  }
  if (n.includes('poor') || n.includes('bad') || n.includes('low') || n.includes('lost')) {
    return 'poor';
  }
  return null;
}

export function mapRtcStatsToQuality(
  stats: RtcStatLike | RtcStatLike[] | null | undefined,
): ConnectionQuality {
  const row = Array.isArray(stats) ? stats[0] : stats;
  if (!row) return 'unknown';

  const named = mapNamedNetwork(row.network);
  if (named) return named;

  const rtt = typeof row.rtt === 'number' && Number.isFinite(row.rtt) ? row.rtt : null;
  const lost = typeof row.packetsLost === 'number' ? row.packetsLost : 0;
  const total = typeof row.totalPackets === 'number' ? row.totalPackets : 0;
  const loss = total > 0 ? lost / total : 0;

  if (rtt == null && total <= 0) return 'unknown';
  if ((rtt != null && rtt >= 500) || loss >= 0.1) return 'poor';
  if ((rtt != null && rtt >= 300) || loss >= 0.05) return 'fair';
  if ((rtt != null && rtt >= 150) || loss >= 0.02) return 'good';
  return 'excellent';
}

export function worseConnectionQuality(
  a: ConnectionQuality | undefined,
  b: ConnectionQuality | undefined,
): ConnectionQuality {
  const rank: Record<ConnectionQuality, number> = {
    unknown: 0,
    excellent: 1,
    good: 2,
    fair: 3,
    poor: 4,
  };
  const left = a || 'unknown';
  const right = b || 'unknown';
  return rank[right] > rank[left] ? right : left;
}
