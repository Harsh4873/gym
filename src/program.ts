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
}

const CALF_TARGET: ExerciseTarget = { sets: 2, repMin: 15, repMax: 20, restSeconds: 60 };
const LOWER_BODY_TARGET: ExerciseTarget = { sets: 2, repMin: 10, repMax: 12, restSeconds: 90 };
/** Monday and Tuesday: lighter loads, more reps, short rest. */
const HYPERTROPHY_TARGET: ExerciseTarget = { sets: 3, repMin: 10, repMax: 15, restSeconds: 60 };
/** Wednesday to Friday: the same muscles worked heavy, with full rest. */
const STRENGTH_TARGET: ExerciseTarget = { sets: 4, repMin: 6, repMax: 10, restSeconds: 120 };

/**
 * Each pushing group is trained twice — once for hypertrophy early in the week,
 * once heavy later — so several movements appear on two days under different
 * slots. That is intentional: they share a name, so logged sets cross-resolve
 * between the two days through the name fallback.
 *
 * A hip flexor stretch sits on every training day. Court sport shortens the
 * psoas, which attaches to the lumbar vertebrae and drags the lower back into
 * extension, and tight hip flexors damp the glutes that should be doing the
 * hip extension instead.
 */
export const DEFAULT_PROGRAM: Record<Weekday, ProgramEntry[]> = {
  // Chest and triceps for volume, then basketball.
  Monday: [
    { slot: 15, name: 'Machine Chest Press', target: HYPERTROPHY_TARGET },
    { slot: 4, name: 'Incline Dumbbell Press', target: HYPERTROPHY_TARGET },
    { slot: 8, name: 'Cable Flyes', target: HYPERTROPHY_TARGET },
    { slot: 16, name: 'Cable Triceps Pushdown', target: HYPERTROPHY_TARGET },
    { slot: 17, name: 'Overhead Triceps Extension', target: HYPERTROPHY_TARGET },
    { slot: 18, name: 'Dynamic Warm-Up' },
    { slot: 6, name: 'Standing Hip Flexor Stretch' },
    { slot: 7, name: 'Standing Figure 4 Glute Stretch' },
    { slot: 11, name: 'Basketball 60 Minutes' },
  ],
  // Biceps and shoulders for volume, abs between curl sets, then badminton.
  Tuesday: [
    { slot: 1, name: 'Incline Bicep Curls', target: HYPERTROPHY_TARGET },
    { slot: 2, name: 'Ab Machine' },
    { slot: 12, name: 'Hammer Curls', target: HYPERTROPHY_TARGET },
    { slot: 3, name: 'Face Away Cable Curls', target: HYPERTROPHY_TARGET },
    { slot: 11, name: 'Ab Rolls' },
    { slot: 13, name: 'Lateral Raises', target: HYPERTROPHY_TARGET },
    { slot: 14, name: 'Rear Delt Fly', target: HYPERTROPHY_TARGET },
    { slot: 15, name: 'Dynamic Warm-Up' },
    { slot: 16, name: 'Standing Hip Flexor Stretch' },
    { slot: 8, name: 'Badminton 60 Minutes' },
  ],
  // The same push muscles as Monday, heavy. Dumbbells and machines only.
  Wednesday: [
    { slot: 18, name: 'Dumbbell Bench Press', target: STRENGTH_TARGET },
    { slot: 19, name: 'Incline Dumbbell Press', target: STRENGTH_TARGET },
    { slot: 20, name: 'Dips', target: STRENGTH_TARGET },
    { slot: 21, name: 'Tricep Superset', target: STRENGTH_TARGET },
    { slot: 22, name: 'Shoulder Stretch' },
    { slot: 7, name: 'Standing Hip Flexor Stretch' },
    { slot: 8, name: 'Standing Figure 4 Glute Stretch' },
    { slot: 12, name: 'Basketball 60 Minutes' },
  ],
  // The same pull and press muscles as Tuesday, heavy.
  Thursday: [
    { slot: 11, name: 'Dumbbell Shoulder Press', target: STRENGTH_TARGET },
    { slot: 12, name: 'Face Pulls', target: STRENGTH_TARGET },
    { slot: 5, name: 'Ab Machine' },
    { slot: 13, name: 'EZ Bar Curls + Concentration Curls', target: STRENGTH_TARGET },
    { slot: 7, name: 'Leg Raises' },
    { slot: 14, name: 'Preacher Curl', target: STRENGTH_TARGET },
    { slot: 15, name: 'Standing Hip Flexor Stretch' },
    { slot: 10, name: 'Badminton 60 Minutes' },
  ],
  // The only leg day, and the only day with no court sport before or after it.
  Friday: [
    { slot: 2, name: 'Lat Pulldowns', target: STRENGTH_TARGET },
    { slot: 1, name: 'Low Row', target: STRENGTH_TARGET },
    { slot: 4, name: 'Single Arm Lat Row', target: STRENGTH_TARGET },
    { slot: 12, name: 'Leg Press', target: STRENGTH_TARGET },
    { slot: 13, name: 'Hip Thrust', target: LOWER_BODY_TARGET },
    { slot: 14, name: 'Standing Calf Raise', target: CALF_TARGET },
    { slot: 15, name: 'Back Extension', target: { sets: 3, repMin: 12, repMax: 15, restSeconds: 60 } },
    { slot: 16, name: 'Ab Machine' },
    { slot: 9, name: 'Standing Hamstring Stretch with Heel Elevated' },
    { slot: 17, name: 'Standing Hip Flexor Stretch' },
  ],
  // Abs and push-ups. The ab workout is a ten minute follow-along video.
  Saturday: [
    { slot: 2, name: 'Abs Circuit' },
    { slot: 3, name: 'Push-Ups', target: { sets: 5, repMin: 20, repMax: 20, restSeconds: 60 } },
    // A follow-along video, so it logs as one timed round rather than sets of reps.
    { slot: 4, name: '10 Min Ab Workout', kind: 'mobility', target: { sets: 1, restSeconds: 0 } },
  ],
  // Stretch only, with the lumbar decompression work at the end.
  Sunday: [
    { slot: 17, name: 'Full Body Stretch' },
    { slot: 8, name: 'Wall Calf Stretch' },
    { slot: 10, name: 'Standing Hamstring Stretch with Heel Elevated' },
    { slot: 11, name: 'Standing Hip Flexor Stretch' },
    { slot: 12, name: 'Standing Figure 4 Glute Stretch' },
    { slot: 18, name: 'Cat-Cow' },
    { slot: 19, name: "Child's Pose" },
  ],
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

const SHIPPED_SLOT_GROUPS: Record<Weekday, Record<number, string>>[] = [
  SHIPPED_DEFAULT_PROGRAM_V4,
  SHIPPED_DEFAULT_PROGRAM_V5,
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
    };
  });

  return program;
}, {} as Record<Weekday, Exercise[]>);
