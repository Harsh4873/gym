export type Weekday =
  | 'Monday'
  | 'Tuesday'
  | 'Wednesday'
  | 'Thursday'
  | 'Friday'
  | 'Saturday'
  | 'Sunday';

export type TabId = 'today' | 'week' | 'calendar' | 'milestones' | 'logbook' | 'settings';

export type ThemeMode = 'dark' | 'light';

export type DayStatus = 'completed' | 'partial' | 'planned' | 'skipped' | 'unlogged' | 'future';

export type WeightMode = 'bodyweight' | 'pounds';

export type ExerciseKind = 'strength' | 'cardio' | 'mobility';

export interface ExerciseTarget {
  sets?: number;
  repMin?: number;
  repMax?: number;
  minutes?: number;
  restSeconds?: number;
}

export interface Exercise {
  id: string;
  day: Weekday;
  name: string;
  kind: ExerciseKind;
  target: ExerciseTarget;
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
  cardioMinutes?: string;
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

export interface Preferences {
  weeklySessionGoal: number;
  defaultRestSeconds: number;
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
