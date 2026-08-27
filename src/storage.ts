import {
  createDefaultExerciseTarget,
  inferExerciseKind,
  isRetiredCourtSport,
  SHIPPED_DEFAULT_EXERCISE_NAMES,
  PROGRAM,
  WEEK_DAYS,
} from './program';
import type {
  Exercise,
  ExerciseDetail,
  ExerciseKind,
  ExerciseOrderByDay,
  ExerciseSet,
  ExerciseTarget,
  GymBackup,
  LogsByDate,
  Preferences,
  ProgramByDay,
  Weekday,
  WeightMode,
  WorkoutLog,
} from './types';

export const STORAGE_KEY = 'harsh-gym-logs-v1';
export const EXERCISE_ORDER_STORAGE_KEY = 'harsh-gym-exercise-order-v1';
export const PROGRAM_STORAGE_KEY = 'harsh-gym-program-v1';
export const PREFERENCES_STORAGE_KEY = 'harsh-gym-preferences-v1';
export const GYM_BACKUP_VERSION = 1 as const;
const PROGRAM_SCHEMA_VERSION = 11;
const PREFERENCES_SCHEMA_VERSION = 1;

export const DEFAULT_PREFERENCES: Preferences = {
  weeklySessionGoal: 5,
  defaultRestSeconds: 90,
};

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeInteger(value: unknown, minimum: number, maximum: number): number | undefined {
  const numericValue = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : NaN;
  if (!Number.isFinite(numericValue)) {
    return undefined;
  }

  const roundedValue = Math.round(numericValue);
  return roundedValue >= minimum && roundedValue <= maximum ? roundedValue : undefined;
}

function normalizeStringList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(new Set(value.filter((item): item is string => typeof item === 'string' && Boolean(item.trim()))));
}

function normalizeTimestamp(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() && Number.isFinite(Date.parse(value)) ? value : undefined;
}

function isValidTimestamp(value: unknown): value is string {
  return normalizeTimestamp(value) !== undefined;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string' && item.trim().length > 0);
}

function hasUniqueStrings(value: unknown): value is string[] {
  return isStringArray(value) && new Set(value).size === value.length;
}

function isIntegerInRange(value: unknown, minimum: number, maximum: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= minimum && value <= maximum;
}

function isValidExerciseTarget(value: unknown, kind: ExerciseKind): value is ExerciseTarget {
  if (!isPlainRecord(value)) {
    return false;
  }

  const optionalIntegerIsValid = (key: keyof ExerciseTarget, minimum: number, maximum: number) => {
    return value[key] === undefined || isIntegerInRange(value[key], minimum, maximum);
  };
  const valuesAreValid =
    optionalIntegerIsValid('sets', 1, 20) &&
    optionalIntegerIsValid('repMin', 1, 1000) &&
    optionalIntegerIsValid('repMax', 1, 1000) &&
    optionalIntegerIsValid('restSeconds', 0, 1800);

  if (!valuesAreValid) {
    return false;
  }

  if (!isIntegerInRange(value.sets, 1, 20)) {
    return false;
  }

  return kind === 'mobility' || (
    isIntegerInRange(value.repMin, 1, 1000) &&
    isIntegerInRange(value.repMax, value.repMin, 1000)
  );
}

function isValidExercise(value: unknown, expectedDay?: Weekday): value is Exercise {
  if (!isPlainRecord(value)) {
    return false;
  }

  const kind = value.kind;
  const day = value.day;
  return (
    typeof value.id === 'string' &&
    value.id.trim().length > 0 &&
    typeof value.name === 'string' &&
    value.name.trim().length > 0 &&
    typeof day === 'string' &&
    WEEK_DAYS.includes(day as Weekday) &&
    (expectedDay === undefined || day === expectedDay) &&
    (kind === 'strength' || kind === 'mobility') &&
    (value.workoutBlock === undefined || value.workoutBlock === 1 || value.workoutBlock === 2) &&
    (value.workoutLabel === undefined || (typeof value.workoutLabel === 'string' && value.workoutLabel.trim().length > 0)) &&
    (value.blockOrder === undefined || (typeof value.blockOrder === 'number' && Number.isInteger(value.blockOrder) && value.blockOrder >= 1)) &&
    isValidExerciseTarget(value.target, kind)
  );
}

