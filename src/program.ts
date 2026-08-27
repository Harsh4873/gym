import type { Exercise, ExerciseKind, ExerciseTarget, Weekday } from './types';

export const WEEK_DAYS: Weekday[] = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

/**
 * The app tracks lifting and mobility only. Court sports used to live in the
 * program as cardio entries; the names are still recognised here so migrations
 * and log normalisation can strip them from data written by older versions.
 */
export function isRetiredCourtSport(name: string): boolean {
  return /basketball|badminton/i.test(name);
}

export function isStretchExercise(name: string): boolean {
  return /stretch|fold|mobility|pose|cat-cow|warm-?up/i.test(name);
}

export function inferExerciseKind(name: string): ExerciseKind {
  return isStretchExercise(name) ? 'mobility' : 'strength';
}

export function createDefaultExerciseTarget(name: string, kind = inferExerciseKind(name)): ExerciseTarget {
  if (kind === 'mobility') {
    return {
      sets: 2,
      restSeconds: 30,
    };
  }

  return {
    sets: 3,
    repMin: 8,
    repMax: 12,
    restSeconds: 90,
  };
}

function buildExerciseId(day: Weekday, slot: number): string {
  return `${day.toLowerCase()}-${slot}`;
}

/**
 * A slot is an exercise's permanent identity inside a day. Exercise ids are
 * built as `${day}-${slot}`, and logged sets are stored under that id, so a slot
 * must never be renumbered or handed to a different movement — reordering a day
 * is free, but reusing a slot would point old weights and reps at the wrong
 * exercise. New movements always take the next unused slot.
 */
interface ProgramEntry {
  slot: number;
  name: string;
  /** Only for entries whose name does not classify them, like a timed routine. */
  kind?: ExerciseKind;
  target?: ExerciseTarget;
  workoutBlock?: 1 | 2;
  workoutLabel?: string;
  /** Order of this block among all blocks (including external) for the day. */
  blockOrder?: number;
}

const CALF_TARGET: ExerciseTarget = { sets: 2, repMin: 15, repMax: 20, restSeconds: 60 };
const LOWER_BODY_TARGET: ExerciseTarget = { sets: 2, repMin: 10, repMax: 12, restSeconds: 90 };
const MOBILITY_TARGET: ExerciseTarget = { sets: 1, restSeconds: 0 };
/** Monday and Tuesday: lighter loads, more reps, short rest. */
const HYPERTROPHY_TARGET: ExerciseTarget = { sets: 3, repMin: 10, repMax: 15, restSeconds: 60 };
/** Wednesday to Friday: the same muscles worked heavy, with full rest. */
const STRENGTH_TARGET: ExerciseTarget = { sets: 4, repMin: 6, repMax: 10, restSeconds: 120 };

function buildWorkoutBlock(
  workoutBlock: 1 | 2,
  workoutLabel: string,
  blockOrder: number,
  entries: Array<Omit<ProgramEntry, 'workoutBlock' | 'workoutLabel' | 'blockOrder'>>,
): ProgramEntry[] {
  return entries.map((entry) => ({ ...entry, workoutBlock, workoutLabel, blockOrder }));
}

const DAILY_STRETCH_TARGET: ExerciseTarget = { sets: 1, restSeconds: 0 };

/**
 * Evening stretch is its own section. It is never Workout 1 (morning stretch or
 * abs) and never the lift. Keep `workoutLabel: 'Stretch'` so the page can render
 * it under a heading distinct from 'Lower Body Stretch', 'Upper Body Stretch',
 * and 'Abs'.
 */
function stretchBlock(
  blockOrder: number,
  entries: Array<{ slot: number; name: string }>,
): ProgramEntry[] {
  return entries.map(({ slot, name }) => ({
    slot,
    name,
    kind: 'mobility' as ExerciseKind,
    target: DAILY_STRETCH_TARGET,
    workoutLabel: 'Stretch',
    blockOrder,
  }));
}

