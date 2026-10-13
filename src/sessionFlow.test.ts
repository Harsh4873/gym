import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildExerciseHistory,
  canFinishSession,
  findPreviousExerciseDetail,
  formatSetSummary,
  getDayStatus,
  getExercisePreviousBest,
  loadLogsWithCurrentPlan,
  restTimerAfterComplete,
  samePastLogRefs,
  trainingCreditForLog,
} from './App';
import { normalizeLog } from './storage';
import { PROGRAM } from './program';
import { STORAGE_KEY } from './storage';
import type { Exercise, WorkoutLog } from './types';

function log(partial: Partial<WorkoutLog> & Pick<WorkoutLog, 'date'>): WorkoutLog {
  return {
    completed: [],
    skipped: [],
    details: {},
    notes: '',
    prNote: '',
    supersets: [],
    daySkipped: false,
    updatedAt: '2026-10-12T00:00:00.000Z',
    ...partial,
  };
}

const exercise = (id: string): Exercise => ({
  id,
  day: 'Friday',
  name: id,
  kind: 'strength',
  target: { sets: 3, restSeconds: 90 },
});

describe('day status', () => {
  const exercises = [exercise('a'), exercise('b')];

  it('keeps an untouched future day future, and shows work that was logged early', () => {
    expect(getDayStatus('2026-10-14', log({ date: '2026-10-14' }), '2026-10-13', exercises)).toBe('future');
    expect(getDayStatus(
      '2026-10-14',
      log({ date: '2026-10-14', completed: ['a', 'b'] }),
      '2026-10-13',
      exercises,
    )).toBe('completed');
    expect(getDayStatus(
      '2026-10-14',
      log({ date: '2026-10-14', completed: ['a'] }),
      '2026-10-13',
      exercises,
    )).toBe('partial');
    expect(getDayStatus(
      '2026-10-14',
      log({ date: '2026-10-14', daySkipped: true }),
      '2026-10-13',
      exercises,
    )).toBe('skipped');
    expect(getDayStatus('2026-10-13', log({ date: '2026-10-13' }), '2026-10-13', exercises)).toBe('planned');
    expect(getDayStatus('2026-10-12', log({ date: '2026-10-12' }), '2026-10-13', exercises)).toBe('unlogged');
  });
});

