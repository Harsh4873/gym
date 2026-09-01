export type Weekday =
  | 'Monday'
  | 'Tuesday'
  | 'Wednesday'
  | 'Thursday'
  | 'Friday'
  | 'Saturday'
  | 'Sunday';

export type TabId = 'week' | 'calendar' | 'milestones' | 'logbook' | 'search' | 'settings';

export type ThemeMode = 'dark' | 'light';

export type DayStatus = 'completed' | 'partial' | 'planned' | 'skipped' | 'unlogged' | 'future';

export type WeightMode = 'bodyweight' | 'pounds';

export type ExerciseKind = 'strength' | 'mobility';

export interface ExerciseTarget {
  sets?: number;
  repMin?: number;
  repMax?: number;
  restSeconds?: number;
}

export interface Exercise {
  id: string;
  day: Weekday;
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

export type ExerciseOrderByDay = Record<Weekday, string[]>;

export type ProgramByDay = Record<Weekday, Exercise[]>;