/** Stable section identity: evening stretch must not collapse into morning or the lift. */
export function getWorkoutSectionKey(exercise: {
  workoutLabel?: string;
  blockOrder?: number;
  workoutBlock?: 1 | 2;
}): string {
  return `${getWorkoutSectionOrder(exercise)}::${exercise.workoutLabel ?? ''}`;
}

export function getWorkoutSectionOrder(exercise: {
  blockOrder?: number;
  workoutBlock?: 1 | 2;
}): number {
  return exercise.blockOrder ?? exercise.workoutBlock ?? 1;
}

export function listWorkoutSectionLabels(exercises: Array<{
  workoutLabel?: string;
  blockOrder?: number;
  workoutBlock?: 1 | 2;
}>): string[] {
  const labels: string[] = [];
  const seen = new Set<string>();

  for (const exercise of exercises) {
    if (!exercise.workoutLabel) {
      continue;
    }

    const key = getWorkoutSectionKey(exercise);
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    labels.push(exercise.workoutLabel);
  }

  return labels;
}

/**
 * SHIPPED_DEFAULT_PROGRAM_V3..V9 below stay populated on purpose — they are
 * the signature tables `reconcileProgramWithDefaults` uses to recognise
 * entries that older versions shipped, so devices that already store them are
 * migrated instead of stranded.
 */
