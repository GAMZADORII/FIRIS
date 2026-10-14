export const notificationStorageKey = userId => `firis-notifications-read:${userId}`;

export function readNotificationIds(storage, key) {
  try {
    const value = JSON.parse(storage.getItem(key) || '[]');
    return new Set(Array.isArray(value) ? value.filter(id => typeof id === 'string') : []);
  } catch { return new Set(); }
}

export function markNotificationIds(readIds, ids) {
  return new Set([...readIds, ...ids.map(String)].slice(-2000));
}
