import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PROGRAM,
  getWorkoutSectionKey,
  listWorkoutSectionLabels,
  PROGRAM,
  SHIPPED_DEFAULT_EXERCISE_NAMES,
  WEEK_DAYS,
} from './program';

const ABS_DAY_NAMES = ['Ab Machine', 'Leg Raises', 'Incline Sit-Ups', 'Abs Circuit'] as const;
const ABS_EXERCISE_NAMES = [...ABS_DAY_NAMES] as const;
const EVENING_STRETCH_NAMES = [
  'Cat-Cow',
  'Bird Dog',
  'Hip Flexor Stretch',
  'Glute Bridge',
  "Child's Pose",
  'Figure-4 Glute Stretch',
] as const;
const MONDAY_CHEST_TRIS_NAMES = [
  'Bench',
  'Overhead Extension',
  'Incline DB',
  'Dips',
] as const;
const WEDNESDAY_CHEST_TRIS_NAMES = [
  'Bench',
  'Incline DB',
  'Machine Chest',
  'Cable Fly',
  'Tricep Pushdown',
  'Overhead Extension',
  'Dips',
] as const;
const BICEPS_SHOULDERS_NAMES = [
  'Dumbbell Shoulder Press',
  'Lateral Raises',
  'Front Raises',
  'Face Pulls',
  'Incline Curls',
  'Hammer Curls',
  'Preacher Curl',
] as const;

function namesForLabel(day: keyof typeof PROGRAM, label: string): string[] {
  return PROGRAM[day].filter((exercise) => exercise.workoutLabel === label).map((exercise) => exercise.name);
}

