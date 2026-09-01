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
const SHORT_ABS_NAMES = ['Ab Machine', 'Leg Raises', 'Incline Sit-Ups'] as const;
const ABS_EXERCISE_NAMES = [...ABS_DAY_NAMES] as const;
const EVENING_STRETCH_NAMES = [
  'Cat-Cow',
  'Bird Dog',
  'Hip Flexor Stretch',
  'Glute Bridge',
  "Child's Pose",
  'Figure-4 Glute Stretch',
] as const;
const MONDAY_CHEST_ABS_NAMES = [
  'Bench',
  'Incline DB',
  'Ab Machine',
  'Leg Raises',
  'Incline Sit-Ups',
] as const;
const TUESDAY_BICEPS_TRICEPS_NAMES = [
  'Incline Curls',
  'Hammer Curls',
  'Preacher Curl',
  'Tricep Pushdown',
  'Overhead Extension',
  'Dips',
] as const;
const WEDNESDAY_SHOULDERS_ABS_NAMES = [
  'Dumbbell Shoulder Press',
  'Lateral Raises',
  'Face Pulls',
  'Ab Machine',
  'Leg Raises',
  'Incline Sit-Ups',
] as const;
const THURSDAY_BACK_CHEST_NAMES = [
  'Low Row',
  'Lat Pulldown',
  'Single Arm Row',
  'Bench',
  'Incline DB',
  'Cable Fly',
] as const;
const FRIDAY_LEGS_NAMES = [
  'Hack Squat',
  'Leg Press',
  'Bulgarian Split Squat',
  'Leg Curl',
  'Hip Thrust',
  'Calf Raise',
] as const;
const SATURDAY_ABS_ARMS_NAMES = [
  'Ab Machine',
  'Leg Raises',
  'Incline Sit-Ups',
  'Incline Curls',
  'Hammer Curls',
  'Tricep Pushdown',
] as const;

function namesForLabel(day: keyof typeof PROGRAM, label: string): string[] {
  return PROGRAM[day].filter((exercise) => exercise.workoutLabel === label).map((exercise) => exercise.name);
}

function liftLabels(day: keyof typeof PROGRAM): string[] {
  return listWorkoutSectionLabels(PROGRAM[day]).filter((label) => label !== 'Stretch');
}