function isValidExerciseSet(value: unknown): value is ExerciseSet {
  return (
    isPlainRecord(value) &&
    typeof value.id === 'string' &&
    value.id.trim().length > 0 &&
    (value.weightMode === 'bodyweight' || value.weightMode === 'pounds') &&
    typeof value.pounds === 'string' &&
    typeof value.reps === 'string'
  );
}

function isValidExerciseDetail(value: unknown): value is ExerciseDetail {
  if (!isPlainRecord(value) || !Array.isArray(value.sets) || value.sets.length === 0) {
    return false;
  }

  const setsAreValid = value.sets.every(isValidExerciseSet);
  const setIds = setsAreValid ? value.sets.map((set) => set.id) : [];
  return (
    setsAreValid &&
    new Set(setIds).size === setIds.length &&
    (value.exerciseName === undefined || typeof value.exerciseName === 'string') &&
    (value.legacyNote === undefined || typeof value.legacyNote === 'string')
  );
}

function isValidSuperset(value: unknown): value is WorkoutLog['supersets'][number] {
  if (
    !isPlainRecord(value) ||
    typeof value.id !== 'string' ||
    value.id.trim().length === 0 ||
    !Array.isArray(value.exerciseIds) ||
    value.exerciseIds.length !== 2 ||
    !value.exerciseIds.every((id) => typeof id === 'string' && id.trim().length > 0)
  ) {
    return false;
  }

  return value.exerciseIds[0] !== value.exerciseIds[1];
}

function normalizeSupersets(
  value: unknown,
  exerciseSnapshot?: Exercise[],
): WorkoutLog['supersets'] {
  if (!Array.isArray(value)) {
    return [];
  }

  const snapshotExerciseIds = exerciseSnapshot === undefined
    ? undefined
    : new Set(exerciseSnapshot.map((exercise) => exercise.id));
  const seenPairIds = new Set<string>();
  const pairedExerciseIds = new Set<string>();

  return value.filter((pair): pair is WorkoutLog['supersets'][number] => {
    if (!isValidSuperset(pair) || seenPairIds.has(pair.id)) {
      return false;
    }

    const [firstExerciseId, secondExerciseId] = pair.exerciseIds;
    if (
      pairedExerciseIds.has(firstExerciseId) ||
      pairedExerciseIds.has(secondExerciseId) ||
      (snapshotExerciseIds !== undefined && (
        !snapshotExerciseIds.has(firstExerciseId) ||
        !snapshotExerciseIds.has(secondExerciseId)
      ))
    ) {
      return false;
    }

    seenPairIds.add(pair.id);
    pairedExerciseIds.add(firstExerciseId);
    pairedExerciseIds.add(secondExerciseId);
    return true;
  });
}

function hasValidSupersets(value: unknown, exerciseSnapshot?: Exercise[]): value is WorkoutLog['supersets'] {
  return Array.isArray(value) && normalizeSupersets(value, exerciseSnapshot).length === value.length;
}

function isValidWorkoutLog(date: string, value: unknown): value is WorkoutLog {
  if (!isPlainRecord(value) || value.date !== date) {
    return false;
  }

  const completed = hasUniqueStrings(value.completed) ? value.completed : null;
  const skipped = hasUniqueStrings(value.skipped) ? value.skipped : null;
  const snapshotIsValid = value.exerciseSnapshot === undefined || (
    Array.isArray(value.exerciseSnapshot) &&
    value.exerciseSnapshot.every((exercise) => isValidExercise(exercise)) &&
    new Set(value.exerciseSnapshot.map((exercise) => exercise.id)).size === value.exerciseSnapshot.length
  );

  return (
    completed !== null &&
    skipped !== null &&
    !completed.some((id) => skipped.includes(id)) &&
    isPlainRecord(value.details) &&
    Object.keys(value.details).every((exerciseId) => exerciseId.trim().length > 0) &&
    Object.values(value.details).every(isValidExerciseDetail) &&
    typeof value.notes === 'string' &&
    typeof value.prNote === 'string' &&
    hasValidSupersets(
      value.supersets,
      snapshotIsValid && Array.isArray(value.exerciseSnapshot)
        ? value.exerciseSnapshot as Exercise[]
        : undefined,
    ) &&
    typeof value.daySkipped === 'boolean' &&
    isValidTimestamp(value.updatedAt) &&
    (value.startedAt === undefined || isValidTimestamp(value.startedAt)) &&
    (value.finishedAt === undefined || isValidTimestamp(value.finishedAt)) &&
    snapshotIsValid
  );
}

