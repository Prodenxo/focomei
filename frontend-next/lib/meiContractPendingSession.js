const KEY_PREFIX = 'mei_contract_pending_v1';

function storageKey(userId) {
  const id = String(userId || '').trim();
  return id ? `${KEY_PREFIX}:${id}` : KEY_PREFIX;
}

export function hasMeiContractPendingSession(data) {
  return Boolean(data?.lineId || data?.contratoOnetyId);
}

export function stashMeiContractPendingSession(userId, data) {
  if (typeof window === 'undefined') return;
  const payload = {
    ...data,
    savedAt: new Date().toISOString(),
  };
  window.localStorage.setItem(storageKey(userId), JSON.stringify(payload));
}

export function readMeiContractPendingSession(userId) {
  if (typeof window === 'undefined') return null;
  try {
    const value = window.localStorage.getItem(storageKey(userId));
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}

export function clearMeiContractPendingSession(userId) {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(storageKey(userId));
  window.sessionStorage.removeItem('focomei_contract_signing_url');
}
