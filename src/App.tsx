import {
  Activity,
  ArrowDown,
  ArrowUp,
  Ban,
  BookOpen,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Circle,
  CircleAlert,
  ClipboardList,
  Clock3,
  Cloud,
  CloudOff,
  Database,
  Download,
  Dumbbell,
  ExternalLink,
  Flame,
  Gauge,
  GripVertical,
  Headphones,
  Image as ImageIcon,
  Link2,
  ListChecks,
  LoaderCircle,
  LogIn,
  LogOut,
  Medal,
  Moon,
  Pause,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Settings,
  Square,
  Sun,
  Target,
  Trophy,
  Upload,
  X,
} from 'lucide-react';
import type { ComponentType, CSSProperties, Dispatch, DragEvent, SetStateAction, SVGProps } from 'react';
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import {
  addDays,
  endOfMonth,
  formatDateLabel,
  formatMonth,
  formatShortDate,
  getExercisesForDate,
  getWeekday,
  parseDateKey,
  startOfMonth,
  startOfWeek,
  toDateKey,
} from './dateUtils';
import {
  FREE_EXERCISE_DB_PROJECT_URL,
  getCustomExerciseGuides,
  getExerciseGuideFamily,
  getGuideMetaLabel,
  loadFreeExerciseLibrary,
  matchesExerciseGuide,
  normalizeExerciseName as normalizeLibraryExerciseName,
  resolvePersonalExerciseGuide,
  toExerciseGuide,
  type ExerciseGuide,
  type ExerciseGuideFamily,
  type FreeExerciseRecord,
} from './exerciseLibrary';
import {
  createDefaultExerciseTarget,
  inferExerciseKind,
  WEEK_DAYS,
} from './program';
import {
  createEmptyExerciseDetail,
  createEmptyExerciseSet,
  loadLogs,
  loadPreferences,
  normalizeLog,
  loadProgram,
  parseGymBackup,
  saveLogs,
  savePreferences,
  saveProgram,
  serializeGymBackup,
} from './storage';
import { useGymSync, type GymSyncController, type GymSyncStatus } from './useGymSync';
import type {
  DayStatus,
  Exercise,
  ExerciseKind,
  ExerciseSet,
  LogsByDate,
  Preferences,
  ProgramByDay,
  SupersetPair,
  TabId,
  ThemeMode,
  Weekday,
  WeightMode,
  WorkoutLog,
} from './types';

type IconType = ComponentType<SVGProps<SVGSVGElement>>;

const THEME_STORAGE_KEY = 'harsh-gym-theme-v1';
const REST_TIMER_STORAGE_KEY = 'harsh-gym-rest-timer-v1';
const WEEKLY_PLAN_ROLLOUT_STORAGE_KEY = 'harsh-gym-weekly-plan-v7-rollout';
type GetExercisesForDate = (dateKey: string) => Exercise[];
type RenameExerciseForDate = (
  dateKey: string,
  exerciseId: string,
  name: string,
  scope: 'date' | 'template',
) => void;
type CanRenameTemplateForDate = (dateKey: string, exerciseId: string) => boolean;

interface ExerciseGroup {
  id: string;
  type: 'single' | 'superset';
  exercises: Exercise[];
  supersetId?: string;
}

const TABS: Array<{ id: TabId; label: string; icon: IconType }> = [
  { id: 'logbook', label: 'Logbook', icon: BookOpen },
  { id: 'calendar', label: 'Calendar', icon: CalendarDays },
  { id: 'week', label: 'Week', icon: ListChecks },
  { id: 'milestones', label: 'Progress', icon: Trophy },
  { id: 'search', label: 'Search', icon: Search },
  { id: 'settings', label: 'Settings', icon: Settings },
];
const BOTTOM_TABS = TABS.filter((tab) => tab.id !== 'settings');

const STATUS_LABELS: Record<DayStatus, string> = {
  completed: 'Completed',
  partial: 'Partial',
  planned: 'Planned',
  skipped: 'Skipped',
  unlogged: 'Not logged',
  future: 'Future',
};

const SYNC_LABELS: Record<GymSyncStatus, string> = {
  local: 'Local only',
  connecting: 'Connecting',
  syncing: 'Syncing',
  synced: 'Synced',
  offline: 'Offline',
  error: 'Sync error',
};

function getStoredTheme(): ThemeMode {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === 'dark' || stored === 'light') {
      return stored;
    }

    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  } catch {
    return 'dark';
  }
}

function getTabFromHash(): TabId {
  const rawHash = window.location.hash.slice(1);
  if (rawHash === 'today') {
    return 'logbook';
  }

  const hash = rawHash as TabId;
  return TABS.some((tab) => tab.id === hash) ? hash : 'logbook';
}

interface RestTimerState {
  dateKey: string;
  endsAt?: number;
  remainingSeconds: number;
}

function readRestTimerRecords(): Record<string, Partial<RestTimerState>> {
  try {
    const raw = window.localStorage.getItem(REST_TIMER_STORAGE_KEY);
    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {};
    }

    const source = parsed as Record<string, unknown>;
    if (source.timers && typeof source.timers === 'object' && !Array.isArray(source.timers)) {
      return source.timers as Record<string, Partial<RestTimerState>>;
    }

    // Migrate the original single-timer payload without dropping an active timer.
    return typeof source.dateKey === 'string'
      ? { [source.dateKey]: source as Partial<RestTimerState> }
      : {};
  } catch {
    return {};
  }
}

function normalizeRestTimer(dateKey: string, value?: Partial<RestTimerState>, now = Date.now()): RestTimerState {
  const endsAt = typeof value?.endsAt === 'number' && Number.isFinite(value.endsAt) ? value.endsAt : undefined;
  const remainingSeconds = endsAt
    ? Math.max(0, Math.ceil((endsAt - now) / 1000))
    : typeof value?.remainingSeconds === 'number' && Number.isFinite(value.remainingSeconds)
      ? Math.max(0, Math.floor(value.remainingSeconds))
      : 0;

  return remainingSeconds > 0
    ? { dateKey, remainingSeconds, ...(endsAt && endsAt > now ? { endsAt } : {}) }
    : { dateKey, remainingSeconds: 0 };
}

function loadRestTimer(dateKey: string): RestTimerState {
  return normalizeRestTimer(dateKey, readRestTimerRecords()[dateKey]);
}

function saveRestTimer(timer: RestTimerState): void {
  try {
    const now = Date.now();
    const timers = Object.entries(readRestTimerRecords()).reduce<Record<string, RestTimerState>>(
      (current, [dateKey, storedTimer]) => {
        const normalized = normalizeRestTimer(dateKey, storedTimer, now);
        if (normalized.remainingSeconds > 0) {
          current[dateKey] = normalized;
        }
        return current;
      },
      {},
    );
    const normalizedTimer = normalizeRestTimer(timer.dateKey, timer, now);
    if (normalizedTimer.remainingSeconds > 0) {
      timers[timer.dateKey] = normalizedTimer;
    } else {
      delete timers[timer.dateKey];
    }

    window.localStorage.setItem(
      REST_TIMER_STORAGE_KEY,
      JSON.stringify({ version: 2, timers }),
    );
  } catch {
    // Rest timing is convenience state; workout data remains unaffected.
  }
}

/*
 * Timer countdowns use absolute deadlines. That keeps them accurate when the
 * browser throttles a background tab, while the date-keyed store preserves a
 * live timer when another Logbook date is opened.
 */
function getRestSeconds(timer: RestTimerState, now: number): number {
  if (!timer.endsAt) {
    return timer.remainingSeconds;
  }

  return Math.max(0, Math.ceil((timer.endsAt - now) / 1000));
}