function normalizeExerciseKind(value: unknown, exerciseName: string): ExerciseKind {
  if (value === 'strength' || value === 'mobility') {
    return value;
  }

  return inferExerciseKind(exerciseName);
}

function normalizeExerciseTarget(value: unknown, exerciseName: string, kind: ExerciseKind): ExerciseTarget {
  const defaults = createDefaultExerciseTarget(exerciseName, kind);
  const source = isPlainRecord(value) ? value : {};
  const sets = normalizeInteger(source.sets, 1, 20);
  const repMin = normalizeInteger(source.repMin, 1, 1000);
  const repMax = normalizeInteger(source.repMax, 1, 1000);
  const restSeconds = normalizeInteger(source.restSeconds, 0, 1800);
  const normalizedSets = sets ?? defaults.sets;
  const normalizedRepMin = repMin ?? defaults.repMin;
  const normalizedRepMax = Math.max(repMax ?? defaults.repMax ?? 0, normalizedRepMin ?? 0) || undefined;
  const normalizedRestSeconds = restSeconds ?? defaults.restSeconds;

  return {
    ...(normalizedSets !== undefined ? { sets: normalizedSets } : {}),
    ...(normalizedRepMin !== undefined ? { repMin: normalizedRepMin } : {}),
    ...(normalizedRepMax !== undefined ? { repMax: normalizedRepMax } : {}),
    ...(normalizedRestSeconds !== undefined ? { restSeconds: normalizedRestSeconds } : {}),
  };
}

function normalizeExercise(
  value: unknown,
  fallbackDay: Weekday | undefined,
  fallbackIndex: number,
): Exercise | null {
  if (!isPlainRecord(value)) {
    return null;
  }

  const name = typeof value.name === 'string' ? value.name.trim() : '';
  if (!name) {
    return null;
  }

  // Court sports are no longer tracked. Old programs, snapshots, and synced
  // copies still carry them (as kind 'cardio' or by name), so they are dropped
  // here — the one normalization chokepoint every stored exercise flows through.
  if (value.kind === 'cardio' || isRetiredCourtSport(name)) {
    return null;
  }

  const storedDay = typeof value.day === 'string' && WEEK_DAYS.includes(value.day as Weekday)
    ? (value.day as Weekday)
    : undefined;
  const day = fallbackDay ?? storedDay;
  if (!day) {
    return null;
  }

  const kind = normalizeExerciseKind(value.kind, name);
  const workoutBlock = value.workoutBlock === 1 || value.workoutBlock === 2
    ? value.workoutBlock
    : undefined;
  const workoutLabel = typeof value.workoutLabel === 'string' && value.workoutLabel.trim()
    ? value.workoutLabel.trim()
    : undefined;
  const blockOrder = typeof value.blockOrder === 'number' && Number.isInteger(value.blockOrder) && value.blockOrder >= 1
    ? value.blockOrder
    : undefined;

  return {
    id: typeof value.id === 'string' && value.id.trim() ? value.id : `${day.toLowerCase()}-custom-${fallbackIndex + 1}`,
    day,
    name,
    kind,
    target: normalizeExerciseTarget(value.target, name, kind),
    ...(workoutBlock ? { workoutBlock } : {}),
    ...(workoutLabel ? { workoutLabel } : {}),
    ...(blockOrder ? { blockOrder } : {}),
  };
}

function normalizeExerciseSnapshot(value: unknown): Exercise[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const seenIds = new Set<string>();
  const exercises = value
    .map((exercise, index) => normalizeExercise(exercise, undefined, index))
    .filter((exercise): exercise is Exercise => {
      if (!exercise || seenIds.has(exercise.id)) {
        return false;
      }
      seenIds.add(exercise.id);
      return true;
    });

  return exercises;
}

