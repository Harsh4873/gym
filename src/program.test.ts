import { describe, expect, it } from 'vitest';
import {
  getWorkoutSectionKey,
  listWorkoutSectionLabels,
  PROGRAM,
  WEEK_DAYS,
} from './program';

const STANDARD_ABS_NAMES = ['Ab Machine', 'Leg Raises'] as const;
const THURSDAY_ABS_NAMES = ['Ab Machine', 'Leg Raises', 'Back Extension', 'Incline Sit-Ups'] as const;
const ABS_EXERCISE_NAMES = [...STANDARD_ABS_NAMES, 'Back Extension', 'Incline Sit-Ups'] as const;
const EVENING_STRETCH_NAMES = [
  'Cat-Cow',
  'Bird Dog',
  'Hip Flexor Stretch',
  'Glute Bridge',
  "Child's Pose",
  'Figure-4 Glute Stretch',
] as const;
const LOWER_BODY_STRETCH_NAMES = [
  'Hip Flexor Stretch',
  'Figure-4 Glute Stretch',
  "Child's Pose",
  'Glute Bridge',
  'Standing Hamstring Stretch',
] as const;
const UPPER_BODY_STRETCH_NAMES = [
  'Cat-Cow',
  'Bird Dog',
  'Open-Book T-Spine',
  'Shoulder Stretch',
] as const;
const CHEST_TRIS_NAMES = [
  'Bench',
  'Incline DB',
  'Machine Chest',
  'Cable Fly',
  'Tricep Pushdown',
  'Overhead Extension',
  'Dips',
] as const;
const TUESDAY_BACK_BIS_NAMES = [
  'Lat Pulldown',
  'Low Row',
  'Single-Arm Row',
  'Face Pulls',
  'Incline Curls',
  'Hammer Curls',
  'Preacher Curl',
] as const;
const THURSDAY_BACK_BIS_NAMES = [
  'Lat Pulldown',
  'Low Row',
  'Face Pulls',
  'Incline Curls',
  'Hammer Curls',
  'Preacher Curl',
] as const;

function namesForLabel(day: keyof typeof PROGRAM, label: string): string[] {
  return PROGRAM[day].filter((exercise) => exercise.workoutLabel === label).map((exercise) => exercise.name);
}

describe('weekly exercise sections', () => {
  it('keeps Monday as lower-body stretch, chest+tris, then evening stretch with no abs', () => {
    expect(listWorkoutSectionLabels(PROGRAM.Monday)).toEqual([
      'Lower Body Stretch',
      'Chest + Tris',
      'Stretch',
    ]);
    expect(namesForLabel('Monday', 'Lower Body Stretch')).toEqual([...LOWER_BODY_STRETCH_NAMES]);
    expect(namesForLabel('Monday', 'Chest + Tris')).toEqual([...CHEST_TRIS_NAMES]);
    expect(namesForLabel('Monday', 'Stretch')).toEqual([...EVENING_STRETCH_NAMES]);
    expect(PROGRAM.Monday.some((exercise) => ABS_EXERCISE_NAMES.includes(exercise.name as typeof ABS_EXERCISE_NAMES[number]))).toBe(false);
  });

  it('keeps Wednesday as upper-body stretch, chest+tris, then evening stretch with no abs', () => {
    expect(listWorkoutSectionLabels(PROGRAM.Wednesday)).toEqual([
      'Upper Body Stretch',
      'Chest + Tris',
      'Stretch',
    ]);
    expect(namesForLabel('Wednesday', 'Upper Body Stretch')).toEqual([...UPPER_BODY_STRETCH_NAMES]);
    expect(namesForLabel('Wednesday', 'Chest + Tris')).toEqual([...CHEST_TRIS_NAMES]);
    expect(namesForLabel('Wednesday', 'Stretch')).toEqual([...EVENING_STRETCH_NAMES]);
    expect(PROGRAM.Wednesday.some((exercise) => ABS_EXERCISE_NAMES.includes(exercise.name as typeof ABS_EXERCISE_NAMES[number]))).toBe(false);
  });

  it('keeps Tuesday as abs, back+bis, then evening stretch with no morning stretch', () => {
    expect(listWorkoutSectionLabels(PROGRAM.Tuesday)).toEqual([
      'Abs',
      'Back + Bis',
      'Stretch',
    ]);
    expect(namesForLabel('Tuesday', 'Abs')).toEqual([...STANDARD_ABS_NAMES]);
    expect(namesForLabel('Tuesday', 'Back + Bis')).toEqual([...TUESDAY_BACK_BIS_NAMES]);
    expect(namesForLabel('Tuesday', 'Stretch')).toEqual([...EVENING_STRETCH_NAMES]);
    expect(namesForLabel('Tuesday', 'Lower Body Stretch')).toEqual([]);
    expect(namesForLabel('Tuesday', 'Upper Body Stretch')).toEqual([]);
  });

  it('keeps Thursday as abs, back+bis, then evening stretch with no morning stretch', () => {
    expect(listWorkoutSectionLabels(PROGRAM.Thursday)).toEqual([
      'Abs',
      'Back + Bis',
      'Stretch',
    ]);
    expect(namesForLabel('Thursday', 'Abs')).toEqual([...THURSDAY_ABS_NAMES]);
    expect(namesForLabel('Thursday', 'Back + Bis')).toEqual([...THURSDAY_BACK_BIS_NAMES]);
    expect(namesForLabel('Thursday', 'Back + Bis')).not.toContain('Single-Arm Row');
    expect(namesForLabel('Thursday', 'Stretch')).toEqual([...EVENING_STRETCH_NAMES]);
    expect(namesForLabel('Thursday', 'Lower Body Stretch')).toEqual([]);
    expect(namesForLabel('Thursday', 'Upper Body Stretch')).toEqual([]);
  });

  it('keeps Friday as lift then evening stretch, Saturday as abs then evening stretch, Sunday as evening stretch', () => {
    expect(listWorkoutSectionLabels(PROGRAM.Friday)).toEqual(['Legs + Back', 'Stretch']);
    expect(namesForLabel('Friday', 'Legs + Back')).toContain('Back Extension');
    expect(namesForLabel('Friday', 'Stretch')).toEqual([...EVENING_STRETCH_NAMES]);
    expect(listWorkoutSectionLabels(PROGRAM.Saturday)).toEqual(['Abs', 'Stretch']);
    expect(namesForLabel('Saturday', 'Abs')).toEqual([...STANDARD_ABS_NAMES]);
    expect(namesForLabel('Saturday', 'Stretch')).toEqual([...EVENING_STRETCH_NAMES]);
    expect(listWorkoutSectionLabels(PROGRAM.Sunday)).toEqual(['Stretch']);
    expect(namesForLabel('Sunday', 'Stretch')).toEqual([...EVENING_STRETCH_NAMES]);
  });

  it('never puts abs and stretch under the same heading, and never ships retired, bot, or court-sport exercises', () => {
    for (const day of WEEK_DAYS) {
      const byLabel = new Map<string, string[]>();
      for (const exercise of PROGRAM[day]) {
        expect(exercise).not.toHaveProperty('owner');
        expect(exercise.name).not.toMatch(/basketball|badminton|dead bug|ab rolls|\(sch\)|\(cursor\)/i);
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
          expect(names).toEqual(day === 'Thursday' ? [...THURSDAY_ABS_NAMES] : [...STANDARD_ABS_NAMES]);
          expect(names.some((name) => /stretch|cat-cow|bird dog|pose|glute bridge/i.test(name))).toBe(false);
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
});
