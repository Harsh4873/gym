import { describe, expect, it } from 'vitest';
import {
  CYCLE_ANCHOR_DATE,
  CYCLE_ANCHOR_SESSION,
  DEFAULT_PROGRAM,
  daysBetweenDateKeys,
  getSessionForDate,
  getWorkoutSectionKey,
  inferExerciseKind,
  isStretchExercise,
  listWorkoutSectionLabels,
  orderExercisesForSession,
  PROGRAM,
  PROGRAM_NOTES,
  sectionFieldsForAddedExercise,
  SESSION_IDS,
  SHIPPED_DEFAULT_EXERCISE_NAMES,
} from './program';
import { getTodayDateKey, getWeekday, parseDateKey } from './dateUtils';

const STRETCH_NAMES = [
  'Cat-Cow',
  'Bird Dog',
  'Hip Flexor Stretch',
  'Glute Bridge',
  "Child's Pose",
  'Figure-4 Glute Stretch',
] as const;

const LIFTS_BY_SESSION: Record<keyof typeof PROGRAM, string[]> = {
  'CBL R1': ['Flat Bench', 'Lat Pulldown', 'Hack Squat', 'Ab Machine', 'Calf Raises', 'Tibialis Raise'],
  'SARMS R1': ['Dumbbell Shoulder Press', 'Incline Curls', 'Overhead Extension', 'Leg Raises'],
  'CBL R2': ['Flat DB Bench', 'Low Row', 'Hip Thrust', 'Back Extension + Incline Sit-Ups'],
  'SARMS R2': ['Military Press', 'Preacher Curl', 'Dips', 'Ab Machine'],
  'CBL R3': ['Incline Bench', 'Face Pulls', 'Bulgarian Split Squat', 'Leg Raises'],
  'SARMS R3': ['Lateral Raises', 'Hammer Curl', 'Triceps 7x7', 'Back Extension + Incline Sit-Ups'],
  'CBL R4': ['Incline Smith Bench', 'Lat Pulldown', 'Hack Squat', 'Ab Machine'],
  'SARMS R4': ['Front Raises', 'EZ Bar Curls', 'Zottman Curls', 'Overhead Extension', 'Leg Raises'],
};

const EXTRA_BY_SESSION: Record<keyof typeof PROGRAM, string[]> = {
  'CBL R1': ['Calf Raises', 'Tibialis Raise'],
  'SARMS R1': [],
  'CBL R2': [],
  'SARMS R2': [],
  'CBL R3': [],
  'SARMS R3': [],
  'CBL R4': [],
  'SARMS R4': ['Zottman Curls'],
};

const ANCHOR_DATES: Array<[string, (typeof SESSION_IDS)[number]]> = [
  ['2026-11-21', 'CBL R3'],
  ['2026-11-22', 'SARMS R3'],
  ['2026-11-23', 'CBL R4'],
  ['2026-11-24', 'SARMS R4'],
  ['2026-11-25', 'CBL R1'],
  ['2026-11-26', 'SARMS R1'],
  ['2026-11-27', 'CBL R2'],
  ['2026-11-28', 'SARMS R2'],
  ['2026-11-29', 'CBL R3'],
];

function namesForLabel(session: keyof typeof PROGRAM, label: string): string[] {
  return PROGRAM[session].filter((exercise) => exercise.workoutLabel === label).map((exercise) => exercise.name);
}

function extraNames(session: keyof typeof PROGRAM): string[] {
  return PROGRAM[session].filter((exercise) => exercise.extra).map((exercise) => exercise.name);
}