export function createEmptyExerciseSet(id = 'set-1'): ExerciseSet {
  return {
    id,
    weightMode: 'bodyweight',
    pounds: '',
    reps: '',
  };
}

export function createEmptyExerciseDetail(): ExerciseDetail {
  return {
    exerciseName: '',
    sets: [createEmptyExerciseSet()],
  };
}

function normalizeWeightMode(value: unknown): WeightMode {
  return value === 'pounds' ? 'pounds' : 'bodyweight';
}

function normalizeExerciseSet(value: unknown, fallbackId: string): ExerciseSet {
  if (!isPlainRecord(value)) {
    return createEmptyExerciseSet(fallbackId);
  }

  const weightMode = normalizeWeightMode(value.weightMode);

  return {
    id: typeof value.id === 'string' && value.id.trim() ? value.id : fallbackId,
    weightMode,
    pounds: weightMode === 'pounds' && typeof value.pounds === 'string' ? value.pounds : '',
    reps: typeof value.reps === 'string' ? value.reps : '',
  };
}

function normalizeLegacyDetail(value: Record<string, unknown>): ExerciseDetail {
  const set = normalizeExerciseSet(
    {
      id: 'set-1',
      weightMode: value.weightMode,
      pounds: value.pounds,
      reps: value.reps,
    },
    'set-1',
  );

  return {
    exerciseName: typeof value.exerciseName === 'string' ? value.exerciseName : '',
    sets: [set],
    legacyNote: typeof value.legacyNote === 'string' ? value.legacyNote : undefined,
  };
}

export function normalizeExerciseDetail(value: unknown): ExerciseDetail {
  if (typeof value === 'string') {
    return {
      ...createEmptyExerciseDetail(),
      legacyNote: value,
    };
  }

  if (!isPlainRecord(value)) {
    return createEmptyExerciseDetail();
  }

  if (!Array.isArray(value.sets)) {
    return normalizeLegacyDetail(value);
  }

  const sets = value.sets.map((set, index) => normalizeExerciseSet(set, `set-${index + 1}`));

  return {
    exerciseName: typeof value.exerciseName === 'string' ? value.exerciseName : '',
    sets: sets.length > 0 ? sets : [createEmptyExerciseSet()],
    legacyNote: typeof value.legacyNote === 'string' ? value.legacyNote : undefined,
  };
}

function normalizeDetails(details: unknown): WorkoutLog['details'] {
  if (!isPlainRecord(details)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(details).map(([exerciseId, detail]) => [exerciseId, normalizeExerciseDetail(detail)]),
  );
}

