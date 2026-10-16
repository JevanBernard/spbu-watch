// When this browser last looked at a station's chat, for the "new messages" badge. Only a timestamp per station,
// kept in localStorage; every access is guarded (private mode, blocked storage) and the badge just shows all
// recent messages when nothing can be read.
const key = (stationId: string) => `spbu-chat-seen:${stationId}`;

export function readChatSeen(stationId: string): number {
  try {
    const v = Number(window.localStorage.getItem(key(stationId)));
    return Number.isFinite(v) ? v : 0;
  } catch {
    return 0;
  }
}

export function writeChatSeen(stationId: string, at: number = Date.now()): void {
  try {
    window.localStorage.setItem(key(stationId), String(at));
  } catch {
    // nothing to remember it with
  }
}