describe('session logging', () => {
  it('leaves a running rest timer alone when the completed exercise has no rest', () => {
    const running = { dateKey: '2026-10-12', remainingSeconds: 40, endsAt: 10_000 };
    expect(restTimerAfterComplete(running, 0, 5_000)).toEqual(running);
    expect(restTimerAfterComplete(running, 90, 5_000)).toEqual({
      dateKey: '2026-10-12',
      remainingSeconds: 90,
      endsAt: 95_000,
    });
  });

  it('lets a started session of only skipped exercises be finished', () => {
    const exercises = [exercise('a'), exercise('b')];
    const skipped = log({
      date: '2026-10-12',
      startedAt: '2026-10-12T12:00:00.000Z',
      skipped: ['a', 'b'],
    });
    expect(canFinishSession(skipped, exercises)).toBe(true);
    expect(canFinishSession(log({ date: '2026-10-12', startedAt: '2026-10-12T12:00:00.000Z' }), exercises)).toBe(false);
    expect(canFinishSession(log({ date: '2026-10-12', skipped: ['a', 'b'] }), exercises)).toBe(false);
    expect(canFinishSession(log({ date: '2026-10-12', completed: ['a'] }), exercises)).toBe(true);
  });

  it('does not add a skipped day to the training totals', () => {
    const worked = log({
      date: '2026-10-12',
      prNote: 'Bench',
      details: {
        bench: {
          sets: [{ id: 'set-1', weightMode: 'pounds', pounds: '100', reps: '5' }],
        },
      },
    });
    expect(trainingCreditForLog(worked)).toEqual({ reps: 5, volume: 500, prNote: 'Bench' });
    expect(trainingCreditForLog({ ...worked, daySkipped: true })).toEqual({ reps: 0, volume: 0, prNote: '' });
  });

  it('ignores sets logged on a skipped day when looking up the previous session', () => {
    const bench = exercise('bench');
    bench.name = 'Bench';
    const detail = {
      exerciseName: 'Bench',
      sets: [{ id: 'set-1', weightMode: 'pounds' as const, pounds: '100', reps: '5' }],
    };
    const earlier = {
      exerciseName: 'Bench',
      sets: [{ id: 'set-1', weightMode: 'pounds' as const, pounds: '90', reps: '5' }],
    };
    const logs = {
      '2026-10-11': log({ date: '2026-10-11', daySkipped: true, details: { bench: detail } }),
      '2026-10-10': log({ date: '2026-10-10', details: { bench: earlier } }),
    };

    expect(findPreviousExerciseDetail(bench, '2026-10-12', logs)?.dateKey).toBe('2026-10-10');
    expect(getExercisePreviousBest(bench, '2026-10-12', logs)).toBe(450);
    expect(findPreviousExerciseDetail(bench, '2026-10-12', { '2026-10-11': logs['2026-10-11'] })).toBeNull();
  });

  it('stores a stretch hold as seconds and leaves strength reps alone', () => {
    const bridge: Exercise = {
      ...exercise('sunday-23'),
      name: 'Glute Bridge',
      kind: 'stretch',
    };
    const stored = normalizeLog('2026-10-10', log({
      date: '2026-10-10',
      exerciseSnapshot: [bridge],
      details: {
        'sunday-23': {
          exerciseName: 'Glute Bridge',
          sets: [{ id: 'set-1', weightMode: 'bodyweight', pounds: '40', reps: '20' }],
        },
        bench: {
          exerciseName: 'Bench',
          sets: [{ id: 'set-1', weightMode: 'pounds', pounds: '100', reps: '5' }],
        },
      },
    }));

    expect(stored.details['sunday-23'].sets[0]).toMatchObject({ holdSeconds: '20', reps: '', pounds: '' });
    expect(formatSetSummary(stored.details['sunday-23'].sets, 'stretch')).toBe('20 sec');
    expect(formatSetSummary(stored.details.bench.sets, 'strength')).toBe('100 x 5');
    expect(trainingCreditForLog(stored)).toEqual({ reps: 5, volume: 500, prNote: '' });
    expect(formatSetSummary(
      [{ id: 'set-1', weightMode: 'bodyweight', pounds: '', reps: '', holdSeconds: '15' }],
      'stretch',
    )).toBe('15 sec');
  });

  it('reads previous detail and best volume once, and ignores edits to today', () => {
    const bench = exercise('bench');
    bench.name = 'Bench';
    const earlier = {
      exerciseName: 'Bench',
      sets: [{ id: 'set-1', weightMode: 'pounds' as const, pounds: '90', reps: '5' }],
    };
    const skippedDetail = {
      exerciseName: 'Bench',
      sets: [{ id: 'set-1', weightMode: 'pounds' as const, pounds: '100', reps: '5' }],
    };
    const past = log({ date: '2026-10-10', details: { bench: earlier } });
    const skipped = log({ date: '2026-10-11', daySkipped: true, details: { bench: skippedDetail } });
    const today = log({ date: '2026-10-12', notes: 'first' });
    const logs = {
      '2026-10-10': past,
      '2026-10-11': skipped,
      '2026-10-12': today,
    };
    const history = buildExerciseHistory([bench], '2026-10-12', logs);
    expect(history.previous.get('bench')?.dateKey).toBe('2026-10-10');
    expect(history.best.get('bench')).toBe(getExercisePreviousBest(bench, '2026-10-12', logs));
    expect(history.previous.get('bench')?.detail).toEqual(
      findPreviousExerciseDetail(bench, '2026-10-12', logs)?.detail,
    );

    const pastRefs = new Map([['2026-10-10', past], ['2026-10-11', skipped]]);
    expect(samePastLogRefs(logs, '2026-10-12', pastRefs)).toBe(true);
    expect(samePastLogRefs({ ...logs, '2026-10-12': { ...today, notes: 'typed' } }, '2026-10-12', pastRefs)).toBe(true);
    expect(samePastLogRefs({ ...logs, '2026-10-10': { ...past, notes: 'changed' } }, '2026-10-12', pastRefs)).toBe(false);
  });
});