export function createEmptyLog(date: string): WorkoutLog {
  return {
    date,
    completed: [],
    skipped: [],
    details: {},
    notes: '',
    prNote: '',
    supersets: [],
    daySkipped: false,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Every slot id a default program ever assigned to a court sport. Logged court
 * sessions are keyed by these ids, so the purge below can find them even when
 * a log has no snapshot or exercise name to test.
 */
const COURT_SPORT_SLOT_IDS: ReadonlySet<string> = new Set([
  'monday-11',
  'tuesday-7',
  'tuesday-8',
  'wednesday-12',
  'thursday-8',
  'thursday-10',
]);

/**
 * Ids in this log that belong to retired court-sport entries: the historical
 * default slots, anything the raw snapshot marks as cardio or names as a court
 * sport, and any detail that names one or carries legacy logged cardio minutes.
 * (`cardioMinutes` was only ever written for court sports; empty string was the
 * seeded blank, so only a non-blank value marks a court entry.)
 */
function collectCourtEntryIds(source: Record<string, unknown>): Set<string> {
  const courtIds = new Set(COURT_SPORT_SLOT_IDS);

  if (Array.isArray(source.exerciseSnapshot)) {
    for (const entry of source.exerciseSnapshot) {
      if (
        isPlainRecord(entry) &&
        typeof entry.id === 'string' &&
        (entry.kind === 'cardio' || (typeof entry.name === 'string' && isRetiredCourtSport(entry.name)))
      ) {
        courtIds.add(entry.id);
      }
    }
  }

  if (isPlainRecord(source.details)) {
    for (const [exerciseId, detail] of Object.entries(source.details)) {
      if (!isPlainRecord(detail)) {
        continue;
      }
      const exerciseName = typeof detail.exerciseName === 'string' ? detail.exerciseName : '';
      const legacyCardioMinutes = typeof detail.cardioMinutes === 'string' ? detail.cardioMinutes.trim() : '';
      if (isRetiredCourtSport(exerciseName) || legacyCardioMinutes) {
        courtIds.add(exerciseId);
      }
    }
  }

  return courtIds;
}

export function normalizeLog(date: string, log?: Partial<WorkoutLog>): WorkoutLog {
  const source = isPlainRecord(log) ? log : {};
  const courtIds = collectCourtEntryIds(source);
  const exerciseSnapshot = normalizeExerciseSnapshot(source.exerciseSnapshot);
  const startedAt = normalizeTimestamp(source.startedAt);
  const finishedAt = normalizeTimestamp(source.finishedAt);
  const details = Object.fromEntries(
    Object.entries(normalizeDetails(source.details)).filter(([exerciseId]) => !courtIds.has(exerciseId)),
  );

  return {
    date,
    completed: normalizeStringList(source.completed).filter((id) => !courtIds.has(id)),
    skipped: normalizeStringList(source.skipped).filter((id) => !courtIds.has(id)),
    details,
    notes: typeof source.notes === 'string' ? source.notes : '',
    prNote: typeof source.prNote === 'string' ? source.prNote : '',
    supersets: normalizeSupersets(source.supersets, exerciseSnapshot),
    daySkipped: Boolean(source.daySkipped),
    updatedAt: normalizeTimestamp(source.updatedAt) ?? new Date().toISOString(),
    ...(startedAt ? { startedAt } : {}),
    ...(finishedAt ? { finishedAt } : {}),
    ...(exerciseSnapshot ? { exerciseSnapshot } : {}),
  };
}

function getDefaultExerciseOrder(): ExerciseOrderByDay {
  return WEEK_DAYS.reduce((order, day) => {
    order[day] = PROGRAM[day].map((exercise) => exercise.id);
    return order;
  }, {} as ExerciseOrderByDay);
}

function normalizeDayOrder(day: Weekday, value: unknown): string[] {
  const defaultIds = PROGRAM[day].map((exercise) => exercise.id);
  const validIds = new Set(defaultIds);
  const orderedIds = Array.isArray(value) ? value : [];
  const pickedIds: string[] = [];

  orderedIds.forEach((id) => {
    if (typeof id === 'string' && validIds.has(id) && !pickedIds.includes(id)) {
      pickedIds.push(id);
    }
  });

  return [...pickedIds, ...defaultIds.filter((id) => !pickedIds.includes(id))];
}

export function normalizeExerciseOrder(value: unknown): ExerciseOrderByDay {
  const source = isPlainRecord(value) ? value : {};

  return WEEK_DAYS.reduce((order, day) => {
    order[day] = normalizeDayOrder(day, source[day]);
    return order;
  }, {} as ExerciseOrderByDay);
}

export function loadExerciseOrder(): ExerciseOrderByDay {
  try {
    const raw = window.localStorage.getItem(EXERCISE_ORDER_STORAGE_KEY);
    if (!raw) {
      return getDefaultExerciseOrder();
    }

    const parsed = JSON.parse(raw) as unknown;
    if (!isPlainRecord(parsed)) {
      return getDefaultExerciseOrder();
    }

    return normalizeExerciseOrder(isPlainRecord(parsed.order) ? parsed.order : parsed);
  } catch {
    return getDefaultExerciseOrder();
  }
}

export function saveExerciseOrder(order: ExerciseOrderByDay): void {
  window.localStorage.setItem(
    EXERCISE_ORDER_STORAGE_KEY,
    JSON.stringify({
      version: 1,
      order: normalizeExerciseOrder(order),
      savedAt: new Date().toISOString(),
    }),
  );
}

function getDefaultProgram(): ProgramByDay {
  return WEEK_DAYS.reduce((program, day) => {
    program[day] = PROGRAM[day].map((exercise) => ({
      ...exercise,
      target: { ...exercise.target },
    }));
    return program;
  }, {} as ProgramByDay);
}

function normalizeProgramExercise(day: Weekday, value: unknown, fallbackIndex: number): ProgramByDay[Weekday][number] | null {
  return normalizeExercise(value, day, fallbackIndex);
}

export function normalizeProgram(value: unknown): ProgramByDay {
  const source = isPlainRecord(value) ? value : {};
  const defaultProgram = getDefaultProgram();

  return WEEK_DAYS.reduce((program, day) => {
    const sourceExercises = source[day];

    if (!Array.isArray(sourceExercises)) {
      program[day] = defaultProgram[day];
      return program;
    }

    const seenIds = new Set<string>();
    const exercises = sourceExercises
      .map((exercise, index) => normalizeProgramExercise(day, exercise, index))
      .filter((exercise): exercise is ProgramByDay[Weekday][number] => {
        if (!exercise || seenIds.has(exercise.id)) {
          return false;
        }
        seenIds.add(exercise.id);
        return true;
      });

    program[day] = exercises;
    return program;
  }, {} as ProgramByDay);
}

/**
 * Fold a newer default program into a stored one without losing personal edits.
 *
 * Exercise ids are stable per slot, so an id that appears in both sides is the
 * same movement. Ids only the default knows about are new movements and get
 * added at their default position. Ids only the stored program knows about are
 * either movements the new default retired (they were in a previous default, so
 * drop them) or ones added by hand in the app (keep them, at the end of the day).
 *
 * Name and target follow the same rule for a movement present in both: if the
 * stored value still matches what was shipped, it was never touched and follows
 * the new default; if it differs, it is a personal edit and wins. That lets the
 * default change rep ranges — a light day and a heavy day can share a movement —
 * without overwriting a weight or rest the owner set themselves.
 *
 * Logged sets live in the workout logs keyed by exercise id and are never
 * touched here, so history and "use last time" survive the merge intact.
 * An explicit template reset can opt out of preserving names/custom entries
 * while still retaining tuned targets for ids that remain in the plan.
 */
function sameTarget(left: ExerciseTarget, right: ExerciseTarget): boolean {
  return (
    left.sets === right.sets &&
    left.repMin === right.repMin &&
    left.repMax === right.repMax &&
    left.restSeconds === right.restSeconds
  );
}
function reconcileProgramWithDefaults(
  storedProgram: ProgramByDay,
  replaceTemplate = false,
): ProgramByDay {
  const defaultProgram = getDefaultProgram();

  return WEEK_DAYS.reduce((program, day) => {
    const storedById = new Map(storedProgram[day].map((exercise) => [exercise.id, exercise]));
    const defaultIds = new Set(defaultProgram[day].map((exercise) => exercise.id));

    const merged = defaultProgram[day].map((defaultExercise) => {
      const stored = storedById.get(defaultExercise.id);
      if (!stored) {
        return defaultExercise;
      }

      // A slot still carrying any name a default ever shipped for it was never
      // renamed by hand, so it follows the new default; anything else is a
      // personal rename.
      const shippedNames = SHIPPED_DEFAULT_EXERCISE_NAMES.get(stored.id);
      const wasRenamedByHand = !replaceTemplate && shippedNames !== undefined && !shippedNames.has(stored.name);
      const name = wasRenamedByHand ? stored.name : defaultExercise.name;
      // A default may set a kind its name would not imply, so only re-infer when
      // the name came from the owner rather than from the default.
      const kind = wasRenamedByHand ? inferExerciseKind(name) : defaultExercise.kind;

      // A stored target still equal to the generic one for its kind was never
      // edited in the app, so it follows the new default. A movement the default
      // shipped with an explicit target reads as hand-tuned and keeps its stored
      // value — the comparison errs toward preserving what is on the device,
      // which is the safe direction.
      const wasTunedByHand = !sameTarget(stored.target, createDefaultExerciseTarget(stored.name, stored.kind));
      const target = wasTunedByHand ? stored.target : defaultExercise.target;

      const storedRest = { ...stored };
      delete (storedRest as { owner?: unknown }).owner;

      return {
        ...storedRest,
        name,
        kind,
        target: { ...target },
        workoutBlock: defaultExercise.workoutBlock,
        workoutLabel: defaultExercise.workoutLabel,
        blockOrder: defaultExercise.blockOrder,
      };
    });

    const customExercises = replaceTemplate
      ? []
      : storedProgram[day].filter((exercise) => {
          return !defaultIds.has(exercise.id) && !SHIPPED_DEFAULT_EXERCISE_NAMES.has(exercise.id);
        });

    program[day] = [...merged, ...customExercises.map((exercise) => ({ ...exercise, target: { ...exercise.target } }))];
    return program;
  }, {} as ProgramByDay);
}

export function loadProgram(): ProgramByDay {
  try {
    const rawProgram = window.localStorage.getItem(PROGRAM_STORAGE_KEY);
    if (rawProgram) {
      const parsed = JSON.parse(rawProgram) as unknown;
      if (isPlainRecord(parsed)) {
        const storedProgram = normalizeProgram(isPlainRecord(parsed.program) ? parsed.program : parsed);
        const storedVersion = typeof parsed.version === 'number' ? parsed.version : 0;
        if (storedVersion >= PROGRAM_SCHEMA_VERSION) {
          return storedProgram;
        }

        // Versions 7 and 9 are intentional full weekly-plan resets. Later
        // template updates, including v10 and v11, preserve personal additions
        // and names while bringing untouched default exercises in sync.
        const migratedProgram = reconcileProgramWithDefaults(storedProgram, storedVersion < 9);
        saveProgram(migratedProgram);
        return migratedProgram;
      }
    }

    return getDefaultProgram();
  } catch {
    return getDefaultProgram();
  }
}

export function saveProgram(program: ProgramByDay): void {
  window.localStorage.setItem(
    PROGRAM_STORAGE_KEY,
    JSON.stringify({
      version: PROGRAM_SCHEMA_VERSION,
      program: normalizeProgram(program),
      savedAt: new Date().toISOString(),
    }),
  );
}

export function normalizePreferences(value: unknown): Preferences {
  const source = isPlainRecord(value) ? value : {};

  return {
    weeklySessionGoal:
      normalizeInteger(source.weeklySessionGoal, 1, 7) ?? DEFAULT_PREFERENCES.weeklySessionGoal,
    defaultRestSeconds:
      normalizeInteger(source.defaultRestSeconds, 0, 1800) ?? DEFAULT_PREFERENCES.defaultRestSeconds,
  };
}

export function loadPreferences(): Preferences {
  try {
    const raw = window.localStorage.getItem(PREFERENCES_STORAGE_KEY);
    if (!raw) {
      return { ...DEFAULT_PREFERENCES };
    }

    const parsed = JSON.parse(raw) as unknown;
    if (!isPlainRecord(parsed)) {
      return { ...DEFAULT_PREFERENCES };
    }

    return normalizePreferences(isPlainRecord(parsed.preferences) ? parsed.preferences : parsed);
  } catch {
    return { ...DEFAULT_PREFERENCES };
  }
}

export function savePreferences(preferences: Preferences): void {
  window.localStorage.setItem(
    PREFERENCES_STORAGE_KEY,
    JSON.stringify({
      version: PREFERENCES_SCHEMA_VERSION,
      preferences: normalizePreferences(preferences),
      savedAt: new Date().toISOString(),
    }),
  );
}

export function loadLogs(): LogsByDate {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw) as unknown;
    if (!isPlainRecord(parsed)) {
      return {};
    }

    return normalizeLogs(isPlainRecord(parsed.logs) ? parsed.logs : parsed);
  } catch {
    return {};
  }
}

