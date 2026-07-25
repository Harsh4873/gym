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
const CORE_TARGET: ExerciseTarget = { sets: 3, repMin: 10, repMax: 12, restSeconds: 45 };

export const DEFAULT_PROGRAM: Record<Weekday, ProgramEntry[]> = {
  // Basketball day. Calf and tibialis work sits before the court session so the
  // lower leg is primed rather than pre-fatigued.
  Monday: [
    { slot: 1, name: 'Flat Bench Press' },
    { slot: 2, name: 'Wall Calf Stretch' },
    { slot: 14, name: 'Bent-Knee Calf Stretch' },
    { slot: 3, name: 'Standing Hamstring Stretch with Heel Elevated' },
    { slot: 4, name: 'Incline Dumbbell Press' },
    { slot: 5, name: 'Standing Quad Stretch' },
    { slot: 6, name: 'Standing Hip Flexor Stretch' },
    { slot: 8, name: 'Cable Flyes' },
    { slot: 7, name: 'Standing Figure 4 Glute Stretch' },
    { slot: 12, name: 'Seated Calf Raise', target: CALF_TARGET },
    { slot: 13, name: 'Tibialis Raise', target: { sets: 2, repMin: 20, repMax: 25, restSeconds: 45 } },
    { slot: 9, name: 'Forward Fold' },
    { slot: 10, name: 'Tibialis Stretch' },
    { slot: 11, name: 'Basketball 60 Minutes' },
  ],
  // Badminton day. Hip thrusts and dead bugs load the hinge and brace the spine
  // without the deep-stretch eccentrics that leave legs sore for the next court day.
  Tuesday: [
    { slot: 1, name: 'Incline Bicep Curls' },
    { slot: 2, name: 'Ab Machine' },
    { slot: 3, name: 'Face Away Cable Curls' },
    { slot: 4, name: 'Back Extensions' },
    { slot: 5, name: 'EZ Bar Curls + Concentration Curls' },
    { slot: 6, name: 'Leg Raises' },
    { slot: 9, name: 'Dead Bug', target: { sets: 3, repMin: 8, repMax: 10, restSeconds: 45 } },
    { slot: 10, name: 'Hip Thrust', target: LOWER_BODY_TARGET },
    { slot: 8, name: 'Badminton 60 Minutes' },
  ],
  // No court sport — the recovery day carries the only quad-loading movement.
  Wednesday: [
    { slot: 1, name: 'Dumbbell Shoulder Press' },
    { slot: 2, name: 'Wall Calf Stretch' },
    { slot: 3, name: 'Lateral Raises' },
    { slot: 4, name: 'Standing Hamstring Stretch with Heel Elevated' },
    { slot: 13, name: 'Rear Delt Fly', target: { sets: 3, repMin: 15, repMax: 20, restSeconds: 60 } },
    { slot: 5, name: 'Standing Quad Stretch' },
    { slot: 9, name: 'Face Pulls' },
    { slot: 7, name: 'Standing Hip Flexor Stretch' },
    { slot: 14, name: 'Leg Press', target: LOWER_BODY_TARGET },
    { slot: 8, name: 'Standing Figure 4 Glute Stretch' },
    { slot: 15, name: 'Standing Calf Raise', target: { sets: 2, repMin: 12, repMax: 15, restSeconds: 60 } },
    { slot: 16, name: 'Open-Book T-Spine Stretch' },
    { slot: 10, name: 'Forward Fold' },
    { slot: 11, name: 'Tibialis Stretch' },
  ],
  // Badminton day.
  Thursday: [
    { slot: 1, name: 'Tricep Superset' },
    { slot: 2, name: 'Cable Triceps Pushdown' },
    { slot: 3, name: 'Overhead Triceps Extension' },
    { slot: 4, name: 'Dips' },
    { slot: 5, name: 'Ab Machine' },
    { slot: 6, name: 'Back Extensions' },
    { slot: 7, name: 'Leg Raises' },
    { slot: 9, name: 'Pallof Press', target: CORE_TARGET },
    { slot: 10, name: 'Badminton 60 Minutes' },
  ],
  // Basketball day.
  Friday: [
    { slot: 1, name: 'Low Row' },
    { slot: 2, name: 'Lat Pulldowns' },
    { slot: 3, name: 'Shoulder Stretch' },
    { slot: 4, name: 'Single Arm Lat Row' },
    { slot: 5, name: 'Lat Stretch' },
    { slot: 6, name: 'Single Arm Lat Pull' },
    { slot: 7, name: 'Trap Stretch' },
    { slot: 11, name: 'Seated Calf Raise', target: CALF_TARGET },
    { slot: 8, name: 'Forward Fold' },
    { slot: 9, name: 'Standing Hamstring Stretch with Heel Elevated' },
    { slot: 10, name: 'Basketball 60 Minutes' },
  ],
  // Deliberately empty — Saturday is off.
  Saturday: [],
  // Core plus the full mobility block that used to sit on Saturday.
  Sunday: [
    { slot: 1, name: 'Back Extension' },
    { slot: 2, name: 'Abs Circuit' },
    { slot: 4, name: 'Ab Machine' },
    { slot: 5, name: 'Leg Raises' },
    { slot: 6, name: 'Ab Rolls' },
    { slot: 7, name: 'Pallof Press', target: CORE_TARGET },
    { slot: 8, name: 'Wall Calf Stretch' },
    { slot: 9, name: 'Bent-Knee Calf Stretch' },
    { slot: 10, name: 'Standing Hamstring Stretch with Heel Elevated' },
    { slot: 11, name: 'Standing Hip Flexor Stretch' },
    { slot: 12, name: 'Standing Figure 4 Glute Stretch' },
    { slot: 13, name: '90/90 Hip Stretch' },
    { slot: 14, name: 'Knee-to-Wall Ankle Mobility' },
    { slot: 15, name: 'Open-Book T-Spine Stretch' },
    { slot: 16, name: 'Forward Fold' },
  ],
};

/**
 * The program schema v3 default, kept verbatim so the v4 migration can tell the
 * three cases apart: an id still in DEFAULT_PROGRAM is the same movement, an id
 * only here was retired on purpose, and an id in neither was added by hand in
 * the app. The stored name is compared against this too, so a slot renamed in
 * the default picks up its new name while a rename made in the app is kept.
 */
const LEGACY_DEFAULT_PROGRAM: Record<Weekday, string[]> = {
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

export const LEGACY_DEFAULT_EXERCISE_NAMES: ReadonlyMap<string, string> = new Map(
  WEEK_DAYS.flatMap((day) =>
    LEGACY_DEFAULT_PROGRAM[day].map(
      (name, index) => [buildExerciseId(day, index + 1), name] as const,
    ),
  ),
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