export const DEFAULT_PROGRAM: Record<Weekday, ProgramEntry[]> = {
  Monday: [
    ...buildWorkoutBlock(1, 'Lower Body Stretch', 1, [
      { slot: 6, name: 'Hip Flexor Stretch', kind: 'mobility', target: DAILY_STRETCH_TARGET },
      { slot: 7, name: 'Figure-4 Glute Stretch', kind: 'mobility', target: DAILY_STRETCH_TARGET },
      { slot: 31, name: "Child's Pose", kind: 'mobility', target: DAILY_STRETCH_TARGET },
      { slot: 26, name: 'Glute Bridge', kind: 'mobility', target: DAILY_STRETCH_TARGET },
      { slot: 32, name: 'Standing Hamstring Stretch', kind: 'mobility', target: DAILY_STRETCH_TARGET },
    ]),
    ...buildWorkoutBlock(2, 'Chest + Tris', 2, [
      { slot: 1, name: 'Bench', target: STRENGTH_TARGET },
      { slot: 4, name: 'Incline DB', target: HYPERTROPHY_TARGET },
      { slot: 15, name: 'Machine Chest', target: HYPERTROPHY_TARGET },
      { slot: 8, name: 'Cable Fly', target: HYPERTROPHY_TARGET },
      { slot: 16, name: 'Tricep Pushdown', target: HYPERTROPHY_TARGET },
      { slot: 17, name: 'Overhead Extension', target: HYPERTROPHY_TARGET },
      { slot: 30, name: 'Dips', target: STRENGTH_TARGET },
    ]),
    ...stretchBlock(3, [
      { slot: 24, name: 'Cat-Cow' },
      { slot: 25, name: 'Bird Dog' },
      { slot: 33, name: 'Hip Flexor Stretch' },
      { slot: 34, name: 'Glute Bridge' },
      { slot: 35, name: "Child's Pose" },
      { slot: 36, name: 'Figure-4 Glute Stretch' },
    ]),
  ],
  Tuesday: [
    ...buildWorkoutBlock(1, 'Abs', 1, [
      { slot: 2, name: 'Ab Machine', target: HYPERTROPHY_TARGET },
      { slot: 6, name: 'Leg Raises', target: HYPERTROPHY_TARGET },
    ]),
    ...buildWorkoutBlock(2, 'Back + Bis', 2, [
      { slot: 24, name: 'Lat Pulldown', target: STRENGTH_TARGET },
      { slot: 25, name: 'Low Row', target: STRENGTH_TARGET },
      { slot: 26, name: 'Single-Arm Row', target: STRENGTH_TARGET },
      { slot: 27, name: 'Face Pulls', target: HYPERTROPHY_TARGET },
      { slot: 1, name: 'Incline Curls', target: HYPERTROPHY_TARGET },
      { slot: 12, name: 'Hammer Curls', target: HYPERTROPHY_TARGET },
      { slot: 28, name: 'Preacher Curl', target: HYPERTROPHY_TARGET },
    ]),
    ...stretchBlock(3, [
      { slot: 17, name: 'Cat-Cow' },
      { slot: 18, name: 'Bird Dog' },
      { slot: 16, name: 'Hip Flexor Stretch' },
      { slot: 19, name: 'Glute Bridge' },
      { slot: 29, name: "Child's Pose" },
      { slot: 23, name: 'Figure-4 Glute Stretch' },
    ]),
  ],
  Wednesday: [
    ...buildWorkoutBlock(1, 'Upper Body Stretch', 1, [
      { slot: 29, name: 'Cat-Cow', kind: 'mobility', target: DAILY_STRETCH_TARGET },
      { slot: 30, name: 'Bird Dog', kind: 'mobility', target: DAILY_STRETCH_TARGET },
      { slot: 16, name: 'Open-Book T-Spine', kind: 'mobility', target: DAILY_STRETCH_TARGET },
      { slot: 40, name: 'Shoulder Stretch', kind: 'mobility', target: DAILY_STRETCH_TARGET },
    ]),
    ...buildWorkoutBlock(2, 'Chest + Tris', 2, [
      { slot: 23, name: 'Bench', target: STRENGTH_TARGET },
      { slot: 19, name: 'Incline DB', target: HYPERTROPHY_TARGET },
      { slot: 35, name: 'Machine Chest', target: HYPERTROPHY_TARGET },
      { slot: 36, name: 'Cable Fly', target: HYPERTROPHY_TARGET },
      { slot: 37, name: 'Tricep Pushdown', target: HYPERTROPHY_TARGET },
      { slot: 38, name: 'Overhead Extension', target: HYPERTROPHY_TARGET },
      { slot: 20, name: 'Dips', target: STRENGTH_TARGET },
    ]),
    ...stretchBlock(3, [
      { slot: 41, name: 'Cat-Cow' },
      { slot: 42, name: 'Bird Dog' },
      { slot: 7, name: 'Hip Flexor Stretch' },
      { slot: 31, name: 'Glute Bridge' },
      { slot: 39, name: "Child's Pose" },
      { slot: 8, name: 'Figure-4 Glute Stretch' },
    ]),
  ],
  Thursday: [
    ...buildWorkoutBlock(1, 'Abs', 1, [
      { slot: 5, name: 'Ab Machine', target: HYPERTROPHY_TARGET },
      { slot: 7, name: 'Leg Raises', target: HYPERTROPHY_TARGET },
      { slot: 23, name: 'Back Extension', target: HYPERTROPHY_TARGET },
      { slot: 24, name: 'Incline Sit-Ups', target: HYPERTROPHY_TARGET },
    ]),
    ...buildWorkoutBlock(2, 'Back + Bis', 2, [
      { slot: 25, name: 'Lat Pulldown', target: STRENGTH_TARGET },
      { slot: 26, name: 'Low Row', target: STRENGTH_TARGET },
      { slot: 12, name: 'Face Pulls', target: HYPERTROPHY_TARGET },
      { slot: 28, name: 'Incline Curls', target: HYPERTROPHY_TARGET },
      { slot: 29, name: 'Hammer Curls', target: HYPERTROPHY_TARGET },
      { slot: 14, name: 'Preacher Curl', target: HYPERTROPHY_TARGET },
    ]),
    ...stretchBlock(3, [
      { slot: 16, name: 'Cat-Cow' },
      { slot: 17, name: 'Bird Dog' },
      { slot: 15, name: 'Hip Flexor Stretch' },
      { slot: 18, name: 'Glute Bridge' },
      { slot: 30, name: "Child's Pose" },
      { slot: 22, name: 'Figure-4 Glute Stretch' },
    ]),
  ],
  Friday: [
    ...buildWorkoutBlock(2, 'Legs + Back', 1, [
      { slot: 18, name: 'Hack Squat', target: LOWER_BODY_TARGET },
      { slot: 12, name: 'Leg Press', target: LOWER_BODY_TARGET },
      { slot: 20, name: 'Bulgarian Split Squat', target: LOWER_BODY_TARGET },
      { slot: 19, name: 'Leg Curl', target: LOWER_BODY_TARGET },
      { slot: 13, name: 'Hip Thrust', target: LOWER_BODY_TARGET },
      { slot: 14, name: 'Calf Raise', target: CALF_TARGET },
      { slot: 15, name: 'Back Extension', target: HYPERTROPHY_TARGET },
    ]),
    ...stretchBlock(2, [
      { slot: 21, name: 'Cat-Cow' },
      { slot: 22, name: 'Bird Dog' },
      { slot: 17, name: 'Hip Flexor Stretch' },
      { slot: 23, name: 'Glute Bridge' },
      { slot: 24, name: "Child's Pose" },
      { slot: 25, name: 'Figure-4 Glute Stretch' },
    ]),
  ],
  Saturday: [
    ...buildWorkoutBlock(1, 'Abs', 1, [
      { slot: 5, name: 'Ab Machine', target: HYPERTROPHY_TARGET },
      { slot: 6, name: 'Leg Raises', target: HYPERTROPHY_TARGET },
    ]),
    ...stretchBlock(2, [
      { slot: 9, name: 'Cat-Cow' },
      { slot: 10, name: 'Bird Dog' },
      { slot: 11, name: 'Hip Flexor Stretch' },
      { slot: 12, name: 'Glute Bridge' },
      { slot: 13, name: "Child's Pose" },
      { slot: 14, name: 'Figure-4 Glute Stretch' },
    ]),
  ],
  Sunday: stretchBlock(1, [
    { slot: 18, name: 'Cat-Cow' },
    { slot: 22, name: 'Bird Dog' },
    { slot: 11, name: 'Hip Flexor Stretch' },
    { slot: 23, name: 'Glute Bridge' },
    { slot: 19, name: "Child's Pose" },
    { slot: 12, name: 'Figure-4 Glute Stretch' },
  ]),
};