describe('weekly exercise sections', () => {
  it('keeps Monday short: bench, hamstring stretch, cable extension, incline, dips', () => {
    expect(listWorkoutSectionLabels(PROGRAM.Monday)).toEqual(['Chest + Tris', 'Stretch', 'Chest + Tris']);
    expect(PROGRAM.Monday.map((exercise) => exercise.name)).toEqual([
      'Bench',
      'Standing Hamstring Stretch with Heel Elevated',
      'Overhead Extension',
      'Incline DB',
      'Dips',
    ]);
    expect(namesForLabel('Monday', 'Chest + Tris')).toEqual([...MONDAY_CHEST_TRIS_NAMES]);
    expect(namesForLabel('Monday', 'Stretch')).toEqual(['Standing Hamstring Stretch with Heel Elevated']);
    expect(PROGRAM.Monday.some((exercise) => ABS_EXERCISE_NAMES.includes(exercise.name as typeof ABS_EXERCISE_NAMES[number]))).toBe(false);
  });

  it('keeps Wednesday as chest+tris then evening stretch with no abs', () => {
    expect(listWorkoutSectionLabels(PROGRAM.Wednesday)).toEqual(['Chest + Tris', 'Stretch']);
    expect(namesForLabel('Wednesday', 'Chest + Tris')).toEqual([...WEDNESDAY_CHEST_TRIS_NAMES]);
    expect(namesForLabel('Wednesday', 'Stretch')).toEqual([...EVENING_STRETCH_NAMES]);
    expect(PROGRAM.Wednesday.some((exercise) => ABS_EXERCISE_NAMES.includes(exercise.name as typeof ABS_EXERCISE_NAMES[number]))).toBe(false);
  });

  it('keeps Tuesday as abs, biceps+shoulders, then evening stretch with no morning stretch', () => {
    expect(listWorkoutSectionLabels(PROGRAM.Tuesday)).toEqual([
      'Abs',
      'Biceps + Shoulders',
      'Stretch',
    ]);
    expect(namesForLabel('Tuesday', 'Abs')).toEqual([...ABS_DAY_NAMES]);
    expect(namesForLabel('Tuesday', 'Biceps + Shoulders')).toEqual([...BICEPS_SHOULDERS_NAMES]);
    expect(namesForLabel('Tuesday', 'Stretch')).toEqual([...EVENING_STRETCH_NAMES]);
    expect(namesForLabel('Tuesday', 'Lower Body Stretch')).toEqual([]);
    expect(namesForLabel('Tuesday', 'Upper Body Stretch')).toEqual([]);
  });

  it('keeps Thursday as abs, biceps+shoulders, then evening stretch with no morning stretch', () => {
    expect(listWorkoutSectionLabels(PROGRAM.Thursday)).toEqual([
      'Abs',
      'Biceps + Shoulders',
      'Stretch',
    ]);
    expect(namesForLabel('Thursday', 'Abs')).toEqual([...ABS_DAY_NAMES]);
    expect(namesForLabel('Thursday', 'Biceps + Shoulders')).toEqual([...BICEPS_SHOULDERS_NAMES]);
    expect(namesForLabel('Thursday', 'Stretch')).toEqual([...EVENING_STRETCH_NAMES]);
    expect(namesForLabel('Thursday', 'Lower Body Stretch')).toEqual([]);
    expect(namesForLabel('Thursday', 'Upper Body Stretch')).toEqual([]);
  });

  it('keeps Friday as lift only, Saturday as abs only, and Sunday as evening stretch', () => {
    expect(listWorkoutSectionLabels(PROGRAM.Friday)).toEqual(['Legs + Back']);
    expect(namesForLabel('Friday', 'Legs + Back')).toContain('Back Extension');
    expect(namesForLabel('Friday', 'Stretch')).toEqual([]);
    expect(listWorkoutSectionLabels(PROGRAM.Saturday)).toEqual(['Abs']);
    expect(namesForLabel('Saturday', 'Abs')).toEqual([...ABS_DAY_NAMES]);
    expect(namesForLabel('Saturday', 'Stretch')).toEqual([]);
    expect(listWorkoutSectionLabels(PROGRAM.Sunday)).toEqual(['Stretch']);
    expect(namesForLabel('Sunday', 'Stretch')).toEqual([...EVENING_STRETCH_NAMES]);
  });

  it('never puts abs and stretch under the same heading, and never ships retired, bot, or court-sport exercises', () => {
    for (const day of WEEK_DAYS) {
      expect(DEFAULT_PROGRAM[day].some((exercise) => exercise.name === 'Single-Arm Row')).toBe(false);
      const byLabel = new Map<string, string[]>();
      for (const exercise of PROGRAM[day]) {
        expect(exercise).not.toHaveProperty('owner');
        expect(exercise.name).not.toMatch(/basketball|badminton|dead bug|ab rolls|\(sch\)|\(cursor\)/i);
        expect(exercise.name).not.toMatch(/ez[- ]bar|concentration curls?|military press|lateral raises machine|lateral raises dumbbell/i);
        expect(exercise.name).not.toBe('Single-Arm Row');
        expect(getWorkoutSectionKey(exercise)).toBe(
          `${exercise.blockOrder ?? exercise.workoutBlock ?? 1}::${exercise.workoutLabel ?? ''}`,
        );
        const label = exercise.workoutLabel ?? '';
        const names = byLabel.get(label) ?? [];
        names.push(exercise.name);
        byLabel.set(label, names);
      }

      for (const [label, names] of byLabel) {
        const hasAbs = names.some((name) => ABS_EXERCISE_NAMES.includes(name as typeof ABS_EXERCISE_NAMES[number]));
        const isStretchLabel = /stretch/i.test(label);
        if (isStretchLabel) {
          expect(hasAbs).toBe(false);
        }
        if (label === 'Abs') {
          expect(names).toEqual([...ABS_DAY_NAMES]);
          expect(names.some((name) => /stretch|cat-cow|bird dog|pose|glute bridge|back extension/i.test(name))).toBe(false);
        }
      }

      const stretchKeys = PROGRAM[day]
        .filter((exercise) => exercise.workoutLabel === 'Stretch')
        .map((exercise) => getWorkoutSectionKey(exercise));
      const morningKeys = PROGRAM[day]
        .filter((exercise) => exercise.workoutLabel && exercise.workoutLabel !== 'Stretch')
        .map((exercise) => getWorkoutSectionKey(exercise));
      for (const stretchKey of stretchKeys) {
        expect(morningKeys).not.toContain(stretchKey);
      }
    }
  });

  it('ships unique movements per day and records every current default name as shipped', () => {
    for (const day of WEEK_DAYS) {
      const slots = DEFAULT_PROGRAM[day].map((exercise) => exercise.slot);
      expect(new Set(slots).size).toBe(slots.length);

      const names = PROGRAM[day].map((exercise) => exercise.name);
      expect(new Set(names).size).toBe(names.length);
      expect(names.filter((name) => /lateral raise/i.test(name))).toHaveLength(
        day === 'Tuesday' || day === 'Thursday' ? 1 : 0,
      );
      expect(names.filter((name) => /shoulder press|military press/i.test(name))).toHaveLength(
        day === 'Tuesday' || day === 'Thursday' ? 1 : 0,
      );

      for (const exercise of PROGRAM[day]) {
        expect(SHIPPED_DEFAULT_EXERCISE_NAMES.get(exercise.id)?.has(exercise.name)).toBe(true);
      }
    }
  });
});