describe('8-day CBL/SARMS rotation', () => {
  it('anchors the cycle to calendar dates, including days before the anchor and far in the future', () => {
    expect(CYCLE_ANCHOR_DATE).toBe('2026-11-21');
    expect(CYCLE_ANCHOR_SESSION).toBe('CBL R3');
    expect(SESSION_IDS).toEqual([
      'CBL R1',
      'SARMS R1',
      'CBL R2',
      'SARMS R2',
      'CBL R3',
      'SARMS R3',
      'CBL R4',
      'SARMS R4',
    ]);

    for (const [dateKey, session] of ANCHOR_DATES) {
      expect(getSessionForDate(dateKey), dateKey).toBe(session);
    }

    expect(getSessionForDate('2026-11-20')).toBe('SARMS R2');
    expect(getSessionForDate('2026-11-13')).toBe('CBL R3');
    expect(getSessionForDate('2025-11-21')).toBe('SARMS R4');
    expect(getSessionForDate('2028-11-21')).toBe('SARMS R4');
    expect(daysBetweenDateKeys('2026-11-21', '2026-11-21')).toBe(0);
    expect(daysBetweenDateKeys('2026-11-21', '2026-11-29')).toBe(8);
    expect(daysBetweenDateKeys('2026-11-29', '2026-11-21')).toBe(-8);
  });

  it('is date-offset based, so two Saturdays can be different sessions', () => {
    expect(getWeekday(parseDateKey('2026-11-21'))).toBe('Saturday');
    expect(getWeekday(parseDateKey('2026-11-28'))).toBe('Saturday');
    expect(getSessionForDate('2026-11-21')).toBe('CBL R3');
    expect(getSessionForDate('2026-11-28')).toBe('SARMS R2');
    expect(getSessionForDate('2026-11-20')).not.toBe('CBL R1');
  });

  it('computes today as the America/Chicago civil date', () => {
    expect(getTodayDateKey(new Date('2026-11-21T06:00:00.000Z'))).toBe('2026-11-21');
    expect(getTodayDateKey(new Date('2026-11-21T05:59:00.000Z'))).toBe('2026-11-20');
    expect(getTodayDateKey(new Date('2026-07-01T05:00:00.000Z'))).toBe('2026-07-01');
    expect(getTodayDateKey(new Date('2026-07-01T04:59:00.000Z'))).toBe('2026-06-30');
    expect(getSessionForDate(getTodayDateKey(new Date('2026-11-21T06:00:00.000Z')))).toBe('CBL R3');
  });
});