export function normalizeLogs(value: unknown): LogsByDate {
  if (!isPlainRecord(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value).map(([date, log]) => [date, normalizeLog(date, log as Partial<WorkoutLog>)]),
  );
}

export function saveLogs(logs: LogsByDate): void {
  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      version: 1,
      logs: normalizeLogs(logs),
      savedAt: new Date().toISOString(),
    }),
  );
}

export function createGymBackup(
  logs: LogsByDate,
  program: ProgramByDay,
  preferences: Preferences,
): GymBackup {
  return {
    version: GYM_BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    logs: normalizeLogs(logs),
    program: normalizeProgram(program),
    preferences: normalizePreferences(preferences),
  };
}

export function serializeGymBackup(
  logs: LogsByDate,
  program: ProgramByDay,
  preferences: Preferences,
): string {
  return JSON.stringify(createGymBackup(logs, program, preferences), null, 2);
}

function isCourtBackupExercise(value: unknown): boolean {
  return (
    isPlainRecord(value) &&
    (value.kind === 'cardio' || (typeof value.name === 'string' && isRetiredCourtSport(value.name)))
  );
}

function scrubBackupLog(value: unknown): unknown {
  if (!isPlainRecord(value)) {
    return value;
  }

  const courtIds = collectCourtEntryIds(value);
  const scrubbed: Record<string, unknown> = { ...value };

  if (Array.isArray(value.exerciseSnapshot)) {
    scrubbed.exerciseSnapshot = value.exerciseSnapshot.filter((entry) => !isCourtBackupExercise(entry));
  }
  if (isPlainRecord(value.details)) {
    scrubbed.details = Object.fromEntries(
      Object.entries(value.details).filter(([exerciseId]) => !courtIds.has(exerciseId)),
    );
  }
  if (Array.isArray(value.completed)) {
    scrubbed.completed = value.completed.filter((id) => typeof id !== 'string' || !courtIds.has(id));
  }
  if (Array.isArray(value.skipped)) {
    scrubbed.skipped = value.skipped.filter((id) => typeof id !== 'string' || !courtIds.has(id));
  }
  if (Array.isArray(value.supersets)) {
    scrubbed.supersets = value.supersets.filter((pair) => {
      if (!isPlainRecord(pair) || !Array.isArray(pair.exerciseIds)) {
        return true;
      }
      return !pair.exerciseIds.some((id) => typeof id === 'string' && courtIds.has(id));
    });
  }

  return scrubbed;
}

