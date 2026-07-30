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

const COURT_SPORT_PATTERN = /^(?:basketball|badminton)\s+(\d+)\s+minutes$/i;

export function isCourtSport(name: string): boolean {
  return /basketball|badminton/i.test(name);
}

export function getCourtSportMinutes(name: string): number {
  const match = name.match(COURT_SPORT_PATTERN);
  return match ? Number(match[1]) : 0;
}

export function isStretchExercise(name: string): boolean {
  return /stretch|fold|mobility|pose|cat-cow|warm-?up/i.test(name);
}

export function inferExerciseKind(name: string): ExerciseKind {
  if (isCourtSport(name)) {
    return 'cardio';
  }

  if (isStretchExercise(name)) {
    return 'mobility';
  }

  return 'strength';
}

export function createDefaultExerciseTarget(name: string, kind = inferExerciseKind(name)): ExerciseTarget {
  if (kind === 'cardio') {
    return {
      minutes: getCourtSportMinutes(name) || 30,
    };
  }

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
  entries: Array<Omit<ProgramEntry, 'workoutBlock' | 'workoutLabel'>>,
): ProgramEntry[] {
  return entries.map((entry) => ({ ...entry, workoutBlock, workoutLabel }));
}

/**
 * The current plan keeps gym work in the requested order, then puts court-sport
 * mobility immediately before basketball or badminton. Tuesday and Thursday
 * are explicitly split into two workout blocks in the Logbook.
 */