function createSetId(): string {
  return `set-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function uniqueList(items: string[]): string[] {
  return Array.from(new Set(items));
}

function touchLog(log: WorkoutLog): WorkoutLog {
  const previousUpdatedAt = Date.parse(log.updatedAt);
  const updatedAt = new Date(
    Math.max(Date.now(), Number.isFinite(previousUpdatedAt) ? previousUpdatedAt + 1 : 0),
  ).toISOString();
  return { ...log, updatedAt };
}

function applyExerciseOrder(exercises: Exercise[], orderedIds: string[]): Exercise[] {
  const byId = new Map(exercises.map((exercise) => [exercise.id, exercise]));
  const orderedExercises = orderedIds.map((id) => byId.get(id)).filter(Boolean) as Exercise[];
  const orderedSet = new Set(orderedExercises.map((exercise) => exercise.id));

  return [...orderedExercises, ...exercises.filter((exercise) => !orderedSet.has(exercise.id))];
}

function getProgramExercisesForDate(dateKey: string, program: ProgramByDay): Exercise[] {
  const day = getWeekday(parseDateKey(dateKey));
  return program[day];
}

function createWorkoutId(day: Weekday): string {
  return `${day.toLowerCase()}-custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function countCompleted(exercises: Exercise[], log: WorkoutLog): number {
  const ids = new Set(exercises.map((exercise) => exercise.id));
  return log.completed.filter((id) => ids.has(id)).length;
}

function hasRecordedExerciseWork(log: WorkoutLog): boolean {
  return (
    log.completed.length > 0 ||
    Object.values(log.details).some((detail) => detail.sets.some((set) => isSetFilled(set)))
  );
}

function hasTrainingActivity(log: WorkoutLog): boolean {
  return (
    Boolean(log.startedAt) ||
    Boolean(log.finishedAt) ||
    log.completed.length > 0 ||
    log.skipped.length > 0 ||
    Boolean(log.notes.trim()) ||
    Boolean(log.prNote.trim()) ||
    Object.values(log.details).some((detail) => {
      return Boolean(
        detail.legacyNote?.trim() ||
          detail.sets.some((set) => {
            return Boolean(set.reps.trim() || set.pounds.trim());
          }),
      );
    })
  );
}

function hasPlanActivity(log: WorkoutLog): boolean {
  return log.exerciseSnapshot !== undefined || log.supersets.length > 0;
}

function getDayStatus(dateKey: string, log: WorkoutLog, todayKey: string, exercises = getExercisesForDate(dateKey)): DayStatus {
  const completed = countCompleted(exercises, log);

  if (dateKey > todayKey) {
    return 'future';
  }

  if (log.daySkipped) {
    return 'skipped';
  }

  if (completed === exercises.length && exercises.length > 0) {
    return 'completed';
  }

  if (completed > 0 || hasTrainingActivity(log)) {
    return 'partial';
  }

  return hasPlanActivity(log) || (dateKey === todayKey && exercises.length > 0) ? 'planned' : 'unlogged';
}

function getValidSupersets(exercises: Exercise[], supersets: SupersetPair[]): SupersetPair[] {
  const exerciseIds = new Set(exercises.map((exercise) => exercise.id));
  const usedExerciseIds = new Set<string>();
  const usedPairIds = new Set<string>();

  return supersets.filter((superset) => {
    const [firstId, secondId] = superset.exerciseIds;
    const valid =
      Boolean(superset.id.trim()) &&
      !usedPairIds.has(superset.id) &&
      firstId !== secondId &&
      exerciseIds.has(firstId) &&
      exerciseIds.has(secondId) &&
      !usedExerciseIds.has(firstId) &&
      !usedExerciseIds.has(secondId);

    if (!valid) {
      return false;
    }

    usedPairIds.add(superset.id);
    usedExerciseIds.add(firstId);
    usedExerciseIds.add(secondId);
    return true;
  });
}

function buildExerciseGroups(exercises: Exercise[], supersets: SupersetPair[]): ExerciseGroup[] {
  const byId = new Map(exercises.map((exercise) => [exercise.id, exercise]));
  const supersetByExerciseId = new Map<string, SupersetPair>();
  const used = new Set<string>();
  const groups: ExerciseGroup[] = [];

  supersets.forEach((superset) => {
    const pairExists = superset.exerciseIds.every((id) => byId.has(id));
    if (!pairExists) {
      return;
    }

    superset.exerciseIds.forEach((id) => supersetByExerciseId.set(id, superset));
  });

  exercises.forEach((exercise) => {
    if (used.has(exercise.id)) {
      return;
    }

    const superset = supersetByExerciseId.get(exercise.id);
    if (superset) {
      const pair = exercises.filter((candidate) => superset.exerciseIds.includes(candidate.id));
      if (pair.length === 2 && pair.every((pairedExercise) => !used.has(pairedExercise.id))) {
        pair.forEach((pairedExercise) => used.add(pairedExercise.id));
        groups.push({
          id: superset.id,
          type: 'superset',
          exercises: pair,
          supersetId: superset.id,
        });
        return;
      }
    }

    used.add(exercise.id);
    groups.push({
      id: exercise.id,
      type: 'single',
      exercises: [exercise],
    });
  });

  return groups;
}

function orderExercisesForLog(exercises: Exercise[], log: WorkoutLog): Exercise[] {
  const originalIndexes = new Map(exercises.map((exercise, index) => [exercise.id, index]));
  const isFinished = (exerciseId: string) =>
    log.completed.includes(exerciseId) || log.skipped.includes(exerciseId);

  return [...exercises].sort((left, right) => {
    const leftFinished = isFinished(left.id) ? 1 : 0;
    const rightFinished = isFinished(right.id) ? 1 : 0;
    if (leftFinished !== rightFinished) {
      return leftFinished - rightFinished;
    }

    const workoutBlockDifference = (left.workoutBlock ?? 1) - (right.workoutBlock ?? 1);
    if (workoutBlockDifference !== 0) {
      return workoutBlockDifference;
    }

    return (originalIndexes.get(left.id) ?? 0) - (originalIndexes.get(right.id) ?? 0);
  });
}

function getProgressMeta(exercises: Exercise[], log: WorkoutLog) {
  const completed = countCompleted(exercises, log);
  const skipped = log.skipped.filter((id) => exercises.some((exercise) => exercise.id === id)).length;
  const total = exercises.length;
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

  return { completed, skipped, total, percent };
}

function normalizeExerciseName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

function exerciseNamesMatch(leftName: string | undefined, rightName: string): boolean {
  if (!leftName?.trim() || !rightName.trim()) {
    return false;
  }

  return normalizeExerciseName(leftName) === normalizeExerciseName(rightName);
}

function isSetFilled(set: ExerciseSet): boolean {
  return Boolean(set.reps.trim() || (set.weightMode === 'pounds' && set.pounds.trim()));
}

function isExerciseDetailEmpty(detail?: ReturnType<typeof createEmptyExerciseDetail>): boolean {
  if (!detail) {
    return true;
  }

  return !detail.legacyNote?.trim() && detail.sets.every((set) => !isSetFilled(set));
}

function getExerciseKind(exercise: Exercise): ExerciseKind {
  return exercise.kind ?? inferExerciseKind(exercise.name);
}

function formatDuration(totalSeconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
    : `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function getSessionDurationSeconds(log: WorkoutLog, now = Date.now()): number {
  if (!log.startedAt) {
    return 0;
  }

  const startedAt = Date.parse(log.startedAt);
  const finishedAt = log.finishedAt ? Date.parse(log.finishedAt) : now;
  if (!Number.isFinite(startedAt) || !Number.isFinite(finishedAt) || finishedAt < startedAt) {
    return 0;
  }

  return Math.floor((finishedAt - startedAt) / 1000);
}

function getExerciseTargetSummary(exercise: Exercise): string {
  const sets = exercise.target.sets ?? 1;
  const rest = exercise.target.restSeconds ?? 0;
  if (getExerciseKind(exercise) === 'mobility') {
    return `${sets} ${sets === 1 ? 'round' : 'rounds'}${rest ? ` · ${rest}s reset` : ''}`;
  }

  const repMin = exercise.target.repMin;
  const repMax = exercise.target.repMax;
  const reps = repMin && repMax ? (repMin === repMax ? `${repMin} reps` : `${repMin}–${repMax} reps`) : 'quality reps';
  return `${sets} sets · ${reps}${rest ? ` · ${rest}s rest` : ''}`;
}

function cloneExercises(exercises: Exercise[]): Exercise[] {
  return exercises.map((exercise) => ({ ...exercise, target: { ...exercise.target } }));
}

function loadLogsWithCurrentPlan(todayKey: string, program: ProgramByDay): LogsByDate {
  const loadedLogs = loadLogs();

  try {
    if (window.localStorage.getItem(WEEKLY_PLAN_ROLLOUT_STORAGE_KEY)) {
      return loadedLogs;
    }

    const currentLog = normalizeLog(todayKey, loadedLogs[todayKey]);
    const todayExercises = cloneExercises(getProgramExercisesForDate(todayKey, program));
    const validExerciseIds = new Set(todayExercises.map((exercise) => exercise.id));
    const migratedLog: WorkoutLog = {
      ...currentLog,
      completed: currentLog.completed.filter((id) => validExerciseIds.has(id)),
      skipped: currentLog.skipped.filter((id) => validExerciseIds.has(id)),
      supersets: getValidSupersets(todayExercises, currentLog.supersets),
      exerciseSnapshot: todayExercises,
      updatedAt: new Date().toISOString(),
    };

    const migratedLogs = { ...loadedLogs, [todayKey]: migratedLog };
    saveLogs(migratedLogs);
    window.localStorage.setItem(WEEKLY_PLAN_ROLLOUT_STORAGE_KEY, todayKey);
    return migratedLogs;
  } catch {
    return loadedLogs;
  }
}

function formatSetSummary(sets: ExerciseSet[], kind: 'stretch' | 'strength' = 'strength'): string {
  const filledSets = sets.filter(isSetFilled);
  if (filledSets.length === 0) {
    return '';
  }

  const summary = filledSets.slice(0, 3).map((set) => {
    const reps = set.reps.trim();
    if (kind === 'stretch') {
      return reps ? `${reps} reps` : 'Done';
    }

    if (set.weightMode === 'pounds' && set.pounds.trim()) {
      return reps ? `${set.pounds.trim()} x ${reps}` : `${set.pounds.trim()} lb`;
    }

    return reps ? `BW x ${reps}` : 'Body weight';
  });

  const remaining = filledSets.length - summary.length;
  return `${summary.join(', ')}${remaining > 0 ? ` +${remaining}` : ''}`;
}

function getSetVolume(set: ExerciseSet): number {
  const reps = Number(set.reps);
  const pounds = Number(set.pounds);
  if (!Number.isFinite(reps) || reps <= 0) {
    return 0;
  }

  if (set.weightMode !== 'pounds' || !Number.isFinite(pounds) || pounds <= 0) {
    return 0;
  }

  return pounds * reps;
}

function getSetReps(set: ExerciseSet): number {
  const reps = Number(set.reps);
  return Number.isFinite(reps) && reps > 0 ? reps : 0;
}

function getLogSetCount(log: WorkoutLog): number {
  return Object.values(log.details).reduce((total, detail) => total + detail.sets.filter(isSetFilled).length, 0);
}

function getLogReps(log: WorkoutLog): number {
  return Object.values(log.details).reduce((total, detail) => {
    return total + detail.sets.reduce((setTotal, set) => setTotal + getSetReps(set), 0);
  }, 0);
}

function getLogVolume(log: WorkoutLog): number {
  return Object.values(log.details).reduce((total, detail) => {
    return total + detail.sets.reduce((setTotal, set) => setTotal + getSetVolume(set), 0);
  }, 0);
}

function findPreviousExerciseDetail(
  exercise: Exercise,
  dateKey: string,
  logs: LogsByDate,
) {
  const previousDates = Object.keys(logs)
    .filter((logDate) => logDate < dateKey)
    .sort((a, b) => b.localeCompare(a));

  for (const previousDate of previousDates) {
    const previousLog = normalizeLog(previousDate, logs[previousDate]);
    const detailById = previousLog.details[exercise.id];
    if (detailById && !isExerciseDetailEmpty(detailById)) {
      return { dateKey: previousDate, detail: detailById };
    }

    const detail = Object.values(previousLog.details).find((candidate) => {
      return exerciseNamesMatch(candidate.exerciseName, exercise.name) && !isExerciseDetailEmpty(candidate);
    });
    if (detail && !isExerciseDetailEmpty(detail)) {
      return { dateKey: previousDate, detail };
    }
  }

  return null;
}

function getExercisePreviousBest(
  exercise: Exercise,
  dateKey: string,
  logs: LogsByDate,
): number {
  return Object.keys(logs).reduce((best, logDate) => {
    if (logDate >= dateKey) {
      return best;
    }

    const previousLog = normalizeLog(logDate, logs[logDate]);
    const detailById = previousLog.details[exercise.id];
    if (detailById && !isExerciseDetailEmpty(detailById)) {
      return Math.max(best, ...detailById.sets.map(getSetVolume));
    }

    const matchingDetails = Object.values(previousLog.details).filter((detail) =>
      exerciseNamesMatch(detail.exerciseName, exercise.name),
    );
    return Math.max(best, ...matchingDetails.flatMap((detail) => detail.sets.map(getSetVolume)));
  }, 0);
}

function isFinishedSession(log: WorkoutLog, exercises: Exercise[]): boolean {
  if (log.daySkipped || exercises.length === 0) {
    return false;
  }

  const progress = getProgressMeta(exercises, log);
  return (
    (Boolean(log.finishedAt) && hasRecordedExerciseWork(log)) ||
    (progress.total > 0 && progress.completed === progress.total)
  );
}

function buildTrainingStats(logs: LogsByDate, todayKey: string, getExercises: GetExercisesForDate) {
  const recentDates = buildRecentDates(todayKey, 28).reverse();
  const weekDates = buildRecentDates(todayKey, 7).reverse();
  let completedSessions = 0;
  let stretchDays = 0;
  let totalReps = 0;
  let totalVolume = 0;
  const prNotes: Array<{ dateKey: string; note: string }> = [];
  const weeklyTrend = weekDates.map((dateKey) => {
    const log = normalizeLog(dateKey, logs[dateKey]);
    const exercises = getExercises(dateKey);
    const progress = getProgressMeta(exercises, log);
    const volume = getLogVolume(log);
    const reps = getLogReps(log);

    if (isFinishedSession(log, exercises)) {
      completedSessions += 1;
    }

    totalReps += reps;
    totalVolume += volume;

    if (exercises.some((exercise) => log.completed.includes(exercise.id) && getExerciseKind(exercise) === 'mobility')) {
      stretchDays += 1;
    }

    if (log.prNote.trim()) {
      prNotes.push({ dateKey, note: log.prNote.trim() });
    }

    return { dateKey, volume, reps, completed: progress.completed, total: progress.total };
  });

  recentDates.slice(0, -7).forEach((dateKey) => {
    const log = normalizeLog(dateKey, logs[dateKey]);
    const exercises = getExercises(dateKey);
    const progress = getProgressMeta(exercises, log);
    if (isFinishedSession(log, exercises)) {
      completedSessions += 1;
    }
    totalReps += getLogReps(log);
    totalVolume += getLogVolume(log);
    if (exercises.some((exercise) => log.completed.includes(exercise.id) && getExerciseKind(exercise) === 'mobility')) {
      stretchDays += 1;
    }
    if (log.prNote.trim()) {
      prNotes.push({ dateKey, note: log.prNote.trim() });
    }
  });

  let streak = 0;
  const streakDates = buildRecentDates(todayKey, 90);
  const todayLog = normalizeLog(todayKey, logs[todayKey]);
  if (!todayLog.daySkipped && !isFinishedSession(todayLog, getExercises(todayKey))) {
    streakDates.shift();
  }

  for (const dateKey of streakDates) {
    const log = normalizeLog(dateKey, logs[dateKey]);
    const exercises = getExercises(dateKey);
    if (isFinishedSession(log, exercises)) {
      streak += 1;
    } else {
      break;
    }
  }

  const weekStart = startOfWeek(parseDateKey(todayKey));
  const weekSessions = Array.from({ length: 7 }, (_, index) => toDateKey(addDays(weekStart, index)))
    .filter((dateKey) => dateKey <= todayKey)
    .filter((dateKey) => {
      const log = normalizeLog(dateKey, logs[dateKey]);
      return isFinishedSession(log, getExercises(dateKey));
    }).length;

  prNotes.sort((left, right) => right.dateKey.localeCompare(left.dateKey));

  return {
    completedSessions,
    prNotes,
    streak,
    stretchDays,
    totalReps,
    totalVolume,
    weekSessions,
    weeklyTrend,
  };
}

function MetricTile({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: IconType;
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <article className="metric-tile" style={{ '--metric-accent': accent } as CSSProperties}>
      <div className="metric-icon">
        <Icon aria-hidden="true" />
      </div>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
    </article>
  );
}

function TabButton({
  active,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: IconType;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className={`tab-button ${active ? 'active' : ''}`}
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-current={active ? 'page' : undefined}
    >
      <Icon aria-hidden="true" />
      <span>{label}</span>
    </button>
  );
}

function StatusPill({ status }: { status: DayStatus }) {
  return <span className={`status-pill ${status}`}>{STATUS_LABELS[status]}</span>;
}

function SyncStatusIndicator({ sync, compact = false }: { sync: GymSyncController; compact?: boolean }) {
  const effectiveStatus: GymSyncStatus = sync.configured ? sync.status : 'local';
  const Icon = effectiveStatus === 'synced'
    ? Cloud
    : effectiveStatus === 'connecting' || effectiveStatus === 'syncing'
      ? LoaderCircle
      : effectiveStatus === 'offline'
        ? CloudOff
        : effectiveStatus === 'error'
          ? CircleAlert
          : Database;
  const label = SYNC_LABELS[effectiveStatus];
  const accessibleLabel = sync.error ?? (sync.user ? `${label} as ${sync.user.email}` : label);

  return (
    <span
      className={`sync-status ${effectiveStatus} ${compact ? 'compact' : ''}`}
      title={accessibleLabel}
      aria-label={accessibleLabel}
      role="status"
      aria-live="polite"
    >
      <Icon className={effectiveStatus === 'connecting' || effectiveStatus === 'syncing' ? 'spin' : ''} aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
}

function GymLogo() {
  return (
    <span className="gym-logo" aria-hidden="true">
      <Dumbbell />
    </span>
  );
}

function AppHeader({
  activeTab,
  sync,
  theme,
  onNavigate,
  onThemeToggle,
}: {
  activeTab: TabId;
  sync: GymSyncController;
  theme: ThemeMode;
  onNavigate: (tab: TabId) => void;
  onThemeToggle: () => void;
}) {
  return (
    <header className="app-header">
      <a
        className="brand-link"
        href="#logbook"
        aria-label="Gym logbook view"
        onClick={(event) => {
          event.preventDefault();
          onNavigate('logbook');
        }}
      >
        <GymLogo />
        <span>
          <strong>Gym</strong>
          <small>harsh.bet / gym</small>
        </span>
      </a>

      <nav className="desktop-nav" aria-label="Gym views">
        {TABS.map((tab) => (
          <TabButton
            key={tab.id}
            active={activeTab === tab.id}
            icon={tab.icon}
            label={tab.label}
            onClick={() => onNavigate(tab.id)}
          />
        ))}
      </nav>

      <div className="header-tools">
        <SyncStatusIndicator sync={sync} compact />
        <button
          className={`settings-shortcut ${activeTab === 'settings' ? 'active' : ''}`}
          type="button"
          onClick={() => onNavigate('settings')}
          aria-label="Open Gym settings"
          aria-current={activeTab === 'settings' ? 'page' : undefined}
        >
          <Settings aria-hidden="true" />
        </button>
        <button
          className="theme-toggle"
          type="button"
          onClick={onThemeToggle}
          aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
        >
          {theme === 'dark' ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
        </button>
      </div>
    </header>
  );
}

function AppFooter() {
  return (
    <footer className="app-footer">
      <div>
        <GymLogo />
        <span>
          <strong>Gym</strong>
          <small>Train · record · progress</small>
        </span>
      </div>
      <p>Local-first by default, securely synced across your devices when you sign in.</p>
    </footer>
  );
}

function WorkoutPanel({
  dateKey,
  exercises,
  log,
  logs,
  preferences,
  todayKey,
  getExercises,
  onReorder,
  onRename,
  canRenameTemplate,
  onUpdate,
  onClear,
}: {
  dateKey: string;
  exercises: Exercise[];
  log: WorkoutLog;
  logs: LogsByDate;
  preferences: Preferences;
  todayKey: string;
  getExercises: GetExercisesForDate;
  onReorder: (exerciseIds: string[]) => void;
  onRename: (exerciseId: string, name: string, scope: 'date' | 'template') => void;
  canRenameTemplate: (exerciseId: string) => boolean;
  onUpdate: (updater: (log: WorkoutLog) => WorkoutLog) => void;
  onClear: () => void;
}) {
  const [firstSupersetId, setFirstSupersetId] = useState(exercises[0]?.id ?? '');
  const [secondSupersetId, setSecondSupersetId] = useState(exercises[1]?.id ?? '');
  const [draggedGroupId, setDraggedGroupId] = useState<string | null>(null);
  const [dragOverGroupId, setDragOverGroupId] = useState<string | null>(null);
  const [mobileToolsOpen, setMobileToolsOpen] = useState(false);
  const [supersetToolsOpen, setSupersetToolsOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [reorderMode, setReorderMode] = useState(false);
  const [collapsedExerciseIds, setCollapsedExerciseIds] = useState<string[]>(() => [...log.completed]);
  const [editingExerciseId, setEditingExerciseId] = useState<string | null>(null);
  const [exerciseNameDraft, setExerciseNameDraft] = useState('');
  const [clockNow, setClockNow] = useState(() => Date.now());
  const [restTimer, setRestTimer] = useState<RestTimerState>(() => loadRestTimer(dateKey));
  const restSeconds = getRestSeconds(restTimer, clockNow);
  const restRunning = Boolean(restTimer.endsAt && restSeconds > 0);
  const exerciseSignature = exercises.map((exercise) => `${exercise.id}:${exercise.name}`).join('|');
  const finishedExerciseSignature = [...new Set([...log.completed, ...log.skipped])].sort().join('|');
  const progress = getProgressMeta(exercises, log);
  const status = getDayStatus(dateKey, log, todayKey, exercises);
  const activeSupersets = getValidSupersets(exercises, log.supersets);
  const supersetSignature = activeSupersets
    .map((superset) => `${superset.id}:${superset.exerciseIds.join('+')}`)
    .join('|');
  const supersetExerciseCount = activeSupersets.length * 2;
  const loggedSets = getLogSetCount(log);
  const sessionVolume = getLogVolume(log);
  const hasSessionWork = hasRecordedExerciseWork(log);
  const hasSavedLog = hasTrainingActivity(log) || hasPlanActivity(log);
  const sessionActive = Boolean(log.startedAt && !log.finishedAt);
  const sessionFinished = Boolean(log.finishedAt);
  const sessionLogged = !log.startedAt && !log.finishedAt && progress.total > 0 && progress.completed === progress.total;
  const sessionDurationSeconds = getSessionDurationSeconds(log, clockNow);
  const pairedIds = new Set(activeSupersets.flatMap((pair) => pair.exerciseIds));
  const unpairedExercises = exercises.filter((exercise) => !pairedIds.has(exercise.id));
  const groups = buildExerciseGroups(orderExercisesForLog(exercises, log), activeSupersets);
  const previousByExerciseId = useMemo(() => {
    return new Map(
      exercises.map((exercise) => [exercise.id, findPreviousExerciseDetail(exercise, dateKey, logs)]),
    );
  }, [dateKey, exerciseSignature, logs]);
  const previousBestByExerciseId = useMemo(() => {
    return new Map(
      exercises.map((exercise) => [exercise.id, getExercisePreviousBest(exercise, dateKey, logs)]),
    );
  }, [dateKey, exerciseSignature, logs]);
  const hasPreviousWorkout = exercises.some((exercise) => Boolean(previousByExerciseId.get(exercise.id)));

  useEffect(() => {
    const available = exercises.filter((exercise) => !pairedIds.has(exercise.id));
    setFirstSupersetId(available[0]?.id ?? '');
    setSecondSupersetId(available[1]?.id ?? '');
  }, [dateKey, exerciseSignature, supersetSignature]);

  useEffect(() => {
    setEditingExerciseId(null);
    setExerciseNameDraft('');
    setSupersetToolsOpen(false);
    setCollapsedExerciseIds((current) => {
      const finishedIds = new Set([...log.completed, ...log.skipped]);
      return uniqueList([
        ...current.filter((id) => exercises.some((exercise) => exercise.id === id) && !finishedIds.has(id)),
        ...exercises.filter((exercise) => finishedIds.has(exercise.id)).map((exercise) => exercise.id),
      ]);
    });
  }, [dateKey, exerciseSignature, finishedExerciseSignature]);

  useEffect(() => {
    setRestTimer(loadRestTimer(dateKey));
  }, [dateKey]);

  useEffect(() => {
    saveRestTimer(restTimer);
  }, [restTimer]);

  useEffect(() => {
    if (restTimer.endsAt && restTimer.endsAt <= clockNow) {
      setRestTimer({ dateKey, remainingSeconds: 0 });
    }
  }, [clockNow, dateKey, restTimer.endsAt]);

  useEffect(() => {
    setClockNow(Date.now());
    if (!sessionActive && !restTimer.endsAt) {
      return undefined;
    }

    const timer = window.setInterval(() => setClockNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [dateKey, restTimer.endsAt, sessionActive]);

  const canAddSuperset =
    firstSupersetId &&
    secondSupersetId &&
    firstSupersetId !== secondSupersetId &&
    !pairedIds.has(firstSupersetId) &&
    !pairedIds.has(secondSupersetId);

  const getExerciseName = (exerciseId: string) => exercises.find((exercise) => exercise.id === exerciseId)?.name ?? '';

  const beginRenameExercise = (exercise: Exercise) => {
    setEditingExerciseId(exercise.id);
    setExerciseNameDraft(exercise.name);
  };

  const saveExerciseName = (exerciseId: string, scope: 'date' | 'template') => {
    const nextName = exerciseNameDraft.trim();
    if (!nextName) {
      return;
    }

    onRename(exerciseId, nextName, scope);
    setEditingExerciseId(null);
    setExerciseNameDraft('');
  };

  const toggleComplete = (exerciseId: string) => {
    const wasCompleted = log.completed.includes(exerciseId);
    setCollapsedExerciseIds((current) =>
      wasCompleted ? current.filter((id) => id !== exerciseId) : uniqueList([...current, exerciseId]),
    );
    const exercise = exercises.find((candidate) => candidate.id === exerciseId);
    if (!wasCompleted && exercise) {
      const nextRestSeconds = exercise.target.restSeconds ?? preferences.defaultRestSeconds;
      setRestTimer({
        dateKey,
        remainingSeconds: nextRestSeconds,
        ...(nextRestSeconds > 0 ? { endsAt: Date.now() + nextRestSeconds * 1000 } : {}),
      });
    }

    onUpdate((current) => {
      const completed = current.completed.includes(exerciseId)
        ? current.completed.filter((id) => id !== exerciseId)
        : uniqueList([...current.completed, exerciseId]);

      return touchLog({
        ...current,
        completed,
        skipped: current.skipped.filter((id) => id !== exerciseId),
        daySkipped: false,
      });
    });
  };

  const useLastSets = (exerciseId: string) => {
    const previous = previousByExerciseId.get(exerciseId);
    if (!previous) {
      return;
    }

    onUpdate((current) => {
      const currentDetail = current.details[exerciseId] ?? createEmptyExerciseDetail();
      if (!isExerciseDetailEmpty(currentDetail)) {
        return current;
      }

      return touchLog({
        ...current,
        details: {
          ...current.details,
          [exerciseId]: {
            ...currentDetail,
            exerciseName: getExerciseName(exerciseId),
            sets: previous.detail.sets.map((set) => ({
              ...set,
              id: createSetId(),
            })),
          },
        },
        daySkipped: false,
      });
    });
  };

  const toggleSkip = (exerciseId: string) => {
    const wasSkipped = log.skipped.includes(exerciseId);
    setCollapsedExerciseIds((current) =>
      wasSkipped ? current.filter((id) => id !== exerciseId) : uniqueList([...current, exerciseId]),
    );
    onUpdate((current) => {
      const skipped = current.skipped.includes(exerciseId)
        ? current.skipped.filter((id) => id !== exerciseId)
        : uniqueList([...current.skipped, exerciseId]);

      return touchLog({
        ...current,
        skipped,
        completed: current.completed.filter((id) => id !== exerciseId),
        daySkipped: false,
      });
    });
  };

  const updateExerciseSet = (exerciseId: string, setId: string, setPatch: Partial<ExerciseSet>) => {
    onUpdate((current) => {
      const currentDetail = current.details[exerciseId] ?? createEmptyExerciseDetail();
      const nextSets = currentDetail.sets.map((set) => {
        if (set.id !== setId) {
          return set;
        }

        const nextSet: ExerciseSet = {
          ...set,
          ...setPatch,
        };

        return {
          ...nextSet,
          pounds: nextSet.weightMode === 'bodyweight' ? '' : nextSet.pounds,
        };
      });

      return touchLog({
        ...current,
        details: {
          ...current.details,
          [exerciseId]: {
            ...currentDetail,
            exerciseName: getExerciseName(exerciseId),
            sets: nextSets,
          },
        },
        daySkipped: false,
      });
    });
  };

  const addExerciseSet = (exerciseId: string) => {
    onUpdate((current) => {
      const currentDetail = current.details[exerciseId] ?? createEmptyExerciseDetail();
      const previousSet = currentDetail.sets[currentDetail.sets.length - 1];
      const nextSet = {
        ...createEmptyExerciseSet(createSetId()),
        weightMode: previousSet?.weightMode ?? 'bodyweight',
        pounds: previousSet?.weightMode === 'pounds' ? previousSet.pounds : '',
      };

      return touchLog({
        ...current,
        details: {
          ...current.details,
          [exerciseId]: {
            ...currentDetail,
            exerciseName: getExerciseName(exerciseId),
            sets: [...currentDetail.sets, nextSet],
          },
        },
        daySkipped: false,
      });
    });
  };

  const removeExerciseSet = (exerciseId: string, setId: string) => {
    onUpdate((current) => {
      const currentDetail = current.details[exerciseId] ?? createEmptyExerciseDetail();
      if (currentDetail.sets.length <= 1) {
        return current;
      }

      return touchLog({
        ...current,
        details: {
          ...current.details,
          [exerciseId]: {
            ...currentDetail,
            exerciseName: getExerciseName(exerciseId),
            sets: currentDetail.sets.filter((set) => set.id !== setId),
          },
        },
        daySkipped: false,
      });
    });
  };

  const reorderGroups = (nextGroups: ExerciseGroup[]) => {
    onReorder(nextGroups.flatMap((group) => group.exercises.map((exercise) => exercise.id)));
  };

  const moveGroup = (groupId: string, direction: -1 | 1) => {
    const currentIndex = groups.findIndex((group) => group.id === groupId);
    const nextIndex = currentIndex + direction;
    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= groups.length) {
      return;
    }

    const nextGroups = [...groups];
    [nextGroups[currentIndex], nextGroups[nextIndex]] = [nextGroups[nextIndex], nextGroups[currentIndex]];
    reorderGroups(nextGroups);
  };

  const handleDragStart = (event: DragEvent<HTMLButtonElement>, groupId: string) => {
    setDraggedGroupId(groupId);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', groupId);
  };

  const handleDragOver = (event: DragEvent<HTMLElement>, targetGroupId: string) => {
    const sourceGroupId = draggedGroupId || event.dataTransfer.getData('text/plain');
    if (!sourceGroupId || sourceGroupId === targetGroupId) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    setDragOverGroupId(targetGroupId);
  };

  const handleDrop = (event: DragEvent<HTMLElement>, targetGroupId: string) => {
    event.preventDefault();
    const sourceGroupId = draggedGroupId || event.dataTransfer.getData('text/plain');
    setDraggedGroupId(null);
    setDragOverGroupId(null);

    if (!sourceGroupId || sourceGroupId === targetGroupId) {
      return;
    }

    const sourceIndex = groups.findIndex((group) => group.id === sourceGroupId);
    const targetIndex = groups.findIndex((group) => group.id === targetGroupId);
    if (sourceIndex < 0 || targetIndex < 0) {
      return;
    }

    const nextGroups = [...groups];
    const [movedGroup] = nextGroups.splice(sourceIndex, 1);
    nextGroups.splice(targetIndex, 0, movedGroup);
    reorderGroups(nextGroups);
  };

  const addSuperset = () => {
    if (!canAddSuperset) {
      return;
    }

    onUpdate((current) =>
      touchLog({
        ...current,
        supersets: [
          ...current.supersets,
          {
            id: `${firstSupersetId}-${secondSupersetId}-${Date.now()}`,
            exerciseIds: [firstSupersetId, secondSupersetId],
          },
        ],
        daySkipped: false,
      }),
    );
  };

  const removeSuperset = (supersetId: string) => {
    onUpdate((current) =>
      touchLog({
        ...current,
        supersets: current.supersets.filter((superset) => superset.id !== supersetId),
      }),
    );
  };

  const startSession = () => {
    if (exercises.length === 0) {
      return;
    }

    const startedAt = new Date().toISOString();
    onUpdate((current) => {
      const details = { ...current.details };

      exercises.forEach((exercise) => {
        if (!isExerciseDetailEmpty(details[exercise.id])) {
          return;
        }

        const targetSets = Math.max(1, exercise.target.sets ?? 1);
        details[exercise.id] = {
          ...createEmptyExerciseDetail(),
          exerciseName: exercise.name,
          sets: Array.from({ length: targetSets }, (_, index) => createEmptyExerciseSet(`set-${index + 1}`)),
        };
      });

      return touchLog({
        ...current,
        startedAt: current.startedAt ?? startedAt,
        finishedAt: undefined,
        exerciseSnapshot: current.exerciseSnapshot ?? cloneExercises(exercises),
        details,
        skipped: current.daySkipped ? [] : current.skipped,
        daySkipped: false,
      });
    });
  };

  const finishSession = () => {
    if (!hasSessionWork) {
      return;
    }

    const finishedAt = new Date().toISOString();
    onUpdate((current) =>
      touchLog({
        ...current,
        startedAt: current.startedAt ?? finishedAt,
        finishedAt,
        exerciseSnapshot: current.exerciseSnapshot ?? cloneExercises(exercises),
        daySkipped: false,
      }),
    );
    setRestTimer({ dateKey, remainingSeconds: restSeconds });
  };

  const reopenSession = () => {
    const reopenedAt = Date.now();
    onUpdate((current) => {
      const previousStart = current.startedAt ? Date.parse(current.startedAt) : NaN;
      const previousFinish = current.finishedAt ? Date.parse(current.finishedAt) : NaN;
      const elapsedBeforeClose = Number.isFinite(previousStart) && Number.isFinite(previousFinish)
        ? Math.max(0, previousFinish - previousStart)
        : 0;

      return touchLog({
        ...current,
        startedAt: new Date(reopenedAt - elapsedBeforeClose).toISOString(),
        finishedAt: undefined,
        daySkipped: false,
      });
    });
  };

  const usePreviousWorkout = () => {
    onUpdate((current) => {
      const details = { ...current.details };

      exercises.forEach((exercise) => {
        const previous = previousByExerciseId.get(exercise.id);
        if (!previous || !isExerciseDetailEmpty(details[exercise.id])) {
          return;
        }

        details[exercise.id] = {
          ...previous.detail,
          exerciseName: exercise.name,
          sets: previous.detail.sets.map((set) => ({ ...set, id: createSetId() })),
        };
      });

      return touchLog({ ...current, details, daySkipped: false });
    });
  };

  const setRestPreset = (seconds: number) => {
    setRestTimer({
      dateKey,
      remainingSeconds: seconds,
      ...(seconds > 0 ? { endsAt: Date.now() + seconds * 1000 } : {}),
    });
  };

  const completeAll = () => {
    if (exercises.length === 0) {
      return;
    }

    const completedAt = new Date().toISOString();
    setCollapsedExerciseIds(exercises.map((exercise) => exercise.id));
    onUpdate((current) =>
      touchLog({
        ...current,
        completed: exercises.map((exercise) => exercise.id),
        skipped: [],
        startedAt: current.startedAt ?? completedAt,
        finishedAt: current.finishedAt ?? completedAt,
        exerciseSnapshot: current.exerciseSnapshot ?? cloneExercises(exercises),
        daySkipped: false,
      }),
    );
    setRestTimer({ dateKey, remainingSeconds: restSeconds });
  };

  const skipDay = () => {
    onUpdate((current) =>
      touchLog({
        ...current,
        completed: [],
        skipped: exercises.map((exercise) => exercise.id),
        daySkipped: true,
        startedAt: undefined,
        finishedAt: undefined,
      }),
    );
    setRestTimer({ dateKey, remainingSeconds: 0 });
  };

  return (
    <section
      className={`workout-stage ${reorderMode ? 'reorder-mode' : ''}`}
      aria-label={`${formatDateLabel(dateKey)} workout`}
    >
      <div className="workout-banner">
        <div>
          <p className="eyebrow">{formatDateLabel(dateKey)}</p>
          <h2>{progress.completed}/{progress.total} logged</h2>
          <div className="banner-chips">
            <StatusPill status={status} />
            <span className="session-chip">
              {sessionFinished
                ? 'Session finished'
                : sessionActive
                  ? 'Session live'
                  : sessionLogged
                    ? 'Workout logged'
                    : 'Ready to start'}
            </span>
            {log.startedAt && <span className="elapsed-chip">{formatDuration(sessionDurationSeconds)} elapsed</span>}
            <span className="desktop-session-chip">{activeSupersets.length} supersets</span>
            <span className="desktop-session-chip">{supersetExerciseCount} paired</span>
            <span className="sets-chip">{loggedSets} sets</span>
            <span className="desktop-session-chip">{sessionVolume.toLocaleString()} lb</span>
            {restSeconds > 0 && (
              <span className="rest-chip">
                Rest {Math.floor(restSeconds / 60)}:{String(restSeconds % 60).padStart(2, '0')}
              </span>
            )}
          </div>
        </div>
        <div className="progress-orb" style={{ '--progress': `${progress.percent}%` } as CSSProperties}>
          <strong>{progress.percent}%</strong>
          <span>{progress.skipped} skipped</span>
        </div>
      </div>

      <div className="session-toolbar">
        <div className="session-actions">
          {!log.startedAt && !log.finishedAt && !sessionLogged && (
            <button
              className="icon-text-button primary session-primary-action"
              type="button"
              onClick={startSession}
              disabled={exercises.length === 0}
            >
              <Play aria-hidden="true" />
              <span>Start workout</span>
            </button>
          )}
          {sessionActive && (
            <button
              className="icon-text-button primary session-primary-action"
              type="button"
              onClick={finishSession}
              disabled={!hasSessionWork}
              title={!hasSessionWork ? 'Log at least one exercise before finishing' : undefined}
            >
              <Square aria-hidden="true" />
              <span>Finish session</span>
            </button>
          )}
          {sessionFinished && (
            <button className="icon-text-button session-primary-action" type="button" onClick={reopenSession}>
              <Play aria-hidden="true" />
              <span>Reopen session</span>
            </button>
          )}
          <button className="icon-text-button" type="button" onClick={completeAll} disabled={exercises.length === 0}>
            <Check aria-hidden="true" />
            <span>Complete all</span>
          </button>
          <button className="icon-text-button" type="button" onClick={usePreviousWorkout} disabled={!hasPreviousWorkout}>
            <RotateCcw aria-hidden="true" />
            <span>Load last workout</span>
          </button>
          <button className="icon-text-button" type="button" onClick={skipDay}>
            <Ban aria-hidden="true" />
            <span>Skip day</span>
          </button>
          <button
            className="icon-only-button"
            type="button"
            onClick={onClear}
            aria-label="Clear day"
            disabled={!hasSavedLog}
          >
            <X aria-hidden="true" />
          </button>
        </div>

        <div className={`rest-control ${restSeconds > 0 ? 'active' : ''}`}>
          <div className="rest-readout">
            <Clock3 aria-hidden="true" />
            <span>Rest</span>
            <strong>{formatDuration(restSeconds)}</strong>
          </div>
          <div className="rest-presets" aria-label="Rest timer presets">
            {[60, 90, 120].map((seconds) => (
              <button key={seconds} type="button" onClick={() => setRestPreset(seconds)}>
                {seconds}s
              </button>
            ))}
          </div>
          <button
            className="icon-only-button small"
            type="button"
            onClick={() => {
              if (restRunning) {
                setRestTimer({ dateKey, remainingSeconds: restSeconds });
              } else {
                setRestPreset(restSeconds || preferences.defaultRestSeconds);
              }
            }}
            aria-label={restRunning ? 'Pause rest timer' : 'Start rest timer'}
          >
            {restRunning ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
          </button>
          <button
            className="icon-only-button small"
            type="button"
            onClick={() => {
              setRestTimer({ dateKey, remainingSeconds: 0 });
            }}
            aria-label="Reset rest timer"
          >
            <Square aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className={`mobile-workout-tools ${mobileToolsOpen ? 'open' : ''}`}>
        <button
          className="mobile-panel-toggle"
          type="button"
          aria-expanded={mobileToolsOpen}
          onClick={() => setMobileToolsOpen((current) => !current)}
        >
          <Settings aria-hidden="true" />
          <span>Workout tools</span>
          <ChevronDown aria-hidden="true" />
        </button>
        <div className="mobile-workout-tools-body">
          <div className="mobile-tool-actions">
            <button className="icon-text-button" type="button" onClick={completeAll} disabled={exercises.length === 0}>
              <Check aria-hidden="true" />
              <span>Complete all</span>
            </button>
            <button className="icon-text-button" type="button" onClick={usePreviousWorkout} disabled={!hasPreviousWorkout}>
              <RotateCcw aria-hidden="true" />
              <span>Load last</span>
            </button>
            <button
              className={`icon-text-button ${reorderMode ? 'active' : ''}`}
              type="button"
              aria-pressed={reorderMode}
              onClick={() => setReorderMode((current) => !current)}
            >
              <GripVertical aria-hidden="true" />
              <span>Reorder</span>
            </button>
            <button className="icon-text-button" type="button" onClick={skipDay}>
              <Ban aria-hidden="true" />
              <span>Skip day</span>
            </button>
            <button className="icon-text-button danger" type="button" onClick={onClear} disabled={!hasSavedLog}>
              <X aria-hidden="true" />
              <span>Clear log</span>
            </button>
          </div>

        </div>
      </div>

      <section className={`superset-builder ${supersetToolsOpen ? 'open' : ''}`} aria-label="Create a superset">
        <button
          className="mobile-superset-toggle"
          type="button"
          aria-expanded={supersetToolsOpen}
          onClick={() => setSupersetToolsOpen((current) => !current)}
        >
          <Link2 aria-hidden="true" />
          <span>Supersets · {activeSupersets.length} {activeSupersets.length === 1 ? 'pair' : 'pairs'}</span>
          <ChevronDown aria-hidden="true" />
        </button>
        <div className="superset-builder-body">
          <div className="superset-builder-heading">
            <div className="section-title">
              <Link2 aria-hidden="true" />
              <h3>Supersets</h3>
            </div>
            <span>{activeSupersets.length} paired</span>
          </div>
          <p>Pair two exercises for this workout. The pair stays attached to this date.</p>
          <div className="superset-controls">
            <select
              value={firstSupersetId}
              aria-label="First exercise in superset"
              onChange={(event) => {
                const nextFirstId = event.target.value;
                setFirstSupersetId(nextFirstId);
                if (secondSupersetId === nextFirstId) {
                  setSecondSupersetId(unpairedExercises.find((exercise) => exercise.id !== nextFirstId)?.id ?? '');
                }
              }}
              disabled={unpairedExercises.length < 2}
            >
              {unpairedExercises.map((exercise) => (
                <option key={exercise.id} value={exercise.id}>
                  {exercise.name}
                </option>
              ))}
            </select>
            <select
              value={secondSupersetId}
              aria-label="Second exercise in superset"
              onChange={(event) => setSecondSupersetId(event.target.value)}
              disabled={unpairedExercises.length < 2}
            >
              {unpairedExercises
                .filter((exercise) => exercise.id !== firstSupersetId)
                .map((exercise) => (
                  <option key={exercise.id} value={exercise.id}>
                    {exercise.name}
                  </option>
                ))}
            </select>
            <button className="icon-text-button compact" type="button" onClick={addSuperset} disabled={!canAddSuperset}>
              <Plus aria-hidden="true" />
              <span>Add pair</span>
            </button>
          </div>
        </div>
      </section>

      <div className="exercise-stack">
        {groups.map((group, groupIndex) => {
          const groupLabel =
            group.type === 'superset'
              ? `superset with ${group.exercises.map((exercise) => exercise.name).join(' and ')}`
              : group.exercises[0]?.name ?? 'exercise';
          const workoutBlock = group.exercises[0]?.workoutBlock ?? 1;
          const previousWorkoutBlock = groups[groupIndex - 1]?.exercises[0]?.workoutBlock ?? 1;
          const groupFinished = group.exercises.every((exercise) => (
            log.completed.includes(exercise.id) || log.skipped.includes(exercise.id)
          ));
          const previousGroup = groups[groupIndex - 1];
          const previousGroupFinished = previousGroup?.exercises.every((exercise) => (
            log.completed.includes(exercise.id) || log.skipped.includes(exercise.id)
          )) ?? false;
          const startsFinishedSection = groupFinished && !previousGroupFinished;
          const startsWorkoutBlock = !groupFinished && (
            groupIndex === 0 || previousGroupFinished || workoutBlock !== previousWorkoutBlock
          );
          const workoutLabel = group.exercises[0]?.workoutLabel;

          return (
            <Fragment key={group.id}>
              {startsFinishedSection && (
                <div className="workout-block-heading completed-block">
                  <span>Finished items</span>
                  <strong>Completed</strong>
                </div>
              )}
              {startsWorkoutBlock && workoutLabel && (
                <div className="workout-block-heading">
                  <span>{workoutBlock === 1 ? 'Start here' : 'Then'}</span>
                  <strong>{workoutLabel}</strong>
                </div>
              )}
              <article
                className={`exercise-group ${group.type} ${draggedGroupId === group.id ? 'dragging' : ''} ${
                  dragOverGroupId === group.id ? 'drop-target' : ''
                }`}
                onDragOver={(event) => handleDragOver(event, group.id)}
                onDrop={(event) => handleDrop(event, group.id)}
              >
              {group.type === 'superset' && (
                <div className="group-header">
                  <span>
                    <Link2 aria-hidden="true" />
                    Superset
                  </span>
                  <button
                    className="icon-only-button small"
                    type="button"
                    aria-label="Remove superset"
                    onClick={() => group.supersetId && removeSuperset(group.supersetId)}
                  >
                    <X aria-hidden="true" />
                  </button>
                </div>
              )}

              <div className="exercise-group-body">
                <div className="group-move-controls">
                  <button
                    className="drag-button"
                    type="button"
                    draggable
                    aria-label={`Drag ${groupLabel} to reorder`}
                    onDragStart={(event) => handleDragStart(event, group.id)}
                    onDragEnd={() => {
                      setDraggedGroupId(null);
                      setDragOverGroupId(null);
                    }}
                  >
                    <GripVertical aria-hidden="true" />
                  </button>
                  <div className="move-pair">
                    <button
                      className="move-mini-button"
                      type="button"
                      aria-label={`Move ${groupLabel} up`}
                      onClick={() => moveGroup(group.id, -1)}
                      disabled={groupIndex === 0}
                    >
                      <ArrowUp aria-hidden="true" />
                    </button>
                    <button
                      className="move-mini-button"
                      type="button"
                      aria-label={`Move ${groupLabel} down`}
                      onClick={() => moveGroup(group.id, 1)}
                      disabled={groupIndex === groups.length - 1}
                    >
                      <ArrowDown aria-hidden="true" />
                    </button>
                  </div>
                </div>

                <div className="group-exercise-list">
                  {group.exercises.map((exercise) => {
                    const completed = log.completed.includes(exercise.id);
                    const skipped = log.skipped.includes(exercise.id);
                    const collapsed = collapsedExerciseIds.includes(exercise.id);
                    const detail = log.details[exercise.id] ?? createEmptyExerciseDetail();
                    const exerciseKind = getExerciseKind(exercise);
                    const isStretch = exerciseKind === 'mobility';
                    const previous = previousByExerciseId.get(exercise.id);
                    const lastSummary = previous
                      ? formatSetSummary(previous.detail.sets, isStretch ? 'stretch' : 'strength')
                      : '';
                    const currentSummary = formatSetSummary(detail.sets, isStretch ? 'stretch' : 'strength');
                    const previousBest = previousBestByExerciseId.get(exercise.id) ?? 0;
                    const currentBest = Math.max(0, ...detail.sets.map(getSetVolume));
                    const hasLocalPr = exerciseKind === 'strength' && currentBest > 0 && currentBest > previousBest;
                    const canUseLastSets = Boolean(previous && isExerciseDetailEmpty(detail));

                    return (
                      <div
                        key={exercise.id}
                        className={`exercise-row ${completed ? 'done' : ''} ${skipped ? 'skipped' : ''} ${
                          collapsed ? 'collapsed' : ''
                        }`}
                      >
                        <button
                          className="check-button"
                          type="button"
                          aria-label={`${completed ? 'Mark incomplete' : 'Mark complete'}: ${exercise.name}`}
                          aria-pressed={completed}
                          onClick={() => toggleComplete(exercise.id)}
                        >
                          {completed ? <Check aria-hidden="true" /> : <Circle aria-hidden="true" />}
                        </button>
                        <div className="exercise-copy">
                          {editingExerciseId === exercise.id ? (
                            <div className="exercise-name-editor">
                              <label>
                                <span>Exercise name</span>
                                <input
                                  value={exerciseNameDraft}
                                  autoFocus
                                  maxLength={80}
                                  onChange={(event) => setExerciseNameDraft(event.target.value)}
                                  onKeyDown={(event) => {
                                    if (event.key === 'Escape') {
                                      setEditingExerciseId(null);
                                      setExerciseNameDraft('');
                                    }
                                  }}
                                />
                              </label>
                              <div className="exercise-name-actions">
                                <button
                                  className="icon-text-button primary compact"
                                  type="button"
                                  disabled={!exerciseNameDraft.trim()}
                                  onClick={() => saveExerciseName(exercise.id, 'date')}
                                >
                                  <Check aria-hidden="true" />
                                  <span>This day</span>
                                </button>
                                {canRenameTemplate(exercise.id) && (
                                  <button
                                    className="icon-text-button compact"
                                    type="button"
                                    disabled={!exerciseNameDraft.trim()}
                                    onClick={() => saveExerciseName(exercise.id, 'template')}
                                  >
                                    <CalendarDays aria-hidden="true" />
                                    <span>This + future {getWeekday(parseDateKey(dateKey))}s</span>
                                  </button>
                                )}
                                <button
                                  className="icon-only-button small"
                                  type="button"
                                  aria-label="Cancel rename"
                                  onClick={() => {
                                    setEditingExerciseId(null);
                                    setExerciseNameDraft('');
                                  }}
                                >
                                  <X aria-hidden="true" />
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="exercise-title-row">
                              <div>
                                <span className="exercise-name-line">
                                  <strong>{exercise.name}</strong>
                                  <button
                                    className="rename-exercise-button"
                                    type="button"
                                    aria-label={`Rename ${exercise.name}`}
                                    onClick={() => beginRenameExercise(exercise)}
                                  >
                                    <Pencil aria-hidden="true" />
                                  </button>
                                  <button
                                    className="exercise-collapse-button"
                                    type="button"
                                    aria-label={`${collapsed ? 'Expand' : 'Minimize'} ${exercise.name}`}
                                    aria-expanded={!collapsed}
                                    onClick={() =>
                                      setCollapsedExerciseIds((current) =>
                                        collapsed
                                          ? current.filter((id) => id !== exercise.id)
                                          : uniqueList([...current, exercise.id]),
                                      )
                                    }
                                  >
                                    {collapsed ? <ChevronRight aria-hidden="true" /> : <ChevronDown aria-hidden="true" />}
                                    <span>{collapsed ? 'Expand' : 'Minimize'}</span>
                                  </button>
                                </span>
                                {!collapsed && (
                                  <>
                                    <span className="target-summary">
                                      <Gauge aria-hidden="true" />
                                      {getExerciseTargetSummary(exercise)}
                                    </span>
                                    {lastSummary && <small>Last time: {lastSummary}</small>}
                                  </>
                                )}
                              </div>
                              {!collapsed && hasLocalPr && (
                                <span className="pr-chip" title="Best single-set load × reps">
                                  Set PR
                                </span>
                              )}
                            </div>
                          )}
                          {!collapsed && (
                            <>
                              {canUseLastSets && (
                                <button className="last-sets-button" type="button" onClick={() => useLastSets(exercise.id)}>
                                  <RotateCcw aria-hidden="true" />
                                  <span>Use last sets</span>
                                </button>
                              )}
                              {currentSummary && <div className="current-set-summary">{currentSummary}</div>}
                              <div className="set-stack">
                                  {detail.sets.map((set, setIndex) => (
                                    <div
                                      key={set.id}
                                      className={`set-row ${isStretch ? 'stretch-row' : ''} ${set.weightMode === 'pounds' ? 'with-pounds' : ''} ${
                                        detail.sets.length > 1 ? 'can-remove' : ''
                                      }`}
                                    >
                                      <span className="set-index">{isStretch ? `Round ${setIndex + 1}` : `Set ${setIndex + 1}`}</span>
                                      {!isStretch && (
                                        <label>
                                          <span>Weight</span>
                                          <select
                                            value={set.weightMode}
                                            onChange={(event) =>
                                              updateExerciseSet(exercise.id, set.id, {
                                                weightMode: event.target.value as WeightMode,
                                              })
                                            }
                                          >
                                            <option value="bodyweight">Body weight</option>
                                            <option value="pounds">Pounds</option>
                                          </select>
                                        </label>
                                      )}
                                      {!isStretch && set.weightMode === 'pounds' && (
                                        <label>
                                          <span>Pounds</span>
                                          <input
                                            type="number"
                                            min="0"
                                            step="0.5"
                                            inputMode="decimal"
                                            value={set.pounds}
                                            onChange={(event) => updateExerciseSet(exercise.id, set.id, { pounds: event.target.value })}
                                          />
                                        </label>
                                      )}
                                      <label>
                                        <span>{isStretch ? 'Reps / Hold' : 'Reps'}</span>
                                        <input
                                          type="number"
                                          min="0"
                                          max="1000"
                                          step="1"
                                          inputMode="numeric"
                                          value={set.reps}
                                          onChange={(event) => updateExerciseSet(exercise.id, set.id, { reps: event.target.value })}
                                        />
                                      </label>
                                      {detail.sets.length > 1 && (
                                        <button
                                          className="set-remove-button"
                                          type="button"
                                          aria-label={`Remove set ${setIndex + 1} from ${exercise.name}`}
                                          onClick={() => removeExerciseSet(exercise.id, set.id)}
                                        >
                                          <X aria-hidden="true" />
                                        </button>
                                      )}
                                    </div>
                                  ))}
                                  <button
                                    className="icon-text-button compact set-add-button"
                                    type="button"
                                    onClick={() => addExerciseSet(exercise.id)}
                                  >
                                    <Plus aria-hidden="true" />
                                    <span>{isStretch ? 'Add Round' : 'Add Set'}</span>
                                  </button>
                                </div>
                              {detail.legacyNote && <small className="legacy-detail">Previous detail: {detail.legacyNote}</small>}
                            </>
                          )}
                        </div>
                        <button
                          className={`skip-button ${skipped ? 'active' : ''}`}
                          type="button"
                          aria-label={`${skipped ? 'Unskip' : 'Skip'}: ${exercise.name}`}
                          aria-pressed={skipped}
                          onClick={() => toggleSkip(exercise.id)}
                        >
                          <Ban aria-hidden="true" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
              </article>
            </Fragment>
          );
        })}
      </div>

      <div className={`session-notes-panel ${notesOpen ? 'open' : ''}`}>
        <button
          className="mobile-panel-toggle"
          type="button"
          aria-expanded={notesOpen}
          onClick={() => setNotesOpen((current) => !current)}
        >
          <BookOpen aria-hidden="true" />
          <span>Session notes</span>
          <ChevronDown aria-hidden="true" />
        </button>
        <div className="notes-grid">
          <label>
            <span>Notes</span>
            <textarea
              value={log.notes}
              onChange={(event) =>
                onUpdate((current) =>
                  touchLog({
                    ...current,
                    notes: event.target.value,
                    daySkipped: false,
                  }),
                )
              }
            />
          </label>
          <label>
            <span>PR Notes</span>
            <textarea
              value={log.prNote}
              onChange={(event) =>
                onUpdate((current) =>
                  touchLog({
                    ...current,
                    prNote: event.target.value,
                    daySkipped: false,
                  }),
                )
              }
            />
          </label>
        </div>
      </div>
      <div className="session-finish-bar">
        <div>
          <strong>{progress.completed}/{progress.total}</strong>
          <span>
            {loggedSets} sets · {sessionVolume.toLocaleString()} lb
            {log.startedAt ? ` · ${formatDuration(sessionDurationSeconds)}` : ''}
          </span>
        </div>
        {!log.startedAt && !log.finishedAt && !sessionLogged && (
          <button
            className="icon-text-button primary"
            type="button"
            onClick={startSession}
            disabled={exercises.length === 0}
          >
            <Play aria-hidden="true" />
            <span>Start</span>
          </button>
        )}
        {sessionActive && (
          <button
            className="icon-text-button primary"
            type="button"
            onClick={finishSession}
            disabled={!hasSessionWork}
            title={!hasSessionWork ? 'Log at least one exercise before finishing' : undefined}
          >
            <Square aria-hidden="true" />
            <span>Finish</span>
          </button>
        )}
        {sessionFinished && (
          <button className="icon-text-button" type="button" onClick={reopenSession}>
            <Play aria-hidden="true" />
            <span>Reopen</span>
          </button>
        )}
      </div>
    </section>
  );
}
function WeekView({
  logs,
  todayKey,
  selectedDate,
  getExercises,
  setSelectedDate,
  openLogbook,
}: {
  logs: LogsByDate;
  todayKey: string;
  selectedDate: string;
  getExercises: GetExercisesForDate;
  setSelectedDate: (dateKey: string) => void;
  openLogbook: (dateKey: string) => void;
}) {
  const weekStart = startOfWeek(parseDateKey(selectedDate));
  const days = WEEK_DAYS.map((day, index) => {
    const date = addDays(weekStart, index);
    const dateKey = toDateKey(date);
    const log = normalizeLog(dateKey, logs[dateKey]);
    const exercises = getExercises(dateKey);
    const progress = getProgressMeta(exercises, log);
    const status = getDayStatus(dateKey, log, todayKey, exercises);
    return { day, dateKey, exercises, progress, status };
  });

  return (
    <div className="view-stack">
      <section className="topline">
        <div>
          <p className="eyebrow">Week</p>
          <h1>
            {formatShortDate(days[0].dateKey)} - {formatShortDate(days[6].dateKey)}
          </h1>
        </div>
        <div className="date-pager">
          <button
            className="icon-only-button"
            type="button"
            aria-label="Previous week"
            onClick={() => setSelectedDate(toDateKey(addDays(weekStart, -7)))}
          >
            <ChevronLeft aria-hidden="true" />
          </button>
          <button className="icon-text-button" type="button" onClick={() => openLogbook(todayKey)}>
            <Target aria-hidden="true" />
            <span>Today</span>
          </button>
          <button
            className="icon-only-button"
            type="button"
            aria-label="Next week"
            onClick={() => setSelectedDate(toDateKey(addDays(weekStart, 7)))}
          >
            <ChevronRight aria-hidden="true" />
          </button>
        </div>
      </section>

      <div className="week-grid">
        {days.map(({ day, dateKey, exercises, progress, status }) => (
          <article key={dateKey} className={`week-day ${status}`}>
            <div className="week-day-head">
              <div>
                <span>{day}</span>
                <strong>{formatShortDate(dateKey)}</strong>
              </div>
              <StatusPill status={status} />
            </div>
            <div className="thin-progress">
              <span style={{ width: `${progress.percent}%` }} />
            </div>
            <p>
              {progress.completed}/{progress.total} complete
            </p>
            <ul>
              {exercises.map((exercise) => (
                <li key={exercise.id}>{exercise.name}</li>
              ))}
            </ul>
            <button className="icon-text-button compact" type="button" onClick={() => openLogbook(dateKey)}>
              <ClipboardList aria-hidden="true" />
              <span>Open</span>
            </button>
          </article>
        ))}
      </div>
    </div>
  );
}

function CalendarView({
  logs,
  todayKey,
  selectedDate,
  getExercises,
  setSelectedDate,
  openLogbook,
}: {
  logs: LogsByDate;
  todayKey: string;
  selectedDate: string;
  getExercises: GetExercisesForDate;
  setSelectedDate: (dateKey: string) => void;
  openLogbook: (dateKey: string) => void;
}) {
  const monthDate = parseDateKey(selectedDate);
  const monthStart = startOfMonth(monthDate);
  const monthEnd = endOfMonth(monthDate);
  const gridStart = startOfWeek(monthStart);
  const cells = Array.from({ length: 42 }, (_, index) => {
    const date = addDays(gridStart, index);
    const dateKey = toDateKey(date);
    const log = normalizeLog(dateKey, logs[dateKey]);
    const exercises = getExercises(dateKey);
    return {
      date,
      dateKey,
      inMonth: date >= monthStart && date <= monthEnd,
      status: getDayStatus(dateKey, log, todayKey, exercises),
      progress: getProgressMeta(exercises, log),
    };
  });

  return (
    <div className="view-stack">
      <section className="topline">
        <div>
          <p className="eyebrow">Calendar</p>
          <h1>{formatMonth(monthDate)}</h1>
        </div>
        <div className="date-pager">
          <button
            className="icon-only-button"
            type="button"
            aria-label="Previous month"
            onClick={() => setSelectedDate(toDateKey(new Date(monthDate.getFullYear(), monthDate.getMonth() - 1, 1)))}
          >
            <ChevronLeft aria-hidden="true" />
          </button>
          <button className="icon-text-button" type="button" onClick={() => openLogbook(todayKey)}>
            <Target aria-hidden="true" />
            <span>Today</span>
          </button>
          <button
            className="icon-only-button"
            type="button"
            aria-label="Next month"
            onClick={() => setSelectedDate(toDateKey(new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 1)))}
          >
            <ChevronRight aria-hidden="true" />
          </button>
        </div>
      </section>

      <div className="calendar-shell">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
          <span key={day} className="calendar-label">
            {day}
          </span>
        ))}
        {cells.map(({ date, dateKey, inMonth, status, progress }) => (
          <button
            key={dateKey}
            type="button"
            className={`calendar-cell ${status} ${inMonth ? '' : 'muted'} ${dateKey === todayKey ? 'today' : ''}`}
            aria-label={`${formatDateLabel(dateKey)}, ${STATUS_LABELS[status]}, ${progress.completed} of ${progress.total} complete`}
            onClick={() => openLogbook(dateKey)}
          >
            <span>{date.getDate()}</span>
            <i />
            <small>
              {progress.completed}/{progress.total}
            </small>
          </button>
        ))}
      </div>

      <div className="legend-row">
        {(Object.keys(STATUS_LABELS) as DayStatus[]).map((status) => (
          <span key={status} className={`legend-item ${status}`}>
            <i />
            {STATUS_LABELS[status]}
          </span>
        ))}
      </div>
    </div>
  );
}

function buildRecentDates(todayKey: string, days: number): string[] {
  const today = parseDateKey(todayKey);
  return Array.from({ length: days }, (_, index) => toDateKey(addDays(today, -index)));
}

function MilestonesView({
  logs,
  preferences,
  todayKey,
  getExercises,
}: {
  logs: LogsByDate;
  preferences: Preferences;
  todayKey: string;
  getExercises: GetExercisesForDate;
}) {
  const stats = buildTrainingStats(logs, todayKey, getExercises);
  const maxVolume = Math.max(1, ...stats.weeklyTrend.map((entry) => entry.volume));

  return (
    <div className="view-stack">
      <section className="topline">
        <div>
          <p className="eyebrow">Progress</p>
          <h1>Training signal</h1>
        </div>
      </section>

      <div className="metrics-grid">
        <MetricTile icon={Flame} label="Current streak" value={`${stats.streak} days`} accent="var(--coral)" />
        <MetricTile
          icon={Target}
          label="This week"
          value={`${stats.weekSessions}/${preferences.weeklySessionGoal}`}
          accent="var(--violet)"
        />
        <MetricTile icon={Check} label="Completed sessions" value={`${stats.completedSessions}`} accent="var(--green)" />
        <MetricTile icon={Medal} label="Mobility days" value={`${stats.stretchDays}`} accent="var(--violet)" />
        <MetricTile icon={Activity} label="28 day volume" value={`${stats.totalVolume.toLocaleString()}`} accent="var(--coral)" />
        <MetricTile icon={Target} label="28 day reps" value={`${stats.totalReps}`} accent="var(--text-muted)" />
      </div>

      <section className="timeline-section progress-section">
        <div className="section-title">
          <Activity aria-hidden="true" />
          <h3>Weekly Load</h3>
        </div>
        <div className="progress-trend-list">
          {stats.weeklyTrend.map((entry) => (
            <article key={entry.dateKey} className="progress-trend-row">
              <span>{formatShortDate(entry.dateKey)}</span>
              <div className="thin-progress">
                <span style={{ width: `${Math.max(2, Math.round((entry.volume / maxVolume) * 100))}%` }} />
              </div>
              <strong>{entry.volume.toLocaleString()} lb</strong>
            </article>
          ))}
        </div>
      </section>

      <section className="timeline-section">
        <div className="section-title">
          <Trophy aria-hidden="true" />
          <h3>PR Notes</h3>
        </div>
        {stats.prNotes.length > 0 ? (
          <div className="pr-list">
            {stats.prNotes
              .slice(0, 8)
              .map((entry) => (
                <article key={`${entry.dateKey}-${entry.note}`} className="pr-entry">
                  <span>{formatDateLabel(entry.dateKey)}</span>
                  <p>{entry.note}</p>
                </article>
              ))}
          </div>
        ) : (
          <p className="empty-note">No PR notes yet.</p>
        )}
      </section>
    </div>
  );
}

function LogbookView({
  logs,
  preferences,
  todayKey,
  selectedDate,
  getExercises,
  setSelectedDate,
  updateExerciseOrder,
  renameExercise,
  canRenameTemplate,
  updateLog,
  clearLog,
}: {
  logs: LogsByDate;
  preferences: Preferences;
  todayKey: string;
  selectedDate: string;
  getExercises: GetExercisesForDate;
  setSelectedDate: (dateKey: string) => void;
  updateExerciseOrder: (dateKey: string, exerciseIds: string[]) => void;
  renameExercise: RenameExerciseForDate;
  canRenameTemplate: CanRenameTemplateForDate;
  updateLog: (dateKey: string, updater: (log: WorkoutLog) => WorkoutLog) => void;
  clearLog: (dateKey: string) => void;
}) {
  const recentEntries = Object.values(logs)
    .filter((log) => hasTrainingActivity(log) || hasPlanActivity(log))
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 10);

  return (
    <div className="logbook-layout">
      <div className="view-stack">
        <section className="topline">
          <div>
            <p className="eyebrow">Logbook</p>
            <h1>{formatDateLabel(selectedDate)}</h1>
          </div>
          <div className="date-pager">
            <button
              className="icon-only-button"
              type="button"
              aria-label="Previous day"
              onClick={() => setSelectedDate(toDateKey(addDays(parseDateKey(selectedDate), -1)))}
            >
              <ChevronLeft aria-hidden="true" />
            </button>
            <input
              className="date-input"
              type="date"
              value={selectedDate}
              aria-label="Workout log date"
              onChange={(event) => {
                if (/^\d{4}-\d{2}-\d{2}$/.test(event.target.value)) {
                  setSelectedDate(event.target.value);
                }
              }}
            />
            <button
              className="icon-only-button"
              type="button"
              aria-label="Next day"
              onClick={() => setSelectedDate(toDateKey(addDays(parseDateKey(selectedDate), 1)))}
            >
              <ChevronRight aria-hidden="true" />
            </button>
            <button className="icon-text-button compact" type="button" onClick={() => setSelectedDate(todayKey)}>
              <Target aria-hidden="true" />
              <span>Today</span>
            </button>
          </div>
        </section>

        <WorkoutPanel
          dateKey={selectedDate}
          exercises={getExercises(selectedDate)}
          log={normalizeLog(selectedDate, logs[selectedDate])}
          logs={logs}
          preferences={preferences}
          todayKey={todayKey}
          getExercises={getExercises}
          onReorder={(exerciseIds) => updateExerciseOrder(selectedDate, exerciseIds)}
          onRename={(exerciseId, name, scope) => renameExercise(selectedDate, exerciseId, name, scope)}
          canRenameTemplate={(exerciseId) => canRenameTemplate(selectedDate, exerciseId)}
          onUpdate={(updater) => updateLog(selectedDate, updater)}
          onClear={() => clearLog(selectedDate)}
        />
      </div>

      <aside className="recent-panel">
        <div className="section-title">
          <ClipboardList aria-hidden="true" />
          <h3>Recent</h3>
        </div>
        {recentEntries.length > 0 ? (
          recentEntries.map((entry) => {
            const exercises = getExercises(entry.date);
            const progress = getProgressMeta(exercises, entry);
            const sets = getLogSetCount(entry);
            const volume = getLogVolume(entry);
            return (
              <button key={entry.date} type="button" className="recent-entry" onClick={() => setSelectedDate(entry.date)}>
                <div>
                  <strong>{formatDateLabel(entry.date)}</strong>
                  <small>{sets} sets · {volume.toLocaleString()} lb</small>
                </div>
                <span>{progress.completed}/{progress.total}</span>
              </button>
            );
          })
        ) : (
          <p className="empty-note">No logs yet.</p>
        )}
      </aside>
    </div>
  );
}

interface SavedExerciseLibraryEntry {
  name: string;
  family: ExerciseGuideFamily;
  order?: number;
  workoutBlock?: 1 | 2;
  workoutLabel?: string;
}

function getFamilyForExerciseKind(kind: ExerciseKind): ExerciseGuideFamily {
  return kind === 'mobility' ? 'mobility' : 'strength';
}

function buildSavedExerciseLibraryEntries(
  program: ProgramByDay,
  logs: LogsByDate,
): SavedExerciseLibraryEntry[] {
  const entries: SavedExerciseLibraryEntry[] = [];
  const seen = new Set<string>();

  const addEntry = (
    name: string | undefined,
    family?: ExerciseGuideFamily,
    order?: number,
    workoutBlock?: 1 | 2,
    workoutLabel?: string,
  ) => {
    const trimmedName = name?.trim();
    if (!trimmedName) {
      return;
    }

    const normalizedName = normalizeLibraryExerciseName(trimmedName);
    if (!normalizedName || seen.has(normalizedName)) {
      return;
    }

    seen.add(normalizedName);
    entries.push({
      name: trimmedName,
      family: family ?? getExerciseGuideFamily('', trimmedName),
      ...(order ? { order } : {}),
      ...(workoutBlock ? { workoutBlock } : {}),
      ...(workoutLabel ? { workoutLabel } : {}),
    });
  };

  WEEK_DAYS.forEach((day) => {
    program[day].forEach((exercise, index) => {
      addEntry(
        exercise.name,
        getFamilyForExerciseKind(exercise.kind),
        index + 1,
        exercise.workoutBlock,
        exercise.workoutLabel,
      );
    });
  });

  Object.values(logs)
    .sort((a, b) => b.date.localeCompare(a.date))
    .forEach((log) => {
      log.exerciseSnapshot?.forEach((exercise) => {
        addEntry(exercise.name, getFamilyForExerciseKind(exercise.kind));
      });
      Object.values(log.details).forEach((detail) => addEntry(detail.exerciseName));
    });

  return entries;
}

function getGuideFamilyLabel(family: ExerciseGuideFamily): string {
  return family === 'mobility' ? 'Mobility' : 'Strength';
}

function ExerciseGuideArtwork({
  guide,
  detail = false,
  imageIndex = 0,
}: {
  guide: ExerciseGuide;
  detail?: boolean;
  imageIndex?: number;
}) {
  const source = guide.images[imageIndex];
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [source]);

  if (source && !failed) {
    return (
      <img
        className={guide.source === 'custom' ? 'custom-guide-image' : ''}
        src={source}
        alt={`${guide.name}${guide.images.length > 1 ? `, ${imageIndex === 0 ? 'start' : 'finish'} position` : ' movement sequence'}`}
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
      />
    );
  }

  const FallbackIcon = guide.family === 'strength' ? Dumbbell : ImageIcon;

  return (
    <div className={`exercise-art-fallback ${detail ? 'detail' : ''}`} aria-label="Dedicated visual guide coming soon">
      <FallbackIcon aria-hidden="true" />
      <span>Visual guide coming soon</span>
    </div>
  );
}

function ExerciseGuideCard({
  guide,
  saved,
  sourceLabel: sourceLabelOverride,
  onOpen,
}: {
  guide: ExerciseGuide;
  saved: boolean;
  sourceLabel?: string;
  onOpen: () => void;
}) {
  const sourceLabel = sourceLabelOverride
    ?? (saved ? 'Your log' : guide.source === 'custom' ? 'Gym guide' : 'Open library');

  return (
    <button className="exercise-library-card" type="button" onClick={onOpen}>
      <span className={`exercise-card-art ${guide.source}`}>
        <ExerciseGuideArtwork guide={guide} />
        <span className="exercise-source-chip">{sourceLabel}</span>
      </span>
      <span className="exercise-card-copy">
        <span className="exercise-card-kicker">
          {getGuideFamilyLabel(guide.family)}
          {guide.equipment ? ` · ${guide.equipment}` : ''}
        </span>
        <strong>{guide.name}</strong>
        <small>{getGuideMetaLabel(guide)}</small>
        <span className="exercise-card-link">
          View guide
          <ChevronRight aria-hidden="true" />
        </span>
      </span>
    </button>
  );
}

function ExerciseGuideDialog({
  guide,
  saved,
  onClose,
}: {
  guide: ExerciseGuide;
  saved: boolean;
  onClose: () => void;
}) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', closeOnEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [onClose]);

  const sourceLabel = saved
    ? 'Saved in your Gym'
    : guide.source === 'custom'
      ? 'Gym mobility guide'
      : 'Free Exercise DB';

  return (
    <div
      className="exercise-guide-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <section
        className="exercise-guide-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="exercise-guide-title"
      >
        <header className="exercise-guide-head">
          <div>
            <span>{sourceLabel}</span>
            <h2 id="exercise-guide-title">{guide.name}</h2>
            {guide.libraryName && <p>Visual reference: {guide.libraryName}</p>}
          </div>
          <button className="icon-only-button" type="button" aria-label="Close exercise guide" onClick={onClose}>
            <X aria-hidden="true" />
          </button>
        </header>

        <div className={`exercise-guide-images ${guide.images.length === 1 ? 'single' : ''}`}>
          {(guide.images.length > 0 ? guide.images.slice(0, 2) : ['']).map((_, index) => (
            <figure key={`${guide.id}-image-${index}`}>
              <ExerciseGuideArtwork guide={guide} detail imageIndex={index} />
              <figcaption>
                {guide.images.length === 1 ? 'Movement sequence' : index === 0 ? 'Start' : 'Finish'}
              </figcaption>
            </figure>
          ))}
        </div>

        <div className="exercise-guide-content">
          <div className="exercise-guide-meta">
            <span>{getGuideFamilyLabel(guide.family)}</span>
            {guide.level && <span>{guide.level}</span>}
            {guide.equipment && <span>{guide.equipment}</span>}
          </div>

          {(guide.primaryMuscles.length > 0 || guide.secondaryMuscles.length > 0) && (
            <section className="exercise-guide-section">
              <h3>Muscles</h3>
              <div className="exercise-muscle-list">
                {guide.primaryMuscles.map((muscle) => (
                  <span key={`primary-${muscle}`} className="primary">
                    {muscle}
                  </span>
                ))}
                {guide.secondaryMuscles.map((muscle) => (
                  <span key={`secondary-${muscle}`}>{muscle}</span>
                ))}
              </div>
            </section>
          )}

          <section className="exercise-guide-section">
            <h3>How to do it</h3>
            {guide.instructions.length > 0 ? (
              <ol className="exercise-instruction-list">
                {guide.instructions.map((instruction, index) => (
                  <li key={`${guide.id}-instruction-${index}`}>{instruction}</li>
                ))}
              </ol>
            ) : (
              <div className="exercise-guide-pending">
                <ImageIcon aria-hidden="true" />
                <p>
                  This workout is saved from your log, but it does not have a dedicated form guide yet.
                  It stays searchable while we expand the visual library.
                </p>
              </div>
            )}
          </section>

          {guide.source === 'library' && (
            <a
              className="exercise-library-credit"
              href={FREE_EXERCISE_DB_PROJECT_URL}
              target="_blank"
              rel="noreferrer"
            >
              Public-domain instructions and imagery from Free Exercise DB
              <ExternalLink aria-hidden="true" />
            </a>
          )}
        </div>
      </section>
    </div>
  );
}

function SearchView({
  program,
  logs,
  todayKey,
}: {
  program: ProgramByDay;
  logs: LogsByDate;
  todayKey: string;
}) {
  const [query, setQuery] = useState('');
  const [family, setFamily] = useState<'all' | ExerciseGuideFamily>('all');
  const [selectedDay, setSelectedDay] = useState<'all' | Weekday>('all');
  const [library, setLibrary] = useState<FreeExerciseRecord[]>([]);
  const [libraryStatus, setLibraryStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [libraryError, setLibraryError] = useState('');
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [selectedGuide, setSelectedGuide] = useState<{ guide: ExerciseGuide; saved: boolean } | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLibraryStatus('loading');
    setLibraryError('');

    loadFreeExerciseLibrary()
      .then((records) => {
        if (!cancelled) {
          setLibrary(records);
          setLibraryStatus('ready');
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setLibraryStatus('error');
          setLibraryError(error instanceof Error ? error.message : 'The exercise library could not load.');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [loadAttempt]);

  const allSavedEntries = useMemo(
    () => buildSavedExerciseLibraryEntries(program, logs),
    [program, logs],
  );
  const savedEntries = useMemo(() => {
    if (selectedDay === 'all') {
      return allSavedEntries;
    }

    return program[selectedDay].map((exercise, index) => ({
      name: exercise.name,
      family: getFamilyForExerciseKind(exercise.kind),
      order: index + 1,
      workoutBlock: exercise.workoutBlock,
      workoutLabel: exercise.workoutLabel,
    }));
  }, [allSavedEntries, program, selectedDay]);
  const savedGuideResults = useMemo(
    () => savedEntries.map((entry) => ({
      entry,
      guide: resolvePersonalExerciseGuide(entry.name, library, entry.family),
    })),
    [library, savedEntries],
  );
  const savedNames = useMemo(
    () => new Set(savedGuideResults.flatMap(({ guide }) => (
      [guide.name, guide.libraryName]
        .filter(Boolean)
        .map((name) => normalizeLibraryExerciseName(name!))
    ))),
    [savedGuideResults],
  );

  const visibleSavedGuideResults = useMemo(
    () => savedGuideResults.filter(
      ({ guide }) =>
        (family === 'all' || guide.family === family) &&
        matchesExerciseGuide(guide, query),
    ),
    [family, query, savedGuideResults],
  );

  const discoveryGuides = useMemo(() => {
    if (selectedDay !== 'all') {
      return [];
    }

    const customGuides = getCustomExerciseGuides().filter(
      (guide) => !savedNames.has(normalizeLibraryExerciseName(guide.name)),
    );
    const libraryGuides = query.trim()
      ? library
          .map((record) => toExerciseGuide(record))
          .filter((guide) => !savedNames.has(normalizeLibraryExerciseName(guide.name)))
      : [];

    const seen = new Set<string>();
    return [...customGuides, ...libraryGuides]
      .filter((guide) => {
        const guideName = normalizeLibraryExerciseName(guide.name);
        if (
          seen.has(guideName) ||
          (family !== 'all' && guide.family !== family) ||
          !matchesExerciseGuide(guide, query)
        ) {
          return false;
        }
        seen.add(guideName);
        return true;
      })
      .slice(0, query.trim() ? 24 : 4);
  }, [family, library, query, savedNames, selectedDay]);

  const hasResults = visibleSavedGuideResults.length > 0 || discoveryGuides.length > 0;
  const todayWeekday = getWeekday(parseDateKey(todayKey));
  const filterOptions: Array<{ id: 'all' | ExerciseGuideFamily; label: string }> = [
    { id: 'all', label: 'All' },
    { id: 'strength', label: 'Strength' },
    { id: 'mobility', label: 'Mobility' },
  ];

  return (
    <div className="view-stack exercise-search-view">
      <section className="exercise-search-hero">
        <div>
          <p className="eyebrow">Exercise library</p>
          <h1>See the movement before you do it.</h1>
          <p>
            Your program and workout history come first. Search the open library when you want to
            explore something that is not in your log yet.
          </p>
        </div>
        <div className="exercise-search-stat">
          <strong>{savedGuideResults.length}</strong>
          <span>{selectedDay === 'all' ? 'from your Gym' : `on ${selectedDay}`}</span>
        </div>
      </section>

      <section className="exercise-search-controls" aria-label="Exercise search controls">
        <label className="exercise-search-input">
          <Search aria-hidden="true" />
          <span className="sr-only">Search exercises, muscles, or equipment</span>
          <input
            type="search"
            value={query}
            placeholder="Search Cat-Cow, chest, dumbbells…"
            onChange={(event) => setQuery(event.target.value)}
          />
          {query && (
            <button type="button" aria-label="Clear exercise search" onClick={() => setQuery('')}>
              <X aria-hidden="true" />
            </button>
          )}
        </label>

        <div className="exercise-day-filter">
          <div className="exercise-filter-label">
            <CalendarDays aria-hidden="true" />
            <span>Workout day</span>
          </div>
          <div className="exercise-day-options" role="group" aria-label="Filter exercises by workout day">
            <button
              type="button"
              className={selectedDay === 'all' ? 'active' : ''}
              aria-pressed={selectedDay === 'all'}
              onClick={() => setSelectedDay('all')}
            >
              <span>All</span>
              <small>Library</small>
            </button>
            {WEEK_DAYS.map((day) => (
              <button
                key={day}
                type="button"
                className={`${selectedDay === day ? 'active' : ''} ${todayWeekday === day ? 'today' : ''}`}
                aria-label={`${day}${todayWeekday === day ? ', today' : ''}`}
                aria-pressed={selectedDay === day}
                onClick={() => setSelectedDay(day)}
              >
                <span>{day.slice(0, 3)}</span>
                <small>{todayWeekday === day ? 'Today' : program[day].length}</small>
              </button>
            ))}
          </div>
        </div>

        <div className="exercise-family-filters" aria-label="Filter exercise type">
          {filterOptions.map((option) => (
            <button
              key={option.id}
              type="button"
              className={family === option.id ? 'active' : ''}
              aria-pressed={family === option.id}
              onClick={() => setFamily(option.id)}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className={`exercise-library-status ${libraryStatus}`} role="status" aria-live="polite">
          {libraryStatus === 'loading' && (
            <>
              <LoaderCircle className="spin" aria-hidden="true" />
              Loading open exercise library…
            </>
          )}
          {libraryStatus === 'ready' && (
            <>
              <Check aria-hidden="true" />
              {library.length.toLocaleString()} open-library exercises ready
            </>
          )}
          {libraryStatus === 'error' && (
            <>
              <CloudOff aria-hidden="true" />
              <span>Your saved exercises still work. {libraryError}</span>
              <button type="button" onClick={() => setLoadAttempt((current) => current + 1)}>
                Retry
              </button>
            </>
          )}
        </div>
      </section>

      {visibleSavedGuideResults.length > 0 && (
        <section className="exercise-result-section">
          <div className="exercise-result-heading">
            <div>
              <p className="eyebrow">{selectedDay === 'all' ? 'Your Gym' : selectedDay}</p>
              <h2>{selectedDay === 'all' ? 'Your exercises' : `${selectedDay} workouts`}</h2>
            </div>
            <span>{visibleSavedGuideResults.length} shown</span>
          </div>
          <div className="exercise-library-grid">
            {visibleSavedGuideResults.map(({ guide, entry }, index) => {
              const previousEntry = visibleSavedGuideResults[index - 1]?.entry;
              const startsWorkoutBlock = selectedDay !== 'all' && Boolean(entry.workoutLabel) && (
                index === 0 || entry.workoutBlock !== previousEntry?.workoutBlock
              );

              return (
                <Fragment key={`saved-${guide.id}`}>
                  {startsWorkoutBlock && (
                    <div className="exercise-search-workout-heading">
                      <span>{entry.workoutBlock === 2 ? 'Then' : 'Start here'}</span>
                      <strong>{entry.workoutLabel}</strong>
                    </div>
                  )}
                  <ExerciseGuideCard
                    guide={guide}
                    saved
                    sourceLabel={selectedDay === 'all' ? undefined : `${selectedDay.slice(0, 3)} · ${entry.order}`}
                    onOpen={() => setSelectedGuide({ guide, saved: true })}
                  />
                </Fragment>
              );
            })}
          </div>
        </section>
      )}

      {discoveryGuides.length > 0 && (
        <section className="exercise-result-section">
          <div className="exercise-result-heading">
            <div>
              <p className="eyebrow">{query.trim() ? 'Discover' : 'Mobility essential'}</p>
              <h2>{query.trim() ? 'More from the library' : 'Learn Bird Dog'}</h2>
            </div>
            <span>{discoveryGuides.length} shown</span>
          </div>
          <div className="exercise-library-grid">
            {discoveryGuides.map((guide) => (
              <ExerciseGuideCard
                key={`discovery-${guide.id}`}
                guide={guide}
                saved={false}
                onOpen={() => setSelectedGuide({ guide, saved: false })}
              />
            ))}
          </div>
        </section>
      )}

      {!hasResults && (
        <section className="exercise-search-empty">
          <Search aria-hidden="true" />
          <h2>No exercise found</h2>
          <p>Try a movement name, muscle group, or equipment type.</p>
          <button
            className="icon-text-button"
            type="button"
            onClick={() => {
              setQuery('');
              setFamily('all');
              setSelectedDay('all');
            }}
          >
            Clear filters
          </button>
        </section>
      )}

      <p className="exercise-library-footnote">
        Open-library movement data is public domain. Custom Cat-Cow and Bird Dog guides are stored
        directly in Gym, so those visuals do not depend on a third-party service.
      </p>

      {selectedGuide && (
        <ExerciseGuideDialog
          guide={selectedGuide.guide}
          saved={selectedGuide.saved}
          onClose={() => setSelectedGuide(null)}
        />
      )}
    </div>
  );
}

function SettingsView({
  program,
  setProgram,
  onRenameTemplate,
  preferences,
  setPreferences,
  sync,
  onExport,
  onImport,
}: {
  program: ProgramByDay;
  setProgram: Dispatch<SetStateAction<ProgramByDay>>;
  onRenameTemplate: (day: Weekday, exerciseId: string, name: string) => void;
  preferences: Preferences;
  setPreferences: Dispatch<SetStateAction<Preferences>>;
  sync: GymSyncController;
  onExport: () => void;
  onImport: (file: File) => Promise<void>;
}) {
  const [selectedProgramDay, setSelectedProgramDay] = useState<Weekday>(() => getWeekday(new Date()));
  const [newWorkoutName, setNewWorkoutName] = useState('');
  const [newWorkoutKind, setNewWorkoutKind] = useState<ExerciseKind>('strength');
  const [programNameDrafts, setProgramNameDrafts] = useState<Record<string, string>>({});
  const dayWorkouts = program[selectedProgramDay];
  const cloudImportBlocked = Boolean(sync.user && sync.status !== 'synced');

  const commitWorkoutName = (exerciseId: string, name: string) => {
    const key = `${selectedProgramDay}:${exerciseId}`;
    const nextName = name.trim() || 'Untitled Workout';
    setProgramNameDrafts((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
    onRenameTemplate(selectedProgramDay, exerciseId, nextName);
  };

  const updateWorkoutKind = (exerciseId: string, kind: ExerciseKind) => {
    setProgram((current) => ({
      ...current,
      [selectedProgramDay]: current[selectedProgramDay].map((exercise) =>
        exercise.id === exerciseId
          ? { ...exercise, kind, target: createDefaultExerciseTarget(exercise.name, kind) }
          : exercise,
      ),
    }));
  };

  const updateWorkoutTarget = (
    exerciseId: string,
    key: keyof Exercise['target'],
    value: string,
  ) => {
    const limits: Record<keyof Exercise['target'], [number, number]> = {
      sets: [1, 20],
      repMin: [1, 1000],
      repMax: [1, 1000],
      restSeconds: [0, 1800],
    };

    setProgram((current) => ({
      ...current,
      [selectedProgramDay]: current[selectedProgramDay].map((exercise) => {
        if (exercise.id !== exerciseId) {
          return exercise;
        }

        const defaults = createDefaultExerciseTarget(exercise.name, exercise.kind);
        const [minimum, maximum] = limits[key];
        const numericValue = value.trim() ? Number(value) : defaults[key] ?? minimum;
        let nextValue = Number.isFinite(numericValue)
          ? Math.min(maximum, Math.max(minimum, Math.round(numericValue)))
          : defaults[key] ?? minimum;
        const nextTarget = { ...exercise.target, [key]: nextValue };

        if (key === 'repMin' && nextTarget.repMax !== undefined && nextTarget.repMax < nextValue) {
          nextTarget.repMax = nextValue;
        }
        if (key === 'repMax' && nextTarget.repMin !== undefined && nextTarget.repMin > nextValue) {
          nextValue = nextTarget.repMin;
          nextTarget.repMax = nextValue;
        }

        return { ...exercise, target: nextTarget };
      }),
    }));
  };

  const addWorkout = () => {
    const name = newWorkoutName.trim();
    if (!name) {
      return;
    }

    setProgram((current) => ({
      ...current,
      [selectedProgramDay]: [
        ...current[selectedProgramDay],
        {
          id: createWorkoutId(selectedProgramDay),
          day: selectedProgramDay,
          name,
          kind: newWorkoutKind,
          target: createDefaultExerciseTarget(name, newWorkoutKind),
        },
      ],
    }));
    setNewWorkoutName('');
    setNewWorkoutKind('strength');
  };

  const removeWorkout = (exerciseId: string) => {
    const workout = program[selectedProgramDay].find((exercise) => exercise.id === exerciseId);
    if (workout && !window.confirm(`Remove ${workout.name} from ${selectedProgramDay}? Historical snapshots will be kept.`)) {
      return;
    }

    setProgram((current) => ({
      ...current,
      [selectedProgramDay]: current[selectedProgramDay].filter((exercise) => exercise.id !== exerciseId),
    }));
  };

  const moveWorkout = (exerciseId: string, direction: -1 | 1) => {
    setProgram((current) => {
      const workouts = current[selectedProgramDay];
      const currentIndex = workouts.findIndex((exercise) => exercise.id === exerciseId);
      const nextIndex = currentIndex + direction;
      if (currentIndex < 0 || nextIndex < 0 || nextIndex >= workouts.length) {
        return current;
      }

      const nextWorkouts = [...workouts];
      [nextWorkouts[currentIndex], nextWorkouts[nextIndex]] = [nextWorkouts[nextIndex], nextWorkouts[currentIndex]];
      return {
        ...current,
        [selectedProgramDay]: nextWorkouts,
      };
    });
  };

  return (
    <div className="view-stack">
      <section className="topline">
        <div>
          <p className="eyebrow">Settings</p>
          <h1>Training system</h1>
        </div>
      </section>

      <div className="settings-grid">
        <section className="settings-panel">
          <div className="section-title">
            <Target aria-hidden="true" />
            <h3>Weekly rhythm</h3>
          </div>
          <p>Set a realistic number of finished sessions for each Monday–Sunday training week.</p>
          <label className="settings-field">
            <span>Weekly session goal</span>
            <select
              value={preferences.weeklySessionGoal}
              onChange={(event) =>
                setPreferences((current) => ({ ...current, weeklySessionGoal: Number(event.target.value) }))
              }
            >
              {[1, 2, 3, 4, 5, 6, 7].map((goal) => (
                <option key={goal} value={goal}>{goal} sessions</option>
              ))}
            </select>
          </label>
          <label className="settings-field">
            <span>Quick-start rest timer</span>
            <select
              value={preferences.defaultRestSeconds}
              onChange={(event) =>
                setPreferences((current) => ({ ...current, defaultRestSeconds: Number(event.target.value) }))
              }
            >
              {[30, 60, 90, 120, 180].map((seconds) => (
                <option key={seconds} value={seconds}>{seconds} seconds</option>
              ))}
            </select>
          </label>
        </section>

        <section className="settings-panel sync-panel">
          <div className="section-title">
            <Cloud aria-hidden="true" />
            <h3>Firebase sync</h3>
          </div>
          {!sync.configured ? (
            <p>
              This build is safely using local storage. Add the Firebase repository variables to turn on private cross-device sync.
            </p>
          ) : sync.user ? (
            <>
              <div className="sync-account">
                <div>
                  <strong>{sync.user.displayName}</strong>
                  <span>{sync.user.email}</span>
                </div>
                <SyncStatusIndicator sync={sync} />
              </div>
              {sync.lastSyncedAt && (
                <small className="last-sync">Last synced {new Date(sync.lastSyncedAt).toLocaleString()}</small>
              )}
            </>
          ) : (
            <p>Sign in with Google to keep workouts, weekly templates, supersets, and settings in sync across devices.</p>
          )}
          {sync.error && <p className="sync-error" role="alert">{sync.error}</p>}
          <div className="data-actions">
            {sync.configured && !sync.user && (
              <button className="icon-text-button primary" type="button" onClick={() => void sync.signIn()}>
                <LogIn aria-hidden="true" />
                <span>Sign in to sync</span>
              </button>
            )}
            {sync.user && (sync.status === 'error' || sync.status === 'offline') && (
              <button className="icon-text-button" type="button" onClick={sync.retry}>
                <RefreshCw aria-hidden="true" />
                <span>Retry</span>
              </button>
            )}
            {sync.user && (
              <button className="icon-text-button" type="button" onClick={() => void sync.signOut()}>
                <LogOut aria-hidden="true" />
                <span>Sign out</span>
              </button>
            )}
          </div>
        </section>

        <section className="settings-panel data-panel">
          <div className="section-title">
            <Database aria-hidden="true" />
            <h3>Backups</h3>
          </div>
          <p>Local storage remains the instant offline copy. Export a complete backup any time for an extra portable safety net.</p>
          <div className="data-actions">
            <button className="icon-text-button primary" type="button" onClick={onExport}>
              <Download aria-hidden="true" />
              <span>Export backup</span>
            </button>
            <label
              className={`icon-text-button data-import ${cloudImportBlocked ? 'disabled' : ''}`}
              aria-disabled={cloudImportBlocked}
              title={cloudImportBlocked ? 'Wait until Firebase has finished syncing before importing.' : undefined}
            >
              <Upload aria-hidden="true" />
              <span>Import backup</span>
              <input
                type="file"
                accept="application/json,.json"
                disabled={cloudImportBlocked}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) {
                    void onImport(file);
                  }
                  event.target.value = '';
                }}
              />
            </label>
          </div>
        </section>
      </div>

      <div className="program-editor-layout">
        <aside className="program-side-panel">
          <div className="section-title">
            <CalendarDays aria-hidden="true" />
            <h3>Days</h3>
          </div>
          <div className="program-day-tabs">
            {WEEK_DAYS.map((day) => (
              <button
                key={day}
                className={`program-day-button ${day === selectedProgramDay ? 'active' : ''}`}
                type="button"
                aria-pressed={day === selectedProgramDay}
                onClick={() => setSelectedProgramDay(day)}
              >
                <span>{day}</span>
                <strong>{program[day].length}</strong>
              </button>
            ))}
          </div>
          <a className="settings-action spotify-action program-spotify" href="https://open.spotify.com/" target="_blank" rel="noreferrer">
            <Headphones aria-hidden="true" />
            <span>Spotify</span>
            <ExternalLink aria-hidden="true" />
          </a>
        </aside>

        <section className="program-editor-panel">
          <div className="program-editor-head">
            <div className="section-title">
              <ListChecks aria-hidden="true" />
              <h3>{selectedProgramDay} template</h3>
            </div>
            <span>{dayWorkouts.length} saved</span>
          </div>
          <p className="program-editor-help">
            Template changes apply to upcoming {selectedProgramDay}s. Use the pencil beside an exercise in Today or Logbook for a one-day rename.
          </p>

          <form
            className="program-add-row"
            onSubmit={(event) => {
              event.preventDefault();
              addWorkout();
            }}
          >
            <input
              value={newWorkoutName}
              placeholder="Add exercise or activity"
              aria-label={`New exercise for ${selectedProgramDay}`}
              onChange={(event) => setNewWorkoutName(event.target.value)}
            />
            <select
              value={newWorkoutKind}
              aria-label="New workout type"
              onChange={(event) => setNewWorkoutKind(event.target.value as ExerciseKind)}
            >
              <option value="strength">Strength</option>
              <option value="mobility">Mobility</option>
            </select>
            <button className="icon-text-button compact" type="submit" disabled={!newWorkoutName.trim()}>
              <Plus aria-hidden="true" />
              <span>Add</span>
            </button>
          </form>

          <div className="program-workout-list">
            {dayWorkouts.length > 0 ? (
              dayWorkouts.map((exercise, index) => (
                <article key={exercise.id} className="program-workout-row">
                  <div className="move-pair">
                    <button
                      className="move-mini-button"
                      type="button"
                      aria-label={`Move ${exercise.name} up`}
                      onClick={() => moveWorkout(exercise.id, -1)}
                      disabled={index === 0}
                    >
                      <ArrowUp aria-hidden="true" />
                    </button>
                    <button
                      className="move-mini-button"
                      type="button"
                      aria-label={`Move ${exercise.name} down`}
                      onClick={() => moveWorkout(exercise.id, 1)}
                      disabled={index === dayWorkouts.length - 1}
                    >
                      <ArrowDown aria-hidden="true" />
                    </button>
                  </div>
                  <div className="program-workout-content">
                    <div className="program-name-row">
                      <input
                        value={programNameDrafts[`${selectedProgramDay}:${exercise.id}`] ?? exercise.name}
                        aria-label={`Rename ${exercise.name}`}
                        onChange={(event) => {
                          const key = `${selectedProgramDay}:${exercise.id}`;
                          setProgramNameDrafts((current) => ({ ...current, [key]: event.target.value }));
                        }}
                        onBlur={(event) => commitWorkoutName(exercise.id, event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            event.currentTarget.blur();
                          }
                        }}
                      />
                      <select
                        value={exercise.kind}
                        aria-label={`Training type for ${exercise.name}`}
                        onChange={(event) => updateWorkoutKind(exercise.id, event.target.value as ExerciseKind)}
                      >
                        <option value="strength">Strength</option>
                        <option value="mobility">Mobility</option>
                      </select>
                    </div>

                    <div className="prescription-grid">
                      <label>
                        <span>{exercise.kind === 'mobility' ? 'Rounds' : 'Sets'}</span>
                        <input
                          type="number"
                          min="1"
                          max="20"
                          value={exercise.target.sets ?? ''}
                          onChange={(event) => updateWorkoutTarget(exercise.id, 'sets', event.target.value)}
                        />
                      </label>
                      {exercise.kind === 'strength' && (
                        <>
                          <label>
                            <span>Rep min</span>
                            <input
                              type="number"
                              min="1"
                              value={exercise.target.repMin ?? ''}
                              onChange={(event) => updateWorkoutTarget(exercise.id, 'repMin', event.target.value)}
                            />
                          </label>
                          <label>
                            <span>Rep max</span>
                            <input
                              type="number"
                              min="1"
                              value={exercise.target.repMax ?? ''}
                              onChange={(event) => updateWorkoutTarget(exercise.id, 'repMax', event.target.value)}
                            />
                          </label>
                        </>
                      )}
                      <label>
                        <span>Rest sec</span>
                        <input
                          type="number"
                          min="0"
                          max="1800"
                          value={exercise.target.restSeconds ?? ''}
                          onChange={(event) => updateWorkoutTarget(exercise.id, 'restSeconds', event.target.value)}
                        />
                      </label>
                    </div>
                  </div>
                  <button
                    className="set-remove-button"
                    type="button"
                    aria-label={`Remove ${exercise.name}`}
                    onClick={() => removeWorkout(exercise.id)}
                  >
                    <X aria-hidden="true" />
                  </button>
                </article>
              ))
            ) : (
              <p className="empty-note">No workouts saved for {selectedProgramDay}.</p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

export default function App() {
  const [todayKey, setTodayKey] = useState(() => toDateKey(new Date()));
  const [activeTab, setActiveTab] = useState<TabId>(() => getTabFromHash());
  const [selectedDate, setSelectedDate] = useState(todayKey);
  const [program, setProgram] = useState<ProgramByDay>(() => loadProgram());
  const [logs, setLogs] = useState<LogsByDate>(() => loadLogsWithCurrentPlan(todayKey, program));
  const [preferences, setPreferences] = useState<Preferences>(() => loadPreferences());
  const [theme, setTheme] = useState<ThemeMode>(() => getStoredTheme());
  const sync = useGymSync({ logs, setLogs, program, setProgram, preferences, setPreferences });
  const previousActiveTab = useRef(activeTab);

  useEffect(() => {
    const refreshToday = () => setTodayKey(toDateKey(new Date()));
    const timer = window.setInterval(refreshToday, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const syncHash = () => setActiveTab(getTabFromHash());
    window.addEventListener('hashchange', syncHash);
    return () => window.removeEventListener('hashchange', syncHash);
  }, []);

  useEffect(() => {
    if (previousActiveTab.current === activeTab) {
      return;
    }
    previousActiveTab.current = activeTab;

    const frame = window.requestAnimationFrame(() => {
      document.getElementById('main-content')?.focus({ preventScroll: true });
      window.scrollTo({ top: 0, behavior: 'auto' });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [activeTab]);

  useEffect(() => {
    saveLogs(logs);
  }, [logs]);

  useEffect(() => {
    saveProgram(program);
  }, [program]);

  useEffect(() => {
    savePreferences(preferences);
  }, [preferences]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    document.body.setAttribute('data-theme', theme);
    document.documentElement.style.colorScheme = theme;
    const metaTheme = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (metaTheme) {
      metaTheme.content = theme === 'dark' ? '#101311' : '#f2f3ed';
    }
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  const navigate = (tab: TabId) => {
    setActiveTab(tab);
    const nextHash = `#${tab}`;
    if (window.location.hash !== nextHash) {
      window.location.hash = tab;
    }
  };

  const updateLog = (dateKey: string, updater: (log: WorkoutLog) => WorkoutLog) => {
    setLogs((current) => {
      const currentLog = normalizeLog(dateKey, current[dateKey]);
      const nextLog = updater(currentLog);
      const exerciseSnapshot = nextLog.exerciseSnapshot
        ?? currentLog.exerciseSnapshot
        ?? cloneExercises(getProgramExercisesForDate(dateKey, program));
      return {
        ...current,
        [dateKey]: { ...nextLog, exerciseSnapshot },
      };
    });
  };

  const renameTemplateExercise = (
    weekday: Weekday,
    exerciseId: string,
    name: string,
    selectedWorkoutDate?: string,
  ) => {
    const nextName = name.trim();
    if (!nextName) {
      return;
    }

    const templateExercise = program[weekday].find((exercise) => exercise.id === exerciseId);
    if (!templateExercise) {
      return;
    }

    const previousTemplateName = templateExercise.name;
    if (nextName === previousTemplateName) {
      return;
    }

    setProgram((current) => ({
      ...current,
      [weekday]: current[weekday].map((exercise) =>
        exercise.id === exerciseId ? { ...exercise, name: nextName } : exercise,
      ),
    }));

    setLogs((current) => {
      const next = { ...current };
      const propagationStart = selectedWorkoutDate && selectedWorkoutDate > todayKey
        ? selectedWorkoutDate
        : todayKey;
      const datesToUpdate = new Set(
        Object.keys(current).filter((loggedDate) => {
          return loggedDate >= propagationStart && getWeekday(parseDateKey(loggedDate)) === weekday;
        }),
      );
      if (selectedWorkoutDate) {
        datesToUpdate.add(selectedWorkoutDate);
      }

      datesToUpdate.forEach((loggedDate) => {
        const currentLog = normalizeLog(loggedDate, current[loggedDate]);
        const snapshot = currentLog.exerciseSnapshot
          ?? cloneExercises(getProgramExercisesForDate(loggedDate, program));
        const snapshotExercise = snapshot.find((exercise) => exercise.id === exerciseId);
        const selectedDateShouldUpdate = loggedDate === selectedWorkoutDate;
        if (
          !snapshotExercise ||
          (!selectedDateShouldUpdate && snapshotExercise.name !== previousTemplateName)
        ) {
          return;
        }

        const detail = currentLog.details[exerciseId];
        next[loggedDate] = touchLog({
          ...currentLog,
          exerciseSnapshot: snapshot.map((exercise) =>
            exercise.id === exerciseId ? { ...exercise, name: nextName } : exercise,
          ),
          details: detail
            ? {
                ...currentLog.details,
                [exerciseId]: {
                  ...detail,
                  exerciseName:
                    selectedDateShouldUpdate || detail.exerciseName === previousTemplateName
                      ? nextName
                      : detail.exerciseName,
                },
              }
            : currentLog.details,
        });
      });

      return next;
    });
  };

  const canRenameTemplateForDate: CanRenameTemplateForDate = (dateKey, exerciseId) => {
    const weekday = getWeekday(parseDateKey(dateKey));
    return program[weekday].some((exercise) => exercise.id === exerciseId);
  };

  const renameExerciseForDate: RenameExerciseForDate = (dateKey, exerciseId, name, scope) => {
    const nextName = name.trim();
    if (!nextName) {
      return;
    }

    const weekday = getWeekday(parseDateKey(dateKey));
    if (scope === 'template') {
      renameTemplateExercise(weekday, exerciseId, nextName, dateKey);
      return;
    }

    setLogs((current) => {
      const currentLog = normalizeLog(dateKey, current[dateKey]);
      const snapshot = currentLog.exerciseSnapshot
        ?? cloneExercises(getProgramExercisesForDate(dateKey, program));
      if (!snapshot.some((exercise) => exercise.id === exerciseId)) {
        return current;
      }

      const detail = currentLog.details[exerciseId];
      return {
        ...current,
        [dateKey]: touchLog({
          ...currentLog,
          exerciseSnapshot: snapshot.map((exercise) =>
            exercise.id === exerciseId ? { ...exercise, name: nextName } : exercise,
          ),
          details: detail
            ? {
                ...currentLog.details,
                [exerciseId]: { ...detail, exerciseName: nextName },
              }
            : currentLog.details,
        }),
      };
    });
  };

  const clearLog = (dateKey: string) => {
    if (!logs[dateKey]) {
      return;
    }

    const confirmed = window.confirm(
      `Clear the workout log and any one-day plan changes for ${formatDateLabel(dateKey)}? This cannot be undone.`,
    );
    if (!confirmed) {
      return;
    }

    sync.markLogDeleted(dateKey);
  };

  const openLogbook = (dateKey: string) => {
    setSelectedDate(dateKey);
    navigate('logbook');
  };

  const getExercises: GetExercisesForDate = (dateKey) => {
    const snapshot = logs[dateKey]?.exerciseSnapshot;
    return snapshot !== undefined ? snapshot : getProgramExercisesForDate(dateKey, program);
  };

  const updateExerciseOrder = (dateKey: string, exerciseIds: string[]) => {
    setLogs((current) => {
      const currentLog = current[dateKey];
      const normalized = normalizeLog(dateKey, currentLog);
      const snapshot = currentLog?.exerciseSnapshot
        ?? cloneExercises(getProgramExercisesForDate(dateKey, program));

      return {
        ...current,
        [dateKey]: touchLog({
          ...normalized,
          exerciseSnapshot: applyExerciseOrder(snapshot, exerciseIds),
        }),
      };
    });
  };

  const exportBackup = () => {
    const blob = new Blob([serializeGymBackup(logs, program, preferences)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `gym-backup-${todayKey}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const importBackup = async (file: File) => {
    if (sync.user && sync.status !== 'synced') {
      window.alert('Wait for Firebase to finish syncing before importing a backup.');
      return;
    }

    const backup = parseGymBackup(await file.text());
    if (!backup) {
      window.alert('That file is not a valid Gym backup. Nothing was changed.');
      return;
    }

    const confirmed = window.confirm(
      `Replace this device's Gym data with the backup from ${new Date(backup.exportedAt).toLocaleString()}?`,
    );
    if (!confirmed) {
      return;
    }

    Object.keys(logs).forEach((dateKey) => {
      if (!backup.logs[dateKey]) {
        sync.markLogDeleted(dateKey);
      }
    });
    const importedAt = sync.prepareImportedLogs(Object.keys(backup.logs));
    const importedLogs = Object.fromEntries(
      Object.entries(backup.logs).map(([dateKey, log]) => [dateKey, { ...log, updatedAt: importedAt }]),
    );
    setLogs(importedLogs);
    setProgram(backup.program);
    setPreferences(backup.preferences);
  };

  return (
    <div className="app-shell">
      <a
        className="skip-link"
        href="#main-content"
        onClick={(event) => {
          event.preventDefault();
          document.getElementById('main-content')?.focus();
        }}
      >
        Skip to Gym
      </a>

      <AppHeader
        activeTab={activeTab}
        sync={sync}
        theme={theme}
        onNavigate={navigate}
        onThemeToggle={() => setTheme((current) => (current === 'dark' ? 'light' : 'dark'))}
      />

      <main
        id="main-content"
        className={`app-main ${activeTab === 'logbook' ? 'has-workout' : ''}`}
        tabIndex={-1}
      >
        {activeTab === 'week' && (
          <WeekView
            logs={logs}
            todayKey={todayKey}
            selectedDate={selectedDate}
            getExercises={getExercises}
            setSelectedDate={setSelectedDate}
            openLogbook={openLogbook}
          />
        )}
        {activeTab === 'calendar' && (
          <CalendarView
            logs={logs}
            todayKey={todayKey}
            selectedDate={selectedDate}
            getExercises={getExercises}
            setSelectedDate={setSelectedDate}
            openLogbook={openLogbook}
          />
        )}
        {activeTab === 'milestones' && (
          <MilestonesView
            logs={logs}
            preferences={preferences}
            todayKey={todayKey}
            getExercises={getExercises}
          />
        )}
        {activeTab === 'logbook' && (
          <LogbookView
            logs={logs}
            preferences={preferences}
            todayKey={todayKey}
            selectedDate={selectedDate}
            getExercises={getExercises}
            setSelectedDate={setSelectedDate}
            updateExerciseOrder={updateExerciseOrder}
            renameExercise={renameExerciseForDate}
            canRenameTemplate={canRenameTemplateForDate}
            updateLog={updateLog}
            clearLog={clearLog}
          />
        )}
        {activeTab === 'search' && <SearchView program={program} logs={logs} todayKey={todayKey} />}
        {activeTab === 'settings' && (
          <SettingsView
            program={program}
            setProgram={setProgram}
            onRenameTemplate={renameTemplateExercise}
            preferences={preferences}
            setPreferences={setPreferences}
            sync={sync}
            onExport={exportBackup}
            onImport={importBackup}
          />
        )}
      </main>

      <AppFooter />

      <nav className="bottom-tabs" aria-label="Gym tabs">
        {BOTTOM_TABS.map((tab) => (
          <TabButton
            key={tab.id}
            active={activeTab === tab.id}
            icon={tab.icon}
            label={tab.label}
            onClick={() => navigate(tab.id)}
          />
        ))}
      </nav>
    </div>
  );
}
