import test from 'node:test';
import assert from 'node:assert/strict';
import { notificationStorageKey, readNotificationIds, markNotificationIds } from './notificationReadState.js';

test('read state is separated by account and survives serialization', () => {
  assert.notEqual(notificationStorageKey(1), notificationStorageKey(2));
  const marked = markNotificationIds(new Set(['10']), [11, 11]);
  assert.deepEqual([...readNotificationIds({ getItem: () => JSON.stringify([...marked]) }, 'key')], ['10', '11']);
  assert.equal(marked.has('12'), false);
});
test('invalid or unavailable storage does not break notifications', () => {
  for (const value of ['invalid', '{}', 'null', '[1,"2",null]']) {
    const ids = readNotificationIds({ getItem: () => value }, 'key');
    assert.deepEqual([...ids], value.startsWith('[') ? ['2'] : []);
  }
  assert.equal(readNotificationIds({ getItem: () => { throw Error(); } }, 'key').size, 0);
});
test('mark all affects supplied events only and retains individual read state', () => {
  const previous = new Set(['1']);
  const marked = markNotificationIds(previous, [2, 3]);
  assert.deepEqual([...marked], ['1', '2', '3']);
  assert.equal(previous.size, 1);
  assert.equal(marked.has('4'), false);
});
