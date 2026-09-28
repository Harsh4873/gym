import { afterEach, describe, expect, it, vi } from 'vitest';
import { getWorkoutSectionOrder, listWorkoutSectionLabels, moveStretchToMorning, PROGRAM, WEEK_DAYS } from './program';
import { createGymBackup, DEFAULT_PREFERENCES, normalizeLog, normalizePreferences, normalizeProgram, loadProgram, parseGymBackup, PROGRAM_STORAGE_KEY, STORAGE_KEY } from './storage';
import type { ProgramByDay } from './types';

function eveningProgram(): ProgramByDay {
  const program = structuredClone(PROGRAM);
  for (const day of WEEK_DAYS) {
    const hasStretch = program[day].some((exercise) => exercise.workoutLabel === 'Morning Stretch');
    const lastBlock = Math.max(...program[day].map(getWorkoutSectionOrder));
    if (!hasStretch) continue;
    program[day] = program[day].map((exercise) => ({
      ...exercise,
      workoutLabel: exercise.workoutLabel === 'Morning Stretch' ? 'Stretch' : exercise.workoutLabel,
      blockOrder: day === 'Sunday' ? getWorkoutSectionOrder(exercise) : exercise.workoutLabel === 'Morning Stretch' ? lastBlock : getWorkoutSectionOrder(exercise) - 1,
    })).sort((a, b) => getWorkoutSectionOrder(a) - getWorkoutSectionOrder(b));
  }
  return program;
}

afterEach(() => vi.unstubAllGlobals());

describe('morning stretch migration', () => {
  it('updates saved v16 plans once while preserving exercise identities, personal edits, and logs', () => {
    const program = eveningProgram();
    const bench = program.Monday.find((exercise) => exercise.id === 'monday-1')!;
    bench.name = 'Custom Bench';
    bench.target = { sets: 5, repMin: 5, repMax: 5, restSeconds: 150 };
    program.Monday.push({ ...bench, id: 'monday-custom-test', name: 'Custom exercise' });
    const logs = JSON.stringify({ '2026-09-07': { completed: ['monday-1'], exerciseSnapshot: program.Monday } });
    const stored = new Map([
      [PROGRAM_STORAGE_KEY, JSON.stringify({ version: 16, program })],
      [STORAGE_KEY, logs],
    ]);
    vi.stubGlobal('window', { localStorage: {
      getItem: (key: string) => stored.get(key) ?? null,
      setItem: (key: string, value: string) => stored.set(key, value),
    } });

    const migrated = loadProgram();
    expect(listWorkoutSectionLabels(migrated.Tuesday)).toEqual(['Morning Stretch', 'Biceps + Triceps']);
    expect(migrated.Monday.find((exercise) => exercise.id === bench.id)).toMatchObject({ name: bench.name, target: bench.target });
    expect(migrated.Monday[migrated.Monday.length - 1]?.name).toBe('Custom exercise');
    for (const day of WEEK_DAYS) {
      expect(migrated[day].map((exercise) => exercise.id).sort()).toEqual(program[day].map((exercise) => exercise.id).sort());
    }
    expect(stored.get(STORAGE_KEY)).toBe(logs);
    expect(JSON.parse(stored.get(PROGRAM_STORAGE_KEY)!).version).toBe(17);
    expect(loadProgram()).toEqual(migrated);
  });

  it('moves an existing workout to morning without mutating its snapshot or changing exercises', () => {
    const snapshot = eveningProgram().Thursday;
    const original = structuredClone(snapshot);
    const scheduled = moveStretchToMorning(snapshot);
    expect(listWorkoutSectionLabels(scheduled)).toEqual(['Morning Stretch', 'Back + Chest']);
    expect(scheduled.map(getWorkoutSectionOrder)).toEqual([1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2]);
    expect(snapshot).toEqual(original);
    expect(scheduled.map(({ id, name, target }) => ({ id, name, target })).sort((a, b) => a.id.localeCompare(b.id)))
      .toEqual(original.map(({ id, name, target }) => ({ id, name, target })).sort((a, b) => a.id.localeCompare(b.id)));
    expect(moveStretchToMorning(scheduled)).toBe(scheduled);
    expect(moveStretchToMorning(PROGRAM.Friday)).toBe(PROGRAM.Friday);
  });
});

describe('legacy stretch data', () => {
  it('normalizes saved programs, log snapshots, and backups that still say mobility', () => {
    const program = structuredClone(PROGRAM);
    const exercise = program.Tuesday[0];
    (exercise as { kind: string }).kind = 'mobility';
    const normalized = normalizeProgram(program);
    expect(normalized.Tuesday[0]).toMatchObject({ id: exercise.id, kind: 'stretch', target: exercise.target });

    const date = '2026-09-28';
    const log = normalizeLog(date, { exerciseSnapshot: [PROGRAM.Tuesday[0]] });
    (log.exerciseSnapshot![0] as { kind: string }).kind = 'mobility';
    expect(normalizeLog(date, log).exerciseSnapshot![0].kind).toBe('stretch');

    const backup = createGymBackup({ [date]: log }, PROGRAM, DEFAULT_PREFERENCES);
    (backup.program.Tuesday[0] as { kind: string }).kind = 'mobility';
    (backup.logs[date].exerciseSnapshot![0] as { kind: string }).kind = 'mobility';
    const imported = parseGymBackup(backup);
    expect(imported).not.toBeNull();
    expect(imported!.program.Tuesday[0].kind).toBe('stretch');
    expect(imported!.logs[date].exerciseSnapshot![0].kind).toBe('stretch');
  });

  it('updates the old default ankle title without changing its exercise id', () => {
    const program = structuredClone(PROGRAM);
    program.Sunday[0].name = 'Knee-to-Wall Ankle Mobility';
    expect(normalizeProgram(program).Sunday[0]).toMatchObject({
      id: program.Sunday[0].id,
      name: 'Knee-to-Wall Ankle Stretch',
    });
    const log = normalizeLog('2026-09-28', {
      details: { 'sunday-14': { exerciseName: 'Knee-to-Wall Ankle Mobility', sets: [] } },
    });
    expect(log.details['sunday-14'].exerciseName).toBe('Knee-to-Wall Ankle Stretch');
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