/**
 * Every id the default program has ever shipped, so a migration can tell three
 * cases apart: an id still in DEFAULT_PROGRAM is the same movement, an id only
 * here was retired on purpose, and an id in neither was added by hand in the
 * app and must be kept. The stored name is compared against this too, so a slot
 * renamed in the default picks up its new name while a rename made in the app
 * is kept.
 *
 * This record is cumulative. Retiring a movement means removing it from
 * DEFAULT_PROGRAM and leaving its entry here — dropping it from both would
 * strand the exercise on devices that already store it, because the migration
 * would read it as hand-added. Entries are grouped by the schema version that
 * introduced them.
 */
const SHIPPED_DEFAULT_PROGRAM_V3: Record<Weekday, string[]> = {
  Monday: [
    'Flat Bench Press',
    'Wall Calf Stretch',
    'Standing Hamstring Stretch with Heel Elevated',
    'Incline Dumbbell Press',
    'Standing Quad Stretch',
    'Standing Hip Flexor Stretch',
    'Standing Figure 4 Glute Stretch',
    'Cable Flyes',
    'Forward Fold',
    'Tibialis Stretch',
    'Basketball 60 Minutes',
  ],
  Tuesday: [
    'Incline Bicep Curls',
    'Ab Machine',
    'Face Away Cable Curls',
    'Back Extensions + Incline Sit-Ups',
    'EZ Bar Curls + Concentration Curls',
    'Leg Raises',
    'Basketball 30 Minutes',
  ],
  Wednesday: [
    'Dumbbell Shoulder Press',
    'Wall Calf Stretch',
    'Lateral Raises',
    'Standing Hamstring Stretch with Heel Elevated',
    'Standing Quad Stretch',
    'Front Raises',
    'Standing Hip Flexor Stretch',
    'Standing Figure 4 Glute Stretch',
    'Face Pulls',
    'Forward Fold',
    'Tibialis Stretch',
    'Basketball 60 Minutes',
  ],
  Thursday: [
    'Tricep Superset',
    'Cable Triceps Pushdown',
    'Overhead Triceps Extension',
    'Dips',
    'Ab Machine',
    'Back Extensions + Incline Sit-Ups',
    'Leg Raises',
    'Basketball 30 Minutes',
  ],
  Friday: [
    'Low Row',
    'Lat Pulldowns',
    'Shoulder Stretch',
    'Single Arm Lat Row',
    'Lat Stretch',
    'Single Arm Lat Pull',
    'Trap Stretch',
    'Forward Fold',
    'Standing Hamstring Stretch with Heel Elevated',
    'Basketball 60 Minutes',
  ],
  Saturday: ['Full Body Stretch'],
  Sunday: ['Back Extension', 'Abs Circuit', 'Incline Sit-Ups', 'Ab Machine', 'Leg Raises', 'Ab Rolls'],
};

