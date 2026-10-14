import { useCallback, useEffect, useState } from 'react';
import { apiClient } from '../../api/client.js';
import { notificationStorageKey, readNotificationIds, markNotificationIds } from '../../utils/notificationReadState.js';

export default function useNotifications(userId) {
  const key = notificationStorageKey(userId);
  const [events, setEvents] = useState([]);
  const [readIds, setReadIds] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [storageError, setStorageError] = useState(false);

  useEffect(() => {
    setEvents([]);
    setLoading(true);
    setError('');
    setStorageError(false);
    try { setReadIds(readNotificationIds(window.localStorage, key)); }
    catch { setReadIds(new Set()); }
    const controller = new AbortController();
    let pending = false;
    async function refresh() {
      if (pending || userId == null) return;
      pending = true;
      try {
        const { data } = await apiClient.get('/api/events', {
          params: { page: 0, size: 30 }, signal: controller.signal,
        });
        if (!controller.signal.aborted) { setEvents(data.content || []); setError(''); }
      } catch {
        if (!controller.signal.aborted) setError('알림을 불러오지 못했습니다. 잠시 후 다시 시도합니다.');
      } finally {
        pending = false;
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    function sync(event) {
      if (event.key === key || event.key === null) {
        try { setReadIds(readNotificationIds(window.localStorage, key)); } catch { /* Keep current state. */ }
      }
    }
    refresh();
    const timer = setInterval(refresh, 10000);
    window.addEventListener('firis-events-changed', refresh);
    window.addEventListener('focus', refresh);
    window.addEventListener('storage', sync);
    return () => {
      controller.abort(); clearInterval(timer);
      window.removeEventListener('firis-events-changed', refresh);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('storage', sync);
    };
  }, [key, userId]);

  const markRead = useCallback(ids => {
    setReadIds(current => markNotificationIds(current, ids));
    try {
      const merged = markNotificationIds(readNotificationIds(window.localStorage, key), [...readIds, ...ids]);
      window.localStorage.setItem(key, JSON.stringify([...merged]));
      setReadIds(merged);
      setStorageError(false);
    } catch { setStorageError(true); }
  }, [key, readIds]);

  return { events, readIds, loading, error, storageError, markRead,
    unreadCount: events.filter(event => !readIds.has(String(event.eventId))).length };
}