describe('weekly exercise sections', () => {
  it('keeps Monday short: chest + abs with no mid-lift hamstring stretch', () => {
    expect(listWorkoutSectionLabels(PROGRAM.Monday)).toEqual(['Chest + Abs']);
    expect(PROGRAM.Monday.map((exercise) => exercise.name)).toEqual([...MONDAY_CHEST_ABS_NAMES]);
    expect(namesForLabel('Monday', 'Chest + Abs')).toEqual([...MONDAY_CHEST_ABS_NAMES]);
    expect(namesForLabel('Monday', 'Stretch')).toEqual([]);
    expect(PROGRAM.Monday.some((exercise) => /hamstring/i.test(exercise.name))).toBe(false);
  });

  it('keeps Wednesday as shoulders+abs then evening stretch with no chest or tris', () => {
    expect(listWorkoutSectionLabels(PROGRAM.Wednesday)).toEqual(['Shoulders + Abs', 'Stretch']);
    expect(namesForLabel('Wednesday', 'Shoulders + Abs')).toEqual([...WEDNESDAY_SHOULDERS_ABS_NAMES]);
    expect(namesForLabel('Wednesday', 'Stretch')).toEqual([...EVENING_STRETCH_NAMES]);
    expect(namesForLabel('Wednesday', 'Shoulders + Abs')).toEqual(expect.arrayContaining([...SHORT_ABS_NAMES]));
    expect(PROGRAM.Wednesday.some((exercise) => /bench|incline db|machine chest|cable fly|pushdown|dips/i.test(exercise.name))).toBe(false);
  });

  it('keeps Tuesday as biceps+triceps then evening stretch, with no shoulders or abs in the lift', () => {
    expect(listWorkoutSectionLabels(PROGRAM.Tuesday)).toEqual([
      'Biceps + Triceps',
      'Stretch',
    ]);
    expect(namesForLabel('Tuesday', 'Biceps + Triceps')).toEqual([...TUESDAY_BICEPS_TRICEPS_NAMES]);
    expect(namesForLabel('Tuesday', 'Abs')).toEqual([]);
    expect(namesForLabel('Tuesday', 'Stretch')).toEqual([...EVENING_STRETCH_NAMES]);
    expect(namesForLabel('Tuesday', 'Lower Body Stretch')).toEqual([]);
    expect(namesForLabel('Tuesday', 'Upper Body Stretch')).toEqual([]);
    expect(PROGRAM.Tuesday.some((exercise) => /shoulder press|lateral raise|front raise|face pull/i.test(exercise.name))).toBe(false);
    expect(namesForLabel('Tuesday', 'Biceps + Triceps').some((name) => ABS_EXERCISE_NAMES.includes(name as typeof ABS_EXERCISE_NAMES[number]))).toBe(false);
  });

  it('keeps Thursday as back+chest then evening stretch with no abs in the lift', () => {
    expect(listWorkoutSectionLabels(PROGRAM.Thursday)).toEqual([
      'Back + Chest',
      'Stretch',
    ]);
    expect(namesForLabel('Thursday', 'Back + Chest')).toEqual([...THURSDAY_BACK_CHEST_NAMES]);
    expect(namesForLabel('Thursday', 'Abs')).toEqual([]);
    expect(namesForLabel('Thursday', 'Stretch')).toEqual([...EVENING_STRETCH_NAMES]);
    expect(namesForLabel('Thursday', 'Lower Body Stretch')).toEqual([]);
    expect(namesForLabel('Thursday', 'Upper Body Stretch')).toEqual([]);
    expect(namesForLabel('Thursday', 'Back + Chest').some((name) => ABS_EXERCISE_NAMES.includes(name as typeof ABS_EXERCISE_NAMES[number]))).toBe(false);
  });

  it('keeps Friday as legs only, Saturday as abs+arms, and Sunday as evening stretch', () => {
    expect(listWorkoutSectionLabels(PROGRAM.Friday)).toEqual(['Legs']);
    expect(namesForLabel('Friday', 'Legs')).toEqual([...FRIDAY_LEGS_NAMES]);
    expect(namesForLabel('Friday', 'Legs')).not.toContain('Back Extension');
    expect(namesForLabel('Friday', 'Stretch')).toEqual([]);
    expect(listWorkoutSectionLabels(PROGRAM.Saturday)).toEqual(['Abs + Arms']);
    expect(namesForLabel('Saturday', 'Abs + Arms')).toEqual([...SATURDAY_ABS_ARMS_NAMES]);
    expect(namesForLabel('Saturday', 'Stretch')).toEqual([]);
    expect(listWorkoutSectionLabels(PROGRAM.Sunday)).toEqual(['Stretch']);
    expect(namesForLabel('Sunday', 'Stretch')).toEqual([...EVENING_STRETCH_NAMES]);
  });

  it('ships one lift focus per weekday, plus Stretch only on days that already had it', () => {
    expect(liftLabels('Monday')).toEqual(['Chest + Abs']);
    expect(liftLabels('Tuesday')).toEqual(['Biceps + Triceps']);
    expect(liftLabels('Wednesday')).toEqual(['Shoulders + Abs']);
    expect(liftLabels('Thursday')).toEqual(['Back + Chest']);
    expect(liftLabels('Friday')).toEqual(['Legs']);
    expect(liftLabels('Saturday')).toEqual(['Abs + Arms']);
    expect(liftLabels('Sunday')).toEqual([]);
    expect(namesForLabel('Friday', 'Stretch')).toEqual([]);
    expect(namesForLabel('Saturday', 'Stretch')).toEqual([]);
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
        day === 'Wednesday' ? 1 : 0,
      );
      expect(names.filter((name) => /shoulder press|military press/i.test(name))).toHaveLength(
        day === 'Wednesday' ? 1 : 0,
      );

      for (const exercise of PROGRAM[day]) {
        expect(SHIPPED_DEFAULT_EXERCISE_NAMES.get(exercise.id)?.has(exercise.name)).toBe(true);
      }
    }
  });
});