/** Slots v4 introduced, keyed by the exact slot number each was given. */
const SHIPPED_DEFAULT_PROGRAM_V4: Record<Weekday, Record<number, string>> = {
  Monday: {
    12: 'Seated Calf Raise',
    13: 'Tibialis Raise',
    14: 'Bent-Knee Calf Stretch',
  },
  Tuesday: {
    8: 'Badminton 60 Minutes',
    9: 'Dead Bug',
    10: 'Hip Thrust',
  },
  Wednesday: {
    13: 'Rear Delt Fly',
    14: 'Leg Press',
    15: 'Standing Calf Raise',
    16: 'Open-Book T-Spine Stretch',
  },
  Thursday: {
    9: 'Pallof Press',
    10: 'Badminton 60 Minutes',
  },
  Friday: {
    11: 'Seated Calf Raise',
  },
  Saturday: {},
  Sunday: {
    7: 'Pallof Press',
    8: 'Wall Calf Stretch',
    9: 'Bent-Knee Calf Stretch',
    10: 'Standing Hamstring Stretch with Heel Elevated',
    11: 'Standing Hip Flexor Stretch',
    12: 'Standing Figure 4 Glute Stretch',
    13: '90/90 Hip Stretch',
    14: 'Knee-to-Wall Ankle Mobility',
    15: 'Open-Book T-Spine Stretch',
    16: 'Forward Fold',
  },
};

/** Slots v5 introduced. */
const SHIPPED_DEFAULT_PROGRAM_V5: Record<Weekday, Record<number, string>> = {
  Monday: {},
  Tuesday: {
    11: 'Ab Rolls',
  },
  Wednesday: {
    17: 'Hip Thrust',
  },
  Thursday: {},
  Friday: {},
  Saturday: {},
  Sunday: {
    17: 'Full Body Stretch',
  },
};

