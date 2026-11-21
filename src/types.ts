export type Weekday =
  | 'Monday'
  | 'Tuesday'
  | 'Wednesday'
  | 'Thursday'
  | 'Friday'
  | 'Saturday'
  | 'Sunday';

/** One day in the 8-day CBL/SARMS cycle. Calendar weekdays are not sessions. */
export type SessionId =
  | 'CBL R1'
  | 'SARMS R1'
  | 'CBL R2'
  | 'SARMS R2'
  | 'CBL R3'
  | 'SARMS R3'
  | 'CBL R4'
  | 'SARMS R4';

/** Live program days are sessions. Historical log snapshots may still name a weekday. */
export type ProgramDay = SessionId | Weekday;

export type TabId = 'week' | 'calendar' | 'milestones' | 'logbook' | 'search' | 'settings';

export type ThemeMode = 'dark' | 'light';

export type DayStatus = 'completed' | 'partial' | 'planned' | 'skipped' | 'unlogged' | 'future';

export type WeightMode = 'bodyweight' | 'pounds';

export type ExerciseKind = 'strength' | 'stretch';

export interface ExerciseTarget {
  sets?: number;
  repMin?: number;
  repMax?: number;
  restSeconds?: number;
}

export interface Exercise {
  id: string;
  day: ProgramDay;
  name: string;
  kind: ExerciseKind;
  target: ExerciseTarget;
  workoutBlock?: 1 | 2;
  workoutLabel?: string;
  blockOrder?: number;
  extra?: boolean;
}

export interface SupersetPair {
  id: string;
  exerciseIds: [string, string];
}

export interface ExerciseSet {
  id: string;
  weightMode: WeightMode;
  pounds: string;
  reps: string;
  /** Stretch holds. Older logs kept this number in `reps`. */
  holdSeconds?: string;
}

export interface ExerciseDetail {
  exerciseName?: string;
  sets: ExerciseSet[];
  legacyNote?: string;
}

export interface WorkoutLog {
  date: string;
  completed: string[];
  skipped: string[];
  details: Record<string, ExerciseDetail>;
  notes: string;
  prNote: string;
  supersets: SupersetPair[];
  daySkipped: boolean;
  updatedAt: string;
  startedAt?: string;
  finishedAt?: string;
  exerciseSnapshot?: Exercise[];
}

export type LogbookViewMode = 'log' | 'checklist';

export interface Preferences {
  weeklySessionGoal: number;
  defaultRestSeconds: number;
  logbookView: LogbookViewMode;
}

export interface GymBackup {
  version: 1;
  exportedAt: string;
  logs: LogsByDate;
  program: ProgramByDay;
  preferences: Preferences;
}

export type LogsByDate = Record<string, WorkoutLog>;

export type ExerciseOrderByDay = Record<SessionId, string[]>;

export type ProgramByDay = Record<SessionId, Exercise[]>;
