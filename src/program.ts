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
  return /stretch|fold|mobility/i.test(name);
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
  target?: ExerciseTarget;
}

const CALF_TARGET: ExerciseTarget = { sets: 2, repMin: 15, repMax: 20, restSeconds: 60 };
const LOWER_BODY_TARGET: ExerciseTarget = { sets: 2, repMin: 10, repMax: 12, restSeconds: 90 };

export const DEFAULT_PROGRAM: Record<Weekday, ProgramEntry[]> = {
  // Basketball day. The lower-body stretch block doubles as the rest between
  // pressing sets, so the session still fits the hour.
  Monday: [
    { slot: 1, name: 'Flat Bench Press' },
    { slot: 2, name: 'Wall Calf Stretch' },
    { slot: 4, name: 'Incline Dumbbell Press' },
    { slot: 3, name: 'Standing Hamstring Stretch with Heel Elevated' },
    { slot: 8, name: 'Cable Flyes' },
    { slot: 5, name: 'Standing Quad Stretch' },
    { slot: 12, name: 'Seated Calf Raise', target: CALF_TARGET },
    { slot: 6, name: 'Standing Hip Flexor Stretch' },
    { slot: 9, name: 'Forward Fold' },
    { slot: 11, name: 'Basketball 60 Minutes' },
  ],
  // Badminton day. Abs run between curl sets.
  Tuesday: [
    { slot: 1, name: 'Incline Bicep Curls' },
    { slot: 2, name: 'Ab Machine' },
    { slot: 3, name: 'Face Away Cable Curls' },
    { slot: 6, name: 'Leg Raises' },
    { slot: 5, name: 'EZ Bar Curls + Concentration Curls' },
    { slot: 11, name: 'Ab Rolls' },
    { slot: 8, name: 'Badminton 60 Minutes' },
  ],
  // No court sport, so this is where the light leg work goes — soreness has a
  // clear day either side of it.
  Wednesday: [
    { slot: 1, name: 'Dumbbell Shoulder Press' },
    { slot: 3, name: 'Lateral Raises' },
    { slot: 13, name: 'Rear Delt Fly', target: { sets: 3, repMin: 15, repMax: 20, restSeconds: 60 } },
    { slot: 14, name: 'Leg Press', target: LOWER_BODY_TARGET },
    { slot: 17, name: 'Hip Thrust', target: LOWER_BODY_TARGET },
    { slot: 15, name: 'Standing Calf Raise', target: { sets: 2, repMin: 12, repMax: 15, restSeconds: 60 } },
  ],
  // Badminton day. Abs run between triceps sets.
  Thursday: [
    { slot: 1, name: 'Tricep Superset' },
    { slot: 2, name: 'Cable Triceps Pushdown' },
    { slot: 5, name: 'Ab Machine' },
    { slot: 3, name: 'Overhead Triceps Extension' },
    { slot: 7, name: 'Leg Raises' },
    { slot: 4, name: 'Dips' },
    { slot: 10, name: 'Badminton 60 Minutes' },
  ],
  // Basketball day. Upper-body stretch block fills the rest between pulls.
  Friday: [
    { slot: 2, name: 'Lat Pulldowns' },
    { slot: 3, name: 'Shoulder Stretch' },
    { slot: 1, name: 'Low Row' },
    { slot: 5, name: 'Lat Stretch' },
    { slot: 4, name: 'Single Arm Lat Row' },
    { slot: 7, name: 'Trap Stretch' },
    { slot: 6, name: 'Single Arm Lat Pull' },
    { slot: 10, name: 'Basketball 60 Minutes' },
  ],
  // Deliberately empty — Saturday is off.
  Saturday: [],
  // Short recovery session.
  Sunday: [
    { slot: 17, name: 'Full Body Stretch' },
    { slot: 1, name: 'Back Extension' },
    { slot: 2, name: 'Abs Circuit' },
    { slot: 6, name: 'Ab Rolls' },
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

export const SHIPPED_DEFAULT_EXERCISE_NAMES: ReadonlyMap<string, string> = new Map(
  WEEK_DAYS.flatMap((day) => [
    ...SHIPPED_DEFAULT_PROGRAM_V3[day].map(
      (name, index) => [buildExerciseId(day, index + 1), name] as const,
    ),
    ...Object.entries(SHIPPED_DEFAULT_PROGRAM_V4[day]).map(
      ([slot, name]) => [buildExerciseId(day, Number(slot)), name] as const,
    ),
  ]),
);

export const PROGRAM: Record<Weekday, Exercise[]> = WEEK_DAYS.reduce((program, day) => {
  program[day] = DEFAULT_PROGRAM[day].map((entry) => {
    const kind = inferExerciseKind(entry.name);

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
