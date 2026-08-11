import { describe, expect, it } from 'vitest';
import {
  chooseNewestWorkoutDocument,
  createWorkoutLogCandidate,
  createWorkoutTombstoneCandidate,
  type CloudWorkoutDocument,
} from './gymSync';
import { timestampAfter } from './useGymSync';
import { normalizeLog } from './storage';
import type { WorkoutLog } from './types';

const DATE = '2026-08-07';
const EARLIER = '2026-08-07T10:00:00.000Z';
const LATER = '2026-08-07T12:00:00.000Z';

function workout(overrides: Partial<WorkoutLog> = {}): WorkoutLog {
  return normalizeLog(DATE, { date: DATE, updatedAt: EARLIER, ...overrides });
}

function logDocument(updatedAt: string, clientId = 'client-a'): CloudWorkoutDocument {
  return createWorkoutLogCandidate(workout({ updatedAt }), clientId);
}

function tombstone(updatedAt: string, clientId = 'client-a'): CloudWorkoutDocument {
  return createWorkoutTombstoneCandidate(DATE, updatedAt, clientId);
}

describe('workout document candidates', () => {
  it('derives the millisecond ordering key from the ISO stamp', () => {
    expect(logDocument(EARLIER).updatedAtMs).toBe(Date.parse(EARLIER));
    expect(tombstone(LATER).updatedAtMs).toBe(Date.parse(LATER));
    expect(logDocument(EARLIER).deleted).toBe(false);
    expect(tombstone(EARLIER).deleted).toBe(true);
  });

  it('refuses inputs that would corrupt a document path or its ordering', () => {
    expect(() => createWorkoutLogCandidate({ ...workout(), date: '7 August 2026' }, 'client-a')).toThrow();
    expect(() => createWorkoutLogCandidate({ ...workout(), updatedAt: 'yesterday' }, 'client-a')).toThrow();
    expect(() => createWorkoutTombstoneCandidate('2026-8-7', EARLIER, 'client-a')).toThrow();
    expect(() => createWorkoutTombstoneCandidate(DATE, EARLIER, 'client/a')).toThrow();
    expect(() => createWorkoutTombstoneCandidate(DATE, EARLIER, '  ')).toThrow();
    expect(() => createWorkoutTombstoneCandidate(DATE, 'yesterday', 'client-a')).toThrow();
  });
});

describe('merge ordering', () => {
  it('takes the newest stamp whichever side it arrives on', () => {
    const older = logDocument(EARLIER);
    const newer = logDocument(LATER);
    expect(chooseNewestWorkoutDocument(older, newer)).toBe(newer);
    expect(chooseNewestWorkoutDocument(newer, older)).toBe(newer);
  });

  it('accepts whichever side exists when only one does', () => {
    const only = logDocument(EARLIER);
    expect(chooseNewestWorkoutDocument(only, undefined)).toBe(only);
    expect(chooseNewestWorkoutDocument(undefined, only)).toBe(only);
    expect(chooseNewestWorkoutDocument(undefined, undefined)).toBeUndefined();
  });

  it('settles identical stamps the same way regardless of argument order', () => {
    const first = logDocument(EARLIER, 'client-a');
    const second = logDocument(EARLIER, 'client-z');
    expect(chooseNewestWorkoutDocument(first, second)).toBe(chooseNewestWorkoutDocument(second, first));
  });
});

describe('tombstones', () => {
  it('lets a newer deletion clear an older workout', () => {
    const deletion = tombstone(LATER);
    expect(chooseNewestWorkoutDocument(logDocument(EARLIER), deletion)).toBe(deletion);
  });

  it('lets a newer workout replace an older deletion, which is how a day is re-logged', () => {
    const relogged = logDocument(LATER);
    expect(chooseNewestWorkoutDocument(tombstone(EARLIER), relogged)).toBe(relogged);
  });

  it('keeps a cleared workout cleared when the two stamps tie', () => {
    const deletion = tombstone(EARLIER, 'client-z');
    const live = logDocument(EARLIER, 'client-a');
    expect(chooseNewestWorkoutDocument(live, deletion)).toBe(deletion);
    expect(chooseNewestWorkoutDocument(deletion, live)).toBe(deletion);
  });
});

describe('clock skew defence', () => {
  it('stamps strictly past every reading it is given', () => {
    const stamped = Date.parse(timestampAfter(EARLIER, Date.parse(LATER)));
    expect(stamped).toBeGreaterThan(Date.parse(LATER));
  });

  it('never stamps behind this device even when every reading is older', () => {
    expect(Date.parse(timestampAfter('2001-01-01T00:00:00.000Z'))).toBeGreaterThanOrEqual(Date.now() - 1_000);
  });

  it('ignores readings it cannot parse', () => {
    const stamped = Date.parse(timestampAfter(undefined, 'not a timestamp', Number.NaN));
    expect(Number.isFinite(stamped)).toBe(true);
    expect(stamped).toBeGreaterThanOrEqual(Date.now() - 1_000);
  });

  it('lets a device with a slow clock still win with a genuinely newer edit', () => {
    // The remote was written two hours ahead by a device whose clock runs fast.
    // Raw local stamps would lose this conflict on every snapshot, forever.
    const fastRemote = logDocument(LATER, 'fast-device');
    const bumped = logDocument(timestampAfter(EARLIER, fastRemote.updatedAtMs), 'slow-device');
    expect(chooseNewestWorkoutDocument(fastRemote, bumped)).toBe(bumped);
  });

  it('lifts a deletion past a faster device so the clear is not undone', () => {
    const fastRemote = logDocument(LATER, 'fast-device');
    const bumped = tombstone(timestampAfter(EARLIER, fastRemote.updatedAtMs), 'slow-device');
    expect(chooseNewestWorkoutDocument(fastRemote, bumped)).toBe(bumped);
  });
});