describe('weekly plan rollout', () => {
  afterEach(() => vi.unstubAllGlobals());

  function stubStorage(records: Record<string, string>) {
    const stored = new Map(Object.entries(records));
    vi.stubGlobal('window', {
      localStorage: {
        getItem: (key: string) => stored.get(key) ?? null,
        setItem: (key: string, value: string) => stored.set(key, value),
      },
    });
    return stored;
  }

  it('does not publish a today log when this device has never stored today', () => {
    const stored = stubStorage({
      [STORAGE_KEY]: JSON.stringify({
        version: 1,
        logs: {
          '2026-10-11': log({ date: '2026-10-11', updatedAt: '2026-10-11T08:00:00.000Z' }),
        },
      }),
    });

    const logs = loadLogsWithCurrentPlan('2026-10-12', PROGRAM);
    expect(logs['2026-10-12']).toBeUndefined();
    const saved = JSON.parse(stored.get(STORAGE_KEY) ?? '{}') as { logs: Record<string, unknown> };
    expect(saved.logs['2026-10-12']).toBeUndefined();
    expect(stored.get('harsh-gym-weekly-plan-v7-rollout')).toBe('2026-10-12');
  });

  it('keeps the stored updatedAt when today\'s snapshot changes', () => {
    const updatedAt = '2026-10-12T08:00:00.000Z';
    const mondayId = PROGRAM.Monday[0].id;
    const stored = stubStorage({
      [STORAGE_KEY]: JSON.stringify({
        version: 1,
        logs: {
          '2026-10-12': log({
            date: '2026-10-12',
            updatedAt,
            completed: ['foreign-move', mondayId],
            exerciseSnapshot: [{
              id: 'foreign-move',
              day: 'Monday',
              name: 'Old move',
              kind: 'strength',
              target: { sets: 3, restSeconds: 90 },
            }],
          }),
        },
      }),
    });

    const logs = loadLogsWithCurrentPlan('2026-10-12', PROGRAM);
    expect(logs['2026-10-12']?.updatedAt).toBe(updatedAt);
    expect(logs['2026-10-12']?.completed).toEqual([mondayId]);
    expect(logs['2026-10-12']?.exerciseSnapshot?.map((entry) => entry.id)).toEqual(
      PROGRAM.Monday.map((entry) => entry.id),
    );
    const saved = JSON.parse(stored.get(STORAGE_KEY) ?? '{}') as {
      logs: Record<string, { updatedAt: string }>;
    };
    expect(saved.logs['2026-10-12']?.updatedAt).toBe(updatedAt);
  });

  it('leaves storage alone when today already matches the template', () => {
    const updatedAt = '2026-10-12T08:00:00.000Z';
    const raw = JSON.stringify({
      version: 1,
      logs: {
        '2026-10-12': log({
          date: '2026-10-12',
          updatedAt,
          exerciseSnapshot: PROGRAM.Monday,
        }),
      },
    });
    const stored = stubStorage({ [STORAGE_KEY]: raw });

    const logs = loadLogsWithCurrentPlan('2026-10-12', PROGRAM);
    expect(logs['2026-10-12']?.updatedAt).toBe(updatedAt);
    expect(stored.get(STORAGE_KEY)).toBe(raw);
    expect(stored.get('harsh-gym-weekly-plan-v7-rollout')).toBe('2026-10-12');
  });
});