export const DEFAULT_PROGRAM: Record<Weekday, ProgramEntry[]> = {
  Monday: [
    ...buildWorkoutBlock(1, 'Chest and triceps', [
      { slot: 15, name: 'Machine Chest Press', target: HYPERTROPHY_TARGET },
      { slot: 19, name: 'Standing Biceps Stretch', kind: 'mobility', target: MOBILITY_TARGET },
      { slot: 20, name: 'Tricep Superset', target: HYPERTROPHY_TARGET },
      { slot: 21, name: 'Doorway Chest Stretch', kind: 'mobility', target: MOBILITY_TARGET },
      { slot: 4, name: 'Incline Dumbbell Press', target: HYPERTROPHY_TARGET },
      { slot: 22, name: 'Cross-Body Shoulder Stretch', kind: 'mobility', target: MOBILITY_TARGET },
      { slot: 17, name: 'Overhead Triceps Extension', target: HYPERTROPHY_TARGET },
      { slot: 23, name: 'Lat Stretch', kind: 'mobility', target: MOBILITY_TARGET },
    ]),
    ...buildWorkoutBlock(2, 'Pre-basketball mobility', [
      { slot: 24, name: 'Cat-Cow', kind: 'mobility', target: MOBILITY_TARGET },
      { slot: 25, name: 'Bird Dogs', kind: 'mobility', target: MOBILITY_TARGET },
      { slot: 26, name: 'Glute Bridges', kind: 'mobility', target: MOBILITY_TARGET },
      { slot: 27, name: "World's Greatest Stretch", kind: 'mobility', target: MOBILITY_TARGET },
      { slot: 28, name: 'Reverse Lunges', kind: 'mobility', target: MOBILITY_TARGET },
      { slot: 29, name: 'Lateral Band Walks', kind: 'mobility', target: MOBILITY_TARGET },
      { slot: 6, name: 'Hip Flexor Stretch', kind: 'mobility', target: MOBILITY_TARGET },
      { slot: 7, name: 'Figure-4 Glute Stretch', kind: 'mobility', target: MOBILITY_TARGET },
      { slot: 11, name: 'Basketball 60 Minutes' },
    ]),
  ],
  Tuesday: [
    ...buildWorkoutBlock(1, 'Workout 1 · Biceps, shoulders and abs', [
      { slot: 1, name: 'Incline Bicep Curls', target: HYPERTROPHY_TARGET },
      { slot: 2, name: 'Ab Machine' },
      { slot: 12, name: 'Hammer Curls', target: HYPERTROPHY_TARGET },
      { slot: 4, name: 'Back Extensions + Incline Sit-Ups' },
      { slot: 3, name: 'Face-Away Cable Curls', target: HYPERTROPHY_TARGET },
      { slot: 13, name: 'Lateral Raises', target: HYPERTROPHY_TARGET },
      { slot: 14, name: 'Rear Delt Fly', target: HYPERTROPHY_TARGET },
    ]),
    ...buildWorkoutBlock(2, 'Workout 2 · Mobility and badminton', [
      { slot: 17, name: 'Cat-Cow', kind: 'mobility', target: MOBILITY_TARGET },
      { slot: 18, name: 'Bird Dogs', kind: 'mobility', target: MOBILITY_TARGET },
      { slot: 19, name: 'Glute Bridges', kind: 'mobility', target: MOBILITY_TARGET },
      { slot: 20, name: "World's Greatest Stretch", kind: 'mobility', target: MOBILITY_TARGET },
      { slot: 21, name: 'Reverse Lunges', kind: 'mobility', target: MOBILITY_TARGET },
      { slot: 22, name: 'Lateral Band Walks', kind: 'mobility', target: MOBILITY_TARGET },
      { slot: 16, name: 'Hip Flexor Stretch', kind: 'mobility', target: MOBILITY_TARGET },
      { slot: 23, name: 'Figure-4 Glute Stretch', kind: 'mobility', target: MOBILITY_TARGET },
      { slot: 8, name: 'Badminton 60 Minutes' },
    ]),
  ],
  Wednesday: [
    ...buildWorkoutBlock(1, 'Chest and triceps', [
      { slot: 23, name: 'Flat Bench Press', target: STRENGTH_TARGET },
      { slot: 25, name: 'Standing Biceps Stretch', kind: 'mobility', target: MOBILITY_TARGET },
      { slot: 19, name: 'Incline Dumbbell Press', target: STRENGTH_TARGET },
      { slot: 26, name: 'Doorway Chest Stretch', kind: 'mobility', target: MOBILITY_TARGET },
      { slot: 20, name: 'Dips', target: STRENGTH_TARGET },
      { slot: 27, name: 'Cross-Body Shoulder Stretch', kind: 'mobility', target: MOBILITY_TARGET },
      { slot: 24, name: 'Skullcrushers', target: STRENGTH_TARGET },
      { slot: 28, name: 'Lat Stretch', kind: 'mobility', target: MOBILITY_TARGET },
    ]),
    ...buildWorkoutBlock(2, 'Pre-basketball mobility', [
      { slot: 29, name: 'Cat-Cow', kind: 'mobility', target: MOBILITY_TARGET },
      { slot: 30, name: 'Bird Dogs', kind: 'mobility', target: MOBILITY_TARGET },
      { slot: 31, name: 'Glute Bridges', kind: 'mobility', target: MOBILITY_TARGET },
      { slot: 32, name: "World's Greatest Stretch", kind: 'mobility', target: MOBILITY_TARGET },
      { slot: 33, name: 'Reverse Lunges', kind: 'mobility', target: MOBILITY_TARGET },
      { slot: 34, name: 'Lateral Band Walks', kind: 'mobility', target: MOBILITY_TARGET },
      { slot: 7, name: 'Hip Flexor Stretch', kind: 'mobility', target: MOBILITY_TARGET },
      { slot: 8, name: 'Figure-4 Glute Stretch', kind: 'mobility', target: MOBILITY_TARGET },
      { slot: 12, name: 'Basketball 60 Minutes' },
    ]),
  ],
  Thursday: [
    ...buildWorkoutBlock(1, 'Workout 1 · Shoulders, arms and abs', [
      { slot: 11, name: 'Dumbbell Shoulder Press', target: STRENGTH_TARGET },
      { slot: 12, name: 'Face Pulls', target: STRENGTH_TARGET },
      { slot: 5, name: 'Ab Machine' },
      { slot: 13, name: 'EZ Bar Curls + Concentration Curls', target: STRENGTH_TARGET },
      { slot: 7, name: 'Leg Raises' },
      { slot: 14, name: 'Preacher Curl', target: STRENGTH_TARGET },
    ]),
    ...buildWorkoutBlock(2, 'Workout 2 · Mobility and badminton', [
      { slot: 16, name: 'Cat-Cow', kind: 'mobility', target: MOBILITY_TARGET },
      { slot: 17, name: 'Bird Dogs', kind: 'mobility', target: MOBILITY_TARGET },
      { slot: 18, name: 'Glute Bridges', kind: 'mobility', target: MOBILITY_TARGET },
      { slot: 19, name: "World's Greatest Stretch", kind: 'mobility', target: MOBILITY_TARGET },
      { slot: 20, name: 'Reverse Lunges', kind: 'mobility', target: MOBILITY_TARGET },
      { slot: 21, name: 'Lateral Band Walks', kind: 'mobility', target: MOBILITY_TARGET },
      { slot: 15, name: 'Hip Flexor Stretch', kind: 'mobility', target: MOBILITY_TARGET },
      { slot: 22, name: 'Figure-4 Glute Stretch', kind: 'mobility', target: MOBILITY_TARGET },
      { slot: 10, name: 'Badminton 60 Minutes' },
    ]),
  ],
  Friday: buildWorkoutBlock(1, 'Legs and back only', [
    { slot: 18, name: 'Hack Squat', target: STRENGTH_TARGET },
    { slot: 2, name: 'Lat Pulldown', target: STRENGTH_TARGET },
    { slot: 13, name: 'Hip Thrust', target: LOWER_BODY_TARGET },
    { slot: 1, name: 'Low Row', target: STRENGTH_TARGET },
    { slot: 19, name: 'Leg Curl', target: STRENGTH_TARGET },
    { slot: 20, name: 'Bulgarian Split Squat', target: LOWER_BODY_TARGET },
    { slot: 11, name: 'Seated Calf Raise', target: CALF_TARGET },
  ]),
  Saturday: buildWorkoutBlock(1, 'Push-ups and abs', [
    { slot: 3, name: 'Push-Ups', target: { sets: 5, repMin: 20, repMax: 20, restSeconds: 60 } },
    { slot: 4, name: '10-Minute Ab Workout', kind: 'mobility', target: MOBILITY_TARGET },
  ]),
  Sunday: buildWorkoutBlock(1, '10-minute stretch and home mobility', [
    { slot: 20, name: '10-Minute Stretch Video', kind: 'mobility', target: MOBILITY_TARGET },
    { slot: 21, name: 'Half-Kneeling Hip Flexor Stretch', kind: 'mobility', target: MOBILITY_TARGET },
    { slot: 12, name: 'Figure-4 Glute Stretch', kind: 'mobility', target: MOBILITY_TARGET },
    { slot: 10, name: 'Standing Hamstring Stretch with Heel Elevated', kind: 'mobility', target: MOBILITY_TARGET },
    { slot: 8, name: 'Wall Calf Stretch', kind: 'mobility', target: MOBILITY_TARGET },
    { slot: 15, name: 'Open-Book T-Spine Stretch', kind: 'mobility', target: MOBILITY_TARGET },
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

const SHIPPED_SLOT_GROUPS: Record<Weekday, Record<number, string>>[] = [
  SHIPPED_DEFAULT_PROGRAM_V4,
  SHIPPED_DEFAULT_PROGRAM_V5,
  SHIPPED_DEFAULT_PROGRAM_V6,
];

export const SHIPPED_DEFAULT_EXERCISE_NAMES: ReadonlyMap<string, string> = new Map(
  WEEK_DAYS.flatMap((day) => [
    ...SHIPPED_DEFAULT_PROGRAM_V3[day].map(
      (name, index) => [buildExerciseId(day, index + 1), name] as const,
    ),
    ...SHIPPED_SLOT_GROUPS.flatMap((group) =>
      Object.entries(group[day]).map(
        ([slot, name]) => [buildExerciseId(day, Number(slot)), name] as const,
      ),
    ),
  ]),
);

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
    };
  });

  return program;
}, {} as Record<Weekday, Exercise[]>);
