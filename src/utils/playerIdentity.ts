const PLAYER_ID_KEY = 'palace_salon_player_id';
const NICKNAME_KEY = 'palace_salon_nickname';
const MUTED_KEY = 'palace_salon_muted';

function generatePlayerId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
}

export function getOrCreatePlayerId(): string {
  try {
    const existing = localStorage.getItem(PLAYER_ID_KEY);
    if (existing && /^[a-zA-Z0-9_-]{8,64}$/.test(existing)) {
      return existing;
    }
    const fresh = generatePlayerId();
    localStorage.setItem(PLAYER_ID_KEY, fresh);
    return fresh;
  } catch {
    return generatePlayerId();
  }
}

export function getStoredNickname(): string {
  try {
    return localStorage.getItem(NICKNAME_KEY) ?? '';
  } catch {
    return '';
  }
}

export function setStoredNickname(nickname: string): void {
  try {
    localStorage.setItem(NICKNAME_KEY, nickname.trim().slice(0, 20));
  } catch {
    // Ignore storage unavailability
  }
}

export function getStoredMuted(): boolean {
  try {
    return localStorage.getItem(MUTED_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setStoredMuted(muted: boolean): void {
  try {
    localStorage.setItem(MUTED_KEY, muted ? 'true' : 'false');
  } catch {
    // Ignore storage unavailability
  }
}