export function parseGymBackup(payload: unknown): GymBackup | null {
  let parsed = payload;

  if (typeof payload === 'string') {
    try {
      parsed = JSON.parse(payload) as unknown;
    } catch {
      return null;
    }
  }

  if (!isPlainRecord(parsed) || parsed.version !== GYM_BACKUP_VERSION) {
    return null;
  }

  const backupLogs = parsed.logs;
  const backupProgram = parsed.program;
  const backupPreferences = parsed.preferences;
  if (!isPlainRecord(backupLogs) || !isPlainRecord(backupProgram) || !isPlainRecord(backupPreferences)) {
    return null;
  }

  if (!WEEK_DAYS.every((day) => Array.isArray(backupProgram[day]))) {
    return null;
  }

  // Backups exported before the court-sport purge carry cardio entries. They
  // are stripped before validation so an old backup still imports cleanly
  // instead of being rejected wholesale.
  const scrubbedProgram = Object.fromEntries(
    WEEK_DAYS.map((day) => [
      day,
      (backupProgram[day] as unknown[]).filter((exercise) => !isCourtBackupExercise(exercise)),
    ]),
  );
  const scrubbedLogs = Object.fromEntries(
    Object.entries(backupLogs).map(([date, log]) => [date, scrubBackupLog(log)]),
  );

  const programIsValid = WEEK_DAYS.every((day) => {
    const exercises = scrubbedProgram[day] as unknown[];
    const ids = new Set<string>();
    return exercises.every((exercise) => {
      if (!isValidExercise(exercise, day) || ids.has(exercise.id)) {
        return false;
      }
      ids.add(exercise.id);
      return true;
    });
  });
  if (!programIsValid) {
    return null;
  }

  const logsAreValid = Object.entries(scrubbedLogs).every(([date, log]) => {
    return /^\d{4}-\d{2}-\d{2}$/.test(date) && isValidWorkoutLog(date, log);
  });
  if (!logsAreValid) {
    return null;
  }

  if (
    !isIntegerInRange(backupPreferences.weeklySessionGoal, 1, 7) ||
    !isIntegerInRange(backupPreferences.defaultRestSeconds, 0, 1800)
  ) {
    return null;
  }

  if (!isValidTimestamp(parsed.exportedAt)) {
    return null;
  }

  return {
    version: GYM_BACKUP_VERSION,
    exportedAt: parsed.exportedAt,
    logs: normalizeLogs(scrubbedLogs),
    program: normalizeProgram(scrubbedProgram),
    preferences: normalizePreferences(backupPreferences),
  };
}