/** Slots and names shipped immediately before the current weekly-plan reset. */
const SHIPPED_DEFAULT_PROGRAM_V6: Record<Weekday, Record<number, string>> = {
  Monday: {
    4: 'Incline Dumbbell Press',
    6: 'Standing Hip Flexor Stretch',
    7: 'Standing Figure 4 Glute Stretch',
    8: 'Cable Flyes',
    11: 'Basketball 60 Minutes',
    15: 'Machine Chest Press',
    16: 'Cable Triceps Pushdown',
    17: 'Overhead Triceps Extension',
    18: 'Dynamic Warm-Up',
  },
  Tuesday: {
    1: 'Incline Bicep Curls',
    2: 'Ab Machine',
    3: 'Face Away Cable Curls',
    8: 'Badminton 60 Minutes',
    11: 'Ab Rolls',
    12: 'Hammer Curls',
    13: 'Lateral Raises',
    14: 'Rear Delt Fly',
    15: 'Dynamic Warm-Up',
    16: 'Standing Hip Flexor Stretch',
  },
  Wednesday: {
    7: 'Standing Hip Flexor Stretch',
    8: 'Standing Figure 4 Glute Stretch',
    12: 'Basketball 60 Minutes',
    18: 'Dumbbell Bench Press',
    19: 'Incline Dumbbell Press',
    20: 'Dips',
    21: 'Tricep Superset',
    22: 'Shoulder Stretch',
  },
  Thursday: {
    5: 'Ab Machine',
    7: 'Leg Raises',
    10: 'Badminton 60 Minutes',
    11: 'Dumbbell Shoulder Press',
    12: 'Face Pulls',
    13: 'EZ Bar Curls + Concentration Curls',
    14: 'Preacher Curl',
    15: 'Standing Hip Flexor Stretch',
  },
  Friday: {
    1: 'Low Row',
    2: 'Lat Pulldowns',
    4: 'Single Arm Lat Row',
    9: 'Standing Hamstring Stretch with Heel Elevated',
    12: 'Leg Press',
    13: 'Hip Thrust',
    14: 'Standing Calf Raise',
    15: 'Back Extension',
    16: 'Ab Machine',
    17: 'Standing Hip Flexor Stretch',
  },
  Saturday: {
    2: 'Abs Circuit',
    3: 'Push-Ups',
    4: '10 Min Ab Workout',
  },
  Sunday: {
    8: 'Wall Calf Stretch',
    10: 'Standing Hamstring Stretch with Heel Elevated',
    11: 'Standing Hip Flexor Stretch',
    12: 'Standing Figure 4 Glute Stretch',
    17: 'Full Body Stretch',
    18: 'Cat-Cow',
    19: "Child's Pose",
  },
};

/**
 * Slots the v7 weekly-plan reset introduced or renamed. These were missing from
 * the map when v7 shipped, so v8's retirements are the first to depend on them.
 * Renamed slots appear here under their v7 names; the flattened map keeps every
 * name a slot has ever shipped under, so neither the old nor the new default
 * name reads as a personal rename.
 */
const SHIPPED_DEFAULT_PROGRAM_V7: Record<Weekday, Record<number, string>> = {
  Monday: {
    6: 'Hip Flexor Stretch',
    7: 'Figure-4 Glute Stretch',
    19: 'Standing Biceps Stretch',
    20: 'Tricep Superset',
    21: 'Doorway Chest Stretch',
    22: 'Cross-Body Shoulder Stretch',
    23: 'Lat Stretch',
    24: 'Cat-Cow',
    25: 'Bird Dogs',
    26: 'Glute Bridges',
    27: "World's Greatest Stretch",
    28: 'Reverse Lunges',
    29: 'Lateral Band Walks',
  },
  Tuesday: {
    3: 'Face-Away Cable Curls',
    16: 'Hip Flexor Stretch',
    17: 'Cat-Cow',
    18: 'Bird Dogs',
    19: 'Glute Bridges',
    20: "World's Greatest Stretch",
    21: 'Reverse Lunges',
    22: 'Lateral Band Walks',
    23: 'Figure-4 Glute Stretch',
  },
  Wednesday: {
    7: 'Hip Flexor Stretch',
    8: 'Figure-4 Glute Stretch',
    23: 'Flat Bench Press',
    24: 'Skullcrushers',
    25: 'Standing Biceps Stretch',
    26: 'Doorway Chest Stretch',
    27: 'Cross-Body Shoulder Stretch',
    28: 'Lat Stretch',
    29: 'Cat-Cow',
    30: 'Bird Dogs',
    31: 'Glute Bridges',
    32: "World's Greatest Stretch",
    33: 'Reverse Lunges',
    34: 'Lateral Band Walks',
  },
  Thursday: {
    15: 'Hip Flexor Stretch',
    16: 'Cat-Cow',
    17: 'Bird Dogs',
    18: 'Glute Bridges',
    19: "World's Greatest Stretch",
    20: 'Reverse Lunges',
    21: 'Lateral Band Walks',
    22: 'Figure-4 Glute Stretch',
  },
  Friday: {
    2: 'Lat Pulldown',
    18: 'Hack Squat',
    19: 'Leg Curl',
    20: 'Bulgarian Split Squat',
  },
  Saturday: {
    4: '10-Minute Ab Workout',
  },
  Sunday: {
    12: 'Figure-4 Glute Stretch',
    20: '10-Minute Stretch Video',
    21: 'Half-Kneeling Hip Flexor Stretch',
  },
};

