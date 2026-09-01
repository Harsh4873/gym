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
const MONDAY_CHEST_ABS_NAMES = [
  'Flat Bench',
  'Ab Machine',
  'Incline Bench',
  'Back Extension + Incline Sit-Ups',
  'Leg Raises',
] as const;
const TUESDAY_BICEPS_TRICEPS_NAMES = [
  'Incline Curls',
  'Overhead Extension',
  'Preacher Curl',
  'Dips',
  'Hammer Curl',
] as const;
const WEDNESDAY_SHOULDERS_ABS_NAMES = [
  'Dumbbell Shoulder Press',
  'Ab Machine',
  'Lateral Raises',
  'Back Extension + Incline Sit-Ups',
  'Front Raises',
  'Leg Raises',
] as const;
const THURSDAY_BACK_CHEST_NAMES = [
  'Lat Pulldown',
  'Flat DB Bench',
  'Incline Smith Bench',
  'Low Row',
  'Face Pulls',
] as const;
const FRIDAY_LEGS_NAMES = [
  'Hack Squat',
  'Seated Calf Raise',
  'Bulgarian Split Squat',
  'Tibialis Raise',
  'Hip Thrust',
] as const;
const SATURDAY_ABS_ARMS_NAMES = [
  '10 min ab workout',
  'Zottman Curls',
  'Triceps 7x7',
  'Nippard Superset',
  'EZ Bar Curl + Concentration Curl',
] as const;
const EXTRA_BY_DAY: Record<keyof typeof PROGRAM, string[]> = {
  Monday: [],
  Tuesday: ['Hammer Curl'],
  Wednesday: [],
  Thursday: [],
  Friday: [],
  Saturday: [
    'Zottman Curls',
    'Triceps 7x7',
    'Nippard Superset',
    'EZ Bar Curl + Concentration Curl',
  ],
  Sunday: [],
};

function namesForLabel(day: keyof typeof PROGRAM, label: string): string[] {
  return PROGRAM[day].filter((exercise) => exercise.workoutLabel === label).map((exercise) => exercise.name);
}

function extraNames(day: keyof typeof PROGRAM): string[] {
  return PROGRAM[day].filter((exercise) => exercise.extra).map((exercise) => exercise.name);
}

function liftLabels(day: keyof typeof PROGRAM): string[] {
  return listWorkoutSectionLabels(PROGRAM[day]).filter((label) => label !== 'Stretch');
}