describe('CBL/SARMS program', () => {
  it('treats stretch names and every stretch block as Stretch', () => {
    for (const name of ['Bird Dog', '90/90 Hip Switches', 'Adductor Rock-Back', 'Wall Thoracic Rotation']) {
      expect(isStretchExercise(name), name).toBe(true);
      expect(inferExerciseKind(name), name).toBe('stretch');
    }
    for (const session of SESSION_IDS) {
      expect(
        PROGRAM[session]
          .filter((exercise) => exercise.workoutLabel === 'Stretch')
          .every((exercise) => exercise.kind === 'stretch'),
      ).toBe(true);
      expect(namesForLabel(session, 'Stretch')).toEqual([...STRETCH_NAMES]);
      expect(PROGRAM[session].filter((exercise) => exercise.workoutLabel === 'Stretch').every((exercise) => {
        return exercise.target.sets === 1;
      })).toBe(true);
    }
  });

  it('ships the locked CBL and SARMS lifts, with optional calf work and Zottman curls extra', () => {
    for (const session of SESSION_IDS) {
      expect(listWorkoutSectionLabels(PROGRAM[session])).toEqual(['Stretch', session]);
      expect(namesForLabel(session, session)).toEqual(LIFTS_BY_SESSION[session]);
      expect(extraNames(session)).toEqual(EXTRA_BY_SESSION[session]);
      expect(PROGRAM[session].some((exercise) => exercise.name === 'Legs')).toBe(false);
      expect(PROGRAM[session].some((exercise) => /10 min ab workout|nippard/i.test(exercise.name))).toBe(false);
    }

    expect(PROGRAM['CBL R1'].find((exercise) => exercise.name === 'Flat Bench')?.target).toEqual({
      sets: 4,
      repMin: 6,
      repMax: 10,
      restSeconds: 120,
    });
    expect(PROGRAM['SARMS R3'].find((exercise) => exercise.name === 'Triceps 7x7')?.target).toEqual({
      sets: 7,
      repMin: 7,
      repMax: 7,
      restSeconds: 60,
    });
    expect(PROGRAM_NOTES).toBe('Work top to bottom. Leave 2-3 reps in the tank. Never go to failure.');
  });

  it('never puts abs and stretch under the same heading, and never ships retired, bot, or court-sport exercises', () => {
    for (const session of SESSION_IDS) {
      expect(DEFAULT_PROGRAM[session].some((exercise) => exercise.name === 'Single-Arm Row')).toBe(false);
      const byLabel = new Map<string, string[]>();
      for (const exercise of PROGRAM[session]) {
        expect(exercise).not.toHaveProperty('owner');
        expect(exercise.name).not.toMatch(/basketball|badminton|dead bug|ab rolls|\(sch\)|\(cursor\)/i);
        expect(exercise.name).not.toBe('Single-Arm Row');
        expect(getWorkoutSectionKey(exercise)).toBe(
          `${exercise.blockOrder ?? exercise.workoutBlock ?? 1}::${exercise.workoutLabel ?? ''}`,
        );
        const label = exercise.workoutLabel ?? '';
        const names = byLabel.get(label) ?? [];
        names.push(exercise.name);
        byLabel.set(label, names);
      }

      const stretchKeys = PROGRAM[session]
        .filter((exercise) => exercise.workoutLabel === 'Stretch')
        .map((exercise) => getWorkoutSectionKey(exercise));
      const trainingKeys = PROGRAM[session]
        .filter((exercise) => exercise.workoutLabel && exercise.workoutLabel !== 'Stretch')
        .map((exercise) => getWorkoutSectionKey(exercise));
      for (const stretchKey of stretchKeys) {
        expect(trainingKeys).not.toContain(stretchKey);
      }
    }
  });

  it('ships unique movements per session and records every current default name as shipped', () => {
    for (const session of SESSION_IDS) {
      const slots = DEFAULT_PROGRAM[session].map((exercise) => exercise.slot);
      expect(new Set(slots).size).toBe(slots.length);

      const names = PROGRAM[session].map((exercise) => exercise.name);
      expect(new Set(names).size).toBe(names.length);

      for (const exercise of PROGRAM[session]) {
        expect(SHIPPED_DEFAULT_EXERCISE_NAMES.get(exercise.id)?.has(exercise.name)).toBe(true);
      }
    }
  });

  it('keeps a logged reorder and sinks finished work inside its own section', () => {
    const session = PROGRAM['SARMS R1'];
    const lift = session.find((exercise) => exercise.name === 'Incline Curls')!;
    const stretch = session.find((exercise) => exercise.name === 'Cat-Cow')!;
    const reordered = [lift, stretch, ...session.filter((exercise) => exercise !== lift && exercise !== stretch)];
    expect(orderExercisesForSession(reordered, new Set()).map((exercise) => exercise.id)).toEqual(
      reordered.map((exercise) => exercise.id),
    );

    const catCow = session.find((exercise) => exercise.name === 'Cat-Cow')!;
    const sunk = orderExercisesForSession(session, new Set([catCow.id])).map((exercise) => exercise.name);
    const liftsStart = sunk.indexOf('Dumbbell Shoulder Press');
    expect(sunk.slice(0, liftsStart)).toEqual([
      'Bird Dog',
      'Hip Flexor Stretch',
      'Glute Bridge',
      "Child's Pose",
      'Figure-4 Glute Stretch',
      'Cat-Cow',
    ]);
    expect(sunk.slice(liftsStart)).toEqual([...LIFTS_BY_SESSION['SARMS R1']]);
  });

  it('files an added exercise under the last block on that session', () => {
    expect(sectionFieldsForAddedExercise(PROGRAM['SARMS R1'], 'strength')).toMatchObject({
      workoutLabel: 'SARMS R1',
      blockOrder: 2,
    });
    expect(sectionFieldsForAddedExercise(PROGRAM['CBL R3'], 'strength').workoutLabel).toBe('CBL R3');
    expect(sectionFieldsForAddedExercise([], 'strength')).toEqual({});
    const stretch = PROGRAM['SARMS R1'].filter((exercise) => exercise.workoutLabel === 'Stretch');
    expect(sectionFieldsForAddedExercise(stretch, 'strength')).toMatchObject({
      workoutLabel: 'Strength',
      blockOrder: 2,
    });
    expect(sectionFieldsForAddedExercise(stretch, 'stretch')).toMatchObject({
      workoutLabel: 'Stretch',
      blockOrder: 1,
    });
  });
});
