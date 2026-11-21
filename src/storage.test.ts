import { afterEach, describe, expect, it, vi } from 'vitest';
import { getWorkoutSectionOrder, listWorkoutSectionLabels, moveStretchToMorning, PROGRAM, SESSION_IDS, WEEK_DAYS } from './program';
import { createGymBackup, DEFAULT_PREFERENCES, normalizeLog, normalizePreferences, normalizeProgram, loadProgram, parseGymBackup, PROGRAM_STORAGE_KEY, STORAGE_KEY } from './storage';
import type { Exercise, ProgramByDay, Weekday } from './types';

const LEGACY_WEEKDAYS: Weekday[] = [...WEEK_DAYS];

function weekdayProgramFromSessions(): Record<Weekday, Exercise[]> {
  const sourceDays: Weekday[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const program = {} as Record<Weekday, Exercise[]>;
  sourceDays.forEach((day, index) => {
    const session = SESSION_IDS[index];
    program[day] = PROGRAM[session].map((exercise) => ({
      ...exercise,
      id: `${day.toLowerCase()}-${exercise.id.split('-').pop()}`,
      day,
      workoutLabel: exercise.workoutLabel === 'Stretch' ? 'Morning Stretch' : exercise.workoutLabel,
    }));
  });
  return program;
}

function eveningProgram(): ProgramByDay {
  const program = structuredClone(PROGRAM);
  for (const session of SESSION_IDS) {
    const lastBlock = Math.max(...program[session].map(getWorkoutSectionOrder));
    program[session] = program[session].map((exercise) => ({
      ...exercise,
      workoutLabel: exercise.workoutLabel === 'Stretch' ? 'Stretch' : exercise.workoutLabel,
      blockOrder: exercise.workoutLabel === 'Stretch' ? lastBlock : getWorkoutSectionOrder(exercise) - 1,
    })).sort((a, b) => getWorkoutSectionOrder(a) - getWorkoutSectionOrder(b));
  }
  return program;
}

afterEach(() => vi.unstubAllGlobals());

describe('CBL/SARMS program migration', () => {
  it('replaces a saved weekday split with the 8-day cycle while leaving logs untouched', () => {
    const weekdayProgram = weekdayProgramFromSessions();
    const mondayBench = weekdayProgram.Monday.find((exercise) => /bench/i.test(exercise.name))!;
    mondayBench.name = 'Custom Bench';
    weekdayProgram.Monday.push({ ...mondayBench, id: 'monday-custom-test', name: 'Custom exercise' });
    const snapshot = weekdayProgram.Monday;
    const logs = JSON.stringify({ '2026-09-07': { completed: ['monday-1'], exerciseSnapshot: snapshot } });
    const stored = new Map([
      [PROGRAM_STORAGE_KEY, JSON.stringify({ version: 17, program: weekdayProgram })],
      [STORAGE_KEY, logs],
    ]);
    vi.stubGlobal('window', { localStorage: {
      getItem: (key: string) => stored.get(key) ?? null,
      setItem: (key: string, value: string) => stored.set(key, value),
    } });

    const migrated = loadProgram();
    expect(Object.keys(migrated)).toEqual([...SESSION_IDS]);
    expect(listWorkoutSectionLabels(migrated['CBL R3'])).toEqual(['Stretch', 'CBL R3']);
    expect(migrated['CBL R1'].map((exercise) => exercise.name)).toEqual(PROGRAM['CBL R1'].map((exercise) => exercise.name));
    expect(Object.keys(migrated)).not.toContain('Monday');
    expect(stored.get(STORAGE_KEY)).toBe(logs);
    expect(JSON.parse(stored.get(PROGRAM_STORAGE_KEY)!).version).toBe(18);
    expect(loadProgram()).toEqual(migrated);
  });

  it('moves an existing workout to morning without mutating its snapshot or changing exercises', () => {
    const snapshot = eveningProgram()['CBL R3'];
    const original = structuredClone(snapshot);
    const scheduled = moveStretchToMorning(snapshot);
    expect(listWorkoutSectionLabels(scheduled)).toEqual(['Morning Stretch', 'CBL R3']);
    expect(snapshot).toEqual(original);
    expect(scheduled.map(({ id, name, target }) => ({ id, name, target })).sort((a, b) => a.id.localeCompare(b.id)))
      .toEqual(original.map(({ id, name, target }) => ({ id, name, target })).sort((a, b) => a.id.localeCompare(b.id)));
    expect(moveStretchToMorning(scheduled)).toEqual(scheduled);
    expect(moveStretchToMorning(PROGRAM['CBL R3'])).toBe(PROGRAM['CBL R3']);
  });
});

describe('legacy stretch data', () => {
  it('normalizes saved programs, log snapshots, and backups that still say mobility', () => {
    const program = structuredClone(PROGRAM);
    const exercise = program['SARMS R1'][0];
    (exercise as { kind: string }).kind = 'mobility';
    const normalized = normalizeProgram(program);
    expect(normalized['SARMS R1'][0]).toMatchObject({ id: exercise.id, kind: 'stretch', target: exercise.target });

    const date = '2026-09-28';
    const log = normalizeLog(date, { exerciseSnapshot: [PROGRAM['SARMS R1'][0]] });
    (log.exerciseSnapshot![0] as { kind: string }).kind = 'mobility';
    expect(normalizeLog(date, log).exerciseSnapshot![0].kind).toBe('stretch');

    const backup = createGymBackup({ [date]: log }, PROGRAM, DEFAULT_PREFERENCES);
    (backup.program['SARMS R1'][0] as { kind: string }).kind = 'mobility';
    (backup.logs[date].exerciseSnapshot![0] as { kind: string }).kind = 'mobility';
    const imported = parseGymBackup(backup);
    expect(imported).not.toBeNull();
    expect(imported!.program['SARMS R1'][0].kind).toBe('stretch');
    expect(imported!.logs[date].exerciseSnapshot![0].kind).toBe('stretch');
  });

  it('imports a weekday-keyed backup without dropping its logs', () => {
    const weekdayProgram = weekdayProgramFromSessions();
    const date = '2026-09-28';
    const log = normalizeLog(date, {
      exerciseSnapshot: weekdayProgram.Friday,
      completed: ['friday-18'],
      details: { 'sunday-14': { exerciseName: 'Knee-to-Wall Ankle Mobility', sets: [] } },
    });
    const backup = {
      version: 1 as const,
      exportedAt: '2026-09-28T12:00:00.000Z',
      logs: { [date]: log },
      program: weekdayProgram,
      preferences: DEFAULT_PREFERENCES,
    };
    const imported = parseGymBackup(backup);
    expect(imported).not.toBeNull();
    expect(imported!.logs[date].completed).toEqual(['friday-18']);
    expect(imported!.logs[date].details['sunday-14'].exerciseName).toBe('Knee-to-Wall Ankle Stretch');
    expect(Object.keys(imported!.program)).toEqual([...SESSION_IDS]);
    expect(imported!.program['CBL R3'].some((exercise) => exercise.name === 'Incline Bench')).toBe(true);
    expect(Object.keys(imported!.program)).not.toEqual(expect.arrayContaining(LEGACY_WEEKDAYS));
  });
});

describe('preferences', () => {
  it('keeps the logbook on the full log unless checklist is stored', () => {
    expect(normalizePreferences(undefined).logbookView).toBe('log');
    expect(normalizePreferences({}).logbookView).toBe('log');
    expect(normalizePreferences({ logbookView: 'checklist' }).logbookView).toBe('checklist');
    expect(normalizePreferences({ logbookView: 'todo' }).logbookView).toBe('log');
    expect(normalizePreferences({ weeklySessionGoal: 4 }).weeklySessionGoal).toBe(4);
    expect(DEFAULT_PREFERENCES.logbookView).toBe('log');
  });
});