describe('weekly exercise sections', () => {
  it('keeps Monday as chest + abs in alternating order with the combined back-extension line', () => {
    expect(listWorkoutSectionLabels(PROGRAM.Monday)).toEqual(['Chest + Abs']);
    expect(PROGRAM.Monday.map((exercise) => exercise.name)).toEqual([...MONDAY_CHEST_ABS_NAMES]);
    expect(namesForLabel('Monday', 'Chest + Abs')).toEqual([...MONDAY_CHEST_ABS_NAMES]);
    expect(namesForLabel('Monday', 'Stretch')).toEqual([]);
    expect(PROGRAM.Monday.some((exercise) => /hamstring/i.test(exercise.name))).toBe(false);
  });

  it('keeps Wednesday as shoulders+abs then evening stretch, with Front Raises in Face Pulls’ old slot', () => {
    expect(listWorkoutSectionLabels(PROGRAM.Wednesday)).toEqual(['Shoulders + Abs', 'Stretch']);
    expect(namesForLabel('Wednesday', 'Shoulders + Abs')).toEqual([...WEDNESDAY_SHOULDERS_ABS_NAMES]);
    expect(namesForLabel('Wednesday', 'Stretch')).toEqual([...EVENING_STRETCH_NAMES]);
    expect(PROGRAM.Wednesday.some((exercise) => exercise.name === 'Face Pulls')).toBe(false);
    expect(PROGRAM.Wednesday.some((exercise) => exercise.extra)).toBe(false);
  });

  it('keeps Tuesday as biceps+triceps then evening stretch, with Hammer Curl extra only', () => {
    expect(listWorkoutSectionLabels(PROGRAM.Tuesday)).toEqual([
      'Biceps + Triceps',
      'Stretch',
    ]);
    expect(namesForLabel('Tuesday', 'Biceps + Triceps')).toEqual([...TUESDAY_BICEPS_TRICEPS_NAMES]);
    expect(namesForLabel('Tuesday', 'Abs')).toEqual([]);
    expect(namesForLabel('Tuesday', 'Stretch')).toEqual([...EVENING_STRETCH_NAMES]);
    expect(PROGRAM.Tuesday.some((exercise) => /shoulder press|lateral raise|front raise|face pull/i.test(exercise.name))).toBe(false);
  });

  it('keeps Thursday as back+chest then evening stretch, starting with Lat Pulldown and ending with Face Pulls', () => {
    expect(listWorkoutSectionLabels(PROGRAM.Thursday)).toEqual([
      'Back + Chest',
      'Stretch',
    ]);
    expect(namesForLabel('Thursday', 'Back + Chest')).toEqual([...THURSDAY_BACK_CHEST_NAMES]);
    expect(namesForLabel('Thursday', 'Abs')).toEqual([]);
    expect(namesForLabel('Thursday', 'Stretch')).toEqual([...EVENING_STRETCH_NAMES]);
    expect(namesForLabel('Thursday', 'Back + Chest')).not.toContain('Single Arm Row');
    expect(namesForLabel('Thursday', 'Back + Chest')).not.toContain('Back Extension');
    expect(namesForLabel('Thursday', 'Back + Chest')[0]).toBe('Lat Pulldown');
    expect(namesForLabel('Thursday', 'Back + Chest')[4]).toBe('Face Pulls');
  });

  it('keeps Friday as legs only, Saturday as abs+arms, and Sunday as evening stretch', () => {
    expect(listWorkoutSectionLabels(PROGRAM.Friday)).toEqual(['Legs']);
    expect(namesForLabel('Friday', 'Legs')).toEqual([...FRIDAY_LEGS_NAMES]);
    expect(namesForLabel('Friday', 'Legs')).not.toContain('Leg Extension');
    expect(namesForLabel('Friday', 'Legs')).not.toContain('Leg Press');
    expect(namesForLabel('Friday', 'Legs')).not.toContain('Leg Curl');
    expect(namesForLabel('Friday', 'Legs')).not.toContain('Calf Raise');
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

  it('marks only the locked EXTRA movements and never adds extra copy on combined + names', () => {
    for (const day of WEEK_DAYS) {
      expect(extraNames(day)).toEqual(EXTRA_BY_DAY[day]);
      for (const exercise of PROGRAM[day]) {
        if (exercise.extra) {
          expect(exercise.extra).toBe(true);
        } else {
          expect(exercise).not.toHaveProperty('extra');
        }
      }
    }

    expect(PROGRAM.Monday.some((exercise) => exercise.name === 'Back Extension + Incline Sit-Ups')).toBe(true);
    expect(PROGRAM.Wednesday.some((exercise) => exercise.name === 'Back Extension + Incline Sit-Ups')).toBe(true);
    expect(PROGRAM.Saturday.some((exercise) => exercise.name === 'EZ Bar Curl + Concentration Curl')).toBe(true);
  });

  it('never puts abs and stretch under the same heading, and never ships retired, bot, or court-sport exercises', () => {
    for (const day of WEEK_DAYS) {
      expect(DEFAULT_PROGRAM[day].some((exercise) => exercise.name === 'Single-Arm Row')).toBe(false);
      const byLabel = new Map<string, string[]>();
      for (const exercise of PROGRAM[day]) {
        expect(exercise).not.toHaveProperty('owner');
        expect(exercise.name).not.toMatch(/basketball|badminton|dead bug|ab rolls|\(sch\)|\(cursor\)/i);
        expect(exercise.name).not.toMatch(/military press|lateral raises machine|lateral raises dumbbell/i);
        expect(exercise.name).not.toBe('Single-Arm Row');
        expect(exercise.name).not.toBe('EZ Bar Curls + Concentration Curls');
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
      expect(names.filter((name) => name === 'Face Pulls')).toHaveLength(
        day === 'Thursday' ? 1 : 0,
      );

      for (const exercise of PROGRAM[day]) {
        expect(SHIPPED_DEFAULT_EXERCISE_NAMES.get(exercise.id)?.has(exercise.name)).toBe(true);
      }
    }
  });
});
