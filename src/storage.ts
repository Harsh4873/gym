import { createDefaultExerciseTarget, inferExerciseKind, PROGRAM, WEEK_DAYS } from './program';
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
const PROGRAM_SCHEMA_VERSION = 3;
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
    optionalIntegerIsValid('minutes', 1, 1440) &&
    optionalIntegerIsValid('restSeconds', 0, 1800);

  if (!valuesAreValid) {
    return false;
  }

  if (kind === 'cardio') {
    return isIntegerInRange(value.minutes, 1, 1440);
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
    (kind === 'strength' || kind === 'cardio' || kind === 'mobility') &&
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
    (value.cardioMinutes === undefined || typeof value.cardioMinutes === 'string') &&
    (value.legacyNote === undefined || typeof value.legacyNote === 'string')
  );
}

function isValidSuperset(value: unknown): boolean {
  return (
    isPlainRecord(value) &&
    typeof value.id === 'string' &&
    value.id.trim().length > 0 &&
    Array.isArray(value.exerciseIds) &&
    value.exerciseIds.length === 2 &&
    value.exerciseIds.every((id) => typeof id === 'string' && id.trim().length > 0)
  );
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
    Array.isArray(value.supersets) &&
    value.supersets.every(isValidSuperset) &&
    typeof value.daySkipped === 'boolean' &&
    isValidTimestamp(value.updatedAt) &&
    (value.startedAt === undefined || isValidTimestamp(value.startedAt)) &&
    (value.finishedAt === undefined || isValidTimestamp(value.finishedAt)) &&
    snapshotIsValid
  );
}

function normalizeExerciseKind(value: unknown, exerciseName: string): ExerciseKind {
  if (value === 'strength' || value === 'cardio' || value === 'mobility') {
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
  const minutes = normalizeInteger(source.minutes, 1, 1440);
  const restSeconds = normalizeInteger(source.restSeconds, 0, 1800);
  const normalizedSets = sets ?? defaults.sets;
  const normalizedRepMin = repMin ?? defaults.repMin;
  const normalizedRepMax = Math.max(repMax ?? defaults.repMax ?? 0, normalizedRepMin ?? 0) || undefined;
  const normalizedMinutes = minutes ?? defaults.minutes;
  const normalizedRestSeconds = restSeconds ?? defaults.restSeconds;

  return {
    ...(normalizedSets !== undefined ? { sets: normalizedSets } : {}),
    ...(normalizedRepMin !== undefined ? { repMin: normalizedRepMin } : {}),
    ...(normalizedRepMax !== undefined ? { repMax: normalizedRepMax } : {}),
    ...(normalizedMinutes !== undefined ? { minutes: normalizedMinutes } : {}),
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

  const storedDay = typeof value.day === 'string' && WEEK_DAYS.includes(value.day as Weekday)
    ? (value.day as Weekday)
    : undefined;
  const day = fallbackDay ?? storedDay;
  if (!day) {
    return null;
  }

  const kind = normalizeExerciseKind(value.kind, name);

  return {
    id: typeof value.id === 'string' && value.id.trim() ? value.id : `${day.toLowerCase()}-custom-${fallbackIndex + 1}`,
    day,
    name,
    kind,
    target: normalizeExerciseTarget(value.target, name, kind),
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
    cardioMinutes: '',
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
    cardioMinutes: typeof value.cardioMinutes === 'string' ? value.cardioMinutes : '',
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
    cardioMinutes: typeof value.cardioMinutes === 'string' ? value.cardioMinutes : '',
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

export function normalizeLog(date: string, log?: Partial<WorkoutLog>): WorkoutLog {
  const source = isPlainRecord(log) ? log : {};
  const exerciseSnapshot = normalizeExerciseSnapshot(source.exerciseSnapshot);
  const startedAt = normalizeTimestamp(source.startedAt);
  const finishedAt = normalizeTimestamp(source.finishedAt);

  return {
    date,
    completed: normalizeStringList(source.completed),
    skipped: normalizeStringList(source.skipped),
    details: normalizeDetails(source.details),
    notes: typeof source.notes === 'string' ? source.notes : '',
    prNote: typeof source.prNote === 'string' ? source.prNote : '',
    supersets: Array.isArray(source.supersets)
      ? source.supersets.filter((pair): pair is WorkoutLog['supersets'][number] => {
          return (
            isPlainRecord(pair) &&
            typeof pair.id === 'string' &&
            Array.isArray(pair.exerciseIds) &&
            pair.exerciseIds.length === 2 &&
            typeof pair.exerciseIds[0] === 'string' &&
            typeof pair.exerciseIds[1] === 'string'
          );
        })
      : [],
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

function applyStoredOrder(program: ProgramByDay, order: ExerciseOrderByDay): ProgramByDay {
  return WEEK_DAYS.reduce((nextProgram, day) => {
    const byId = new Map(program[day].map((exercise) => [exercise.id, exercise]));
    const orderedExercises = order[day].map((id) => byId.get(id)).filter(Boolean) as ProgramByDay[Weekday];
    const orderedIds = new Set(orderedExercises.map((exercise) => exercise.id));
    nextProgram[day] = [...orderedExercises, ...program[day].filter((exercise) => !orderedIds.has(exercise.id))];
    return nextProgram;
  }, {} as ProgramByDay);
}

export function loadProgram(): ProgramByDay {
  try {
    const rawProgram = window.localStorage.getItem(PROGRAM_STORAGE_KEY);
    if (rawProgram) {
      const parsed = JSON.parse(rawProgram) as unknown;
      if (isPlainRecord(parsed)) {
        return normalizeProgram(isPlainRecord(parsed.program) ? parsed.program : parsed);
      }
    }

    return applyStoredOrder(getDefaultProgram(), loadExerciseOrder());
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

  const programIsValid = WEEK_DAYS.every((day) => {
    const exercises = backupProgram[day] as unknown[];
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

  const logsAreValid = Object.entries(backupLogs).every(([date, log]) => {
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
    logs: normalizeLogs(backupLogs),
    program: normalizeProgram(backupProgram),
    preferences: normalizePreferences(backupPreferences),
  };
}