/**
 * Slots the v8 weekly-plan reset introduced. This version reorganises the site
 * to show exercises only, dropping court sports and extraneous stretches while
 * keeping the daily stretch routine.
 */
const SHIPPED_DEFAULT_PROGRAM_V8: Record<Weekday, Record<number, string>> = {
  Monday: {
    1: 'Bench',
    4: 'Incline DB',
    6: 'Hip Flexor Stretch',
    7: 'Figure-4 Glute Stretch',
    8: 'Cable Fly',
    15: 'Machine Chest',
    16: 'Tricep Pushdown',
    17: 'Overhead Extension',
    24: 'Cat-Cow',
    25: 'Bird Dog',
    26: 'Glute Bridge',
    30: 'Dips',
    31: "Child's Pose",
    32: 'Standing Hamstring Stretch',
    33: 'Hip Flexor Stretch',
    34: 'Glute Bridge',
    35: "Child's Pose",
    36: 'Figure-4 Glute Stretch',
  },
  Tuesday: {
    1: 'Incline Curls',
    2: 'Ab Machine',
    6: 'Leg Raises',
    9: 'Dead Bug',
    11: 'Ab Rolls',
    12: 'Hammer Curls',
    16: 'Hip Flexor Stretch',
    17: 'Cat-Cow',
    18: 'Bird Dog',
    19: 'Glute Bridge',
    23: 'Figure-4 Glute Stretch',
    24: 'Lat Pulldown',
    25: 'Low Row',
    26: 'Single-Arm Row',
    27: 'Face Pulls',
    28: 'Preacher Curl',
    29: "Child's Pose",
  },
  Wednesday: {
    7: 'Hip Flexor Stretch',
    8: 'Figure-4 Glute Stretch',
    16: 'Open-Book T-Spine',
    19: 'Incline DB',
    20: 'Dips',
    23: 'Bench',
    29: 'Cat-Cow',
    30: 'Bird Dog',
    31: 'Glute Bridge',
    35: 'Machine Chest',
    36: 'Cable Fly',
    37: 'Tricep Pushdown',
    38: 'Overhead Extension',
    39: "Child's Pose",
    40: 'Shoulder Stretch',
    41: 'Cat-Cow',
    42: 'Bird Dog',
  },
  Thursday: {
    5: 'Ab Machine',
    7: 'Leg Raises',
    12: 'Face Pulls',
    14: 'Preacher Curl',
    15: 'Hip Flexor Stretch',
    16: 'Cat-Cow',
    17: 'Bird Dog',
    18: 'Glute Bridge',
    22: 'Figure-4 Glute Stretch',
    23: 'Ab Rolls',
    24: 'Dead Bug',
    25: 'Lat Pulldown',
    26: 'Low Row',
    27: 'Single-Arm Row',
    28: 'Incline Curls',
    29: 'Hammer Curls',
    30: "Child's Pose",
  },
  Friday: {
    12: 'Leg Press',
    13: 'Hip Thrust',
    14: 'Calf Raise',
    15: 'Back Extension',
    17: 'Hip Flexor Stretch',
    18: 'Hack Squat',
    19: 'Leg Curl',
    20: 'Bulgarian Split Squat',
    21: 'Cat-Cow',
    22: 'Bird Dog',
    23: 'Glute Bridge',
    24: "Child's Pose",
    25: 'Figure-4 Glute Stretch',
  },
  Saturday: {
    5: 'Ab Machine',
    6: 'Leg Raises',
    7: 'Ab Rolls',
    8: 'Dead Bug',
    9: 'Cat-Cow',
    10: 'Bird Dog',
    11: 'Hip Flexor Stretch',
    12: 'Glute Bridge',
    13: "Child's Pose",
    14: 'Figure-4 Glute Stretch',
  },
  Sunday: {
    11: 'Hip Flexor Stretch',
    12: 'Figure-4 Glute Stretch',
    18: 'Cat-Cow',
    19: "Child's Pose",
    22: 'Bird Dog',
    23: 'Glute Bridge',
  },
};

