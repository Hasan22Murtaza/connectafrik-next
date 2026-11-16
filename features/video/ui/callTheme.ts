/** Shared visual tokens for the in-call dark shell (group + 1:1). */
export const CALL_SHELL_BG = '#0b0b0b';
export const CALL_TILE_BG = '#141414';
export const CALL_TILE_BORDER = 'rgba(255,255,255,0.08)';
export const CALL_PANEL_BG = '#121212';
export const CALL_CONTROL_BAR_BG = 'rgba(22,22,22,0.92)';
export const CALL_SPEAKING_GREEN = '#4ade80';
export const CALL_SPEAKING_RING = 'rgba(74,222,128,0.85)';

export function callTitleFromNames(opts: {
  isGroupCall: boolean;
  isIncoming: boolean;
  callerName?: string;
  recipientName?: string;
  participantCount?: number;
}): string {
  if (opts.isGroupCall) {
    const count = opts.participantCount ?? 0;
    return count > 0 ? `Group call · ${count}` : 'Group call';
  }
  const name = opts.isIncoming ? opts.callerName : opts.recipientName;
  return (name || 'Call').trim() || 'Call';
}