/**
 * Slots the v9 follow-up changes. Retain the prior names in V8 so stored
 * default exercises can be recognised and migrated, while these replacements
 * keep Thursday's existing Abs slots stable.
 */
const SHIPPED_DEFAULT_PROGRAM_V9: Record<Weekday, Record<number, string>> = {
  Monday: {},
  Tuesday: {},
  Wednesday: {},
  Thursday: {
    23: 'Back Extension',
    24: 'Incline Sit-Ups',
  },
  Friday: {},
  Saturday: {},
  Sunday: {},
};

const SHIPPED_SLOT_GROUPS: Record<Weekday, Record<number, string>>[] = [
  SHIPPED_DEFAULT_PROGRAM_V4,
  SHIPPED_DEFAULT_PROGRAM_V5,
  SHIPPED_DEFAULT_PROGRAM_V6,
  SHIPPED_DEFAULT_PROGRAM_V7,
  SHIPPED_DEFAULT_PROGRAM_V8,
  SHIPPED_DEFAULT_PROGRAM_V9,
];

/**
 * Every name each slot has ever shipped under. A stored name found in its
 * slot's set was written by a default, not by hand, so it may follow the
 * current default; anything else is a personal rename and wins.
 */
export const SHIPPED_DEFAULT_EXERCISE_NAMES: ReadonlyMap<string, ReadonlySet<string>> = (() => {
  const names = new Map<string, Set<string>>();
  const record = (id: string, name: string) => {
    const existing = names.get(id);
    if (existing) {
      existing.add(name);
    } else {
      names.set(id, new Set([name]));
    }
  };

  for (const day of WEEK_DAYS) {
    SHIPPED_DEFAULT_PROGRAM_V3[day].forEach((name, index) => record(buildExerciseId(day, index + 1), name));
    for (const group of SHIPPED_SLOT_GROUPS) {
      for (const [slot, name] of Object.entries(group[day])) {
        record(buildExerciseId(day, Number(slot)), name);
      }
    }
  }

  return names;
})();

export const PROGRAM: Record<Weekday, Exercise[]> = WEEK_DAYS.reduce((program, day) => {
  program[day] = DEFAULT_PROGRAM[day].map((entry) => {
    const kind = entry.kind ?? inferExerciseKind(entry.name);

    return {
      id: buildExerciseId(day, entry.slot),
      day,
      name: entry.name,
      kind,
      target: entry.target ? { ...entry.target } : createDefaultExerciseTarget(entry.name, kind),
      ...(entry.workoutBlock ? { workoutBlock: entry.workoutBlock } : {}),
      ...(entry.workoutLabel ? { workoutLabel: entry.workoutLabel } : {}),
      ...(entry.blockOrder ? { blockOrder: entry.blockOrder } : {}),
    };
  });

  return program;
}, {} as Record<Weekday, Exercise[]>);
