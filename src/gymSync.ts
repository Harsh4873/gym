import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  serverTimestamp,
  setDoc,
  writeBatch,
  type DocumentData,
  type Firestore,
  type QueryDocumentSnapshot,
  type SnapshotMetadata,
  type Timestamp,
  type Unsubscribe,
} from 'firebase/firestore';
import { getFirebaseServices } from './firebase';
import type { LogsByDate, Preferences, ProgramByDay, WorkoutLog } from './types';

const CLOUD_SCHEMA_VERSION = 1 as const;
const MAX_BATCH_LOG_WRITES = 450;
const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

interface CloudDocumentMeta {
  schemaVersion: typeof CLOUD_SCHEMA_VERSION;
  clientId: string;
  syncedAt?: Timestamp | null;
}

export interface CloudGymCore extends CloudDocumentMeta {
  program?: ProgramByDay;
  preferences?: Preferences;
  programUpdatedAt?: string;
  programUpdatedAtMs?: number;
  preferencesUpdatedAt?: string;
  preferencesUpdatedAtMs?: number;
  migratedAt?: string;
}

export interface CloudWorkoutLog extends CloudDocumentMeta {
  date: string;
  deleted: false;
  updatedAt: string;
  updatedAtMs: number;
  log: WorkoutLog;
}

export interface CloudWorkoutTombstone extends CloudDocumentMeta {
  date: string;
  deleted: true;
  updatedAt: string;
  updatedAtMs: number;
}

export type CloudWorkoutDocument = CloudWorkoutLog | CloudWorkoutTombstone;

export interface CloudSnapshotMetadata {
  fromCache: boolean;
  hasPendingWrites: boolean;
}

export interface GymCloudState {
  core: CloudGymCore | null;
  logs: Record<string, CloudWorkoutDocument>;
  metadata: CloudSnapshotMetadata;
}

export interface InitialGymCloudState {
  logs: LogsByDate;
  program: ProgramByDay;
  preferences: Preferences;
  clientId: string;
  programUpdatedAt?: string;
  preferencesUpdatedAt?: string;
  migratedAt?: string;
  tombstones?: Record<string, string>;
}

export interface GymSyncRepository {
  readonly uid: string;
  read(): Promise<GymCloudState>;
  subscribe(
    onState: (state: GymCloudState) => void,
    onError?: (error: Error) => void,
  ): Unsubscribe;
  writeInitialState(state: InitialGymCloudState): Promise<void>;
  writeLog(log: WorkoutLog, clientId: string): Promise<void>;
  tombstoneLog(date: string, updatedAt: string, clientId: string): Promise<void>;
  writeProgram(program: ProgramByDay, updatedAt: string, clientId: string): Promise<void>;
  writePreferences(preferences: Preferences, updatedAt: string, clientId: string): Promise<void>;
}

function assertPathSegment(value: string, label: string): void {
  if (!value.trim() || value.includes('/')) {
    throw new Error(`${label} must be a non-empty Firestore path segment.`);
  }
}

function assertDateKey(date: string): void {
  if (!DATE_KEY_PATTERN.test(date)) {
    throw new Error(`Invalid Gym date key: ${date}`);
  }
}

function assertClientId(clientId: string): void {
  assertPathSegment(clientId, 'clientId');
}

function timestampMillis(timestamp: string, label: string): number {
  const milliseconds = Date.parse(timestamp);
  if (!Number.isFinite(milliseconds)) {
    throw new Error(`${label} must be a valid ISO timestamp.`);
  }
  return milliseconds;
}

function combineSnapshotMetadata(...metadata: SnapshotMetadata[]): CloudSnapshotMetadata {
  return {
    fromCache: metadata.some((item) => item.fromCache),
    hasPendingWrites: metadata.some((item) => item.hasPendingWrites),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function parseCore(data: DocumentData | undefined): CloudGymCore | null {
  if (!isRecord(data) || data.schemaVersion !== CLOUD_SCHEMA_VERSION || typeof data.clientId !== 'string') {
    return null;
  }
  return data as unknown as CloudGymCore;
}

function parseWorkoutDocument(
  snapshot: QueryDocumentSnapshot<DocumentData>,
): CloudWorkoutDocument | null {
  const data = snapshot.data();
  if (
    !isRecord(data) ||
    data.schemaVersion !== CLOUD_SCHEMA_VERSION ||
    data.date !== snapshot.id ||
    !DATE_KEY_PATTERN.test(snapshot.id) ||
    typeof data.clientId !== 'string' ||
    typeof data.updatedAt !== 'string' ||
    typeof data.updatedAtMs !== 'number' ||
    typeof data.deleted !== 'boolean'
  ) {
    return null;
  }

  if (data.deleted) {
    return data as unknown as CloudWorkoutTombstone;
  }

  return isRecord(data.log) ? (data as unknown as CloudWorkoutLog) : null;
}

function parseLogSnapshot(
  docs: Array<QueryDocumentSnapshot<DocumentData>>,
): Record<string, CloudWorkoutDocument> {
  return docs.reduce<Record<string, CloudWorkoutDocument>>((logs, snapshot) => {
    const parsed = parseWorkoutDocument(snapshot);
    if (parsed) {
      logs[parsed.date] = parsed;
    }
    return logs;
  }, {});
}

export function createWorkoutLogCandidate(log: WorkoutLog, clientId: string): CloudWorkoutLog {
  assertDateKey(log.date);
  assertClientId(clientId);
  return {
    schemaVersion: CLOUD_SCHEMA_VERSION,
    date: log.date,
    deleted: false,
    updatedAt: log.updatedAt,
    updatedAtMs: timestampMillis(log.updatedAt, 'Workout updatedAt'),
    clientId,
    log,
  };
}

export function createWorkoutTombstoneCandidate(
  date: string,
  updatedAt: string,
  clientId: string,
): CloudWorkoutTombstone {
  assertDateKey(date);
  assertClientId(clientId);
  return {
    schemaVersion: CLOUD_SCHEMA_VERSION,
    date,
    deleted: true,
    updatedAt,
    updatedAtMs: timestampMillis(updatedAt, 'Tombstone updatedAt'),
    clientId,
  };
}

function createActiveLogDocument(log: WorkoutLog, clientId: string) {
  return { ...createWorkoutLogCandidate(log, clientId), syncedAt: serverTimestamp() };
}

function createTombstoneDocument(date: string, updatedAt: string, clientId: string) {
  return { ...createWorkoutTombstoneCandidate(date, updatedAt, clientId), syncedAt: serverTimestamp() };
}

class FirestoreGymSyncRepository implements GymSyncRepository {
  readonly uid: string;
  private readonly db: Firestore;

  constructor(db: Firestore, uid: string) {
    assertPathSegment(uid, 'uid');
    this.db = db;
    this.uid = uid;
  }

  private get coreRef() {
    return doc(this.db, 'users', this.uid, 'gym', 'core');
  }

  private get logsRef() {
    return collection(this.db, 'users', this.uid, 'logs');
  }

  private logRef(date: string) {
    assertDateKey(date);
    return doc(this.logsRef, date);
  }

  async read(): Promise<GymCloudState> {
    const [coreSnapshot, logsSnapshot] = await Promise.all([
      getDoc(this.coreRef),
      getDocs(this.logsRef),
    ]);

    return {
      core: parseCore(coreSnapshot.data()),
      logs: parseLogSnapshot(logsSnapshot.docs),
      metadata: combineSnapshotMetadata(coreSnapshot.metadata, logsSnapshot.metadata),
    };
  }

  subscribe(
    onState: (state: GymCloudState) => void,
    onError?: (error: Error) => void,
  ): Unsubscribe {
    let core: CloudGymCore | null = null;
    let logs: Record<string, CloudWorkoutDocument> = {};
    let coreMetadata: SnapshotMetadata | null = null;
    let logsMetadata: SnapshotMetadata | null = null;

    const emitWhenReady = () => {
      if (!coreMetadata || !logsMetadata) {
        return;
      }
      onState({
        core,
        logs,
        metadata: combineSnapshotMetadata(coreMetadata, logsMetadata),
      });
    };

    const unsubscribeCore = onSnapshot(
      this.coreRef,
      { includeMetadataChanges: true },
      (snapshot) => {
        core = parseCore(snapshot.data());
        coreMetadata = snapshot.metadata;
        emitWhenReady();
      },
      onError,
    );
    const unsubscribeLogs = onSnapshot(
      this.logsRef,
      { includeMetadataChanges: true },
      (snapshot) => {
        logs = parseLogSnapshot(snapshot.docs);
        logsMetadata = snapshot.metadata;
        emitWhenReady();
      },
      onError,
    );

    return () => {
      unsubscribeCore();
      unsubscribeLogs();
    };
  }

  async writeInitialState(state: InitialGymCloudState): Promise<void> {
    assertClientId(state.clientId);
    const migratedAt = state.migratedAt ?? new Date().toISOString();
    const programUpdatedAt = state.programUpdatedAt ?? migratedAt;
    const preferencesUpdatedAt = state.preferencesUpdatedAt ?? migratedAt;
    const logDocumentsByDate = new Map<string, DocumentData>();

    Object.entries(state.logs).forEach(([date, log]) => {
      if (date !== log.date) {
        throw new Error(`Workout log key ${date} does not match its date field ${log.date}.`);
      }
      logDocumentsByDate.set(date, createActiveLogDocument(log, state.clientId));
    });
    Object.entries(state.tombstones ?? {}).forEach(([date, updatedAt]) => {
      // A tombstone deliberately wins if a caller supplied both forms.
      logDocumentsByDate.set(date, createTombstoneDocument(date, updatedAt, state.clientId));
    });
    const logDocuments = Array.from(logDocumentsByDate, ([date, data]) => ({ date, data }));

    for (let index = 0; index < Math.max(1, logDocuments.length); index += MAX_BATCH_LOG_WRITES) {
      const batch = writeBatch(this.db);
      if (index === 0) {
        batch.set(this.coreRef, {
          schemaVersion: CLOUD_SCHEMA_VERSION,
          program: state.program,
          preferences: state.preferences,
          programUpdatedAt,
          programUpdatedAtMs: timestampMillis(programUpdatedAt, 'Program updatedAt'),
          preferencesUpdatedAt,
          preferencesUpdatedAtMs: timestampMillis(preferencesUpdatedAt, 'Preferences updatedAt'),
          migratedAt,
          clientId: state.clientId,
          syncedAt: serverTimestamp(),
        });
      }
      logDocuments.slice(index, index + MAX_BATCH_LOG_WRITES).forEach(({ date, data }) => {
        batch.set(this.logRef(date), data);
      });
      await batch.commit();
    }
  }

  writeLog(log: WorkoutLog, clientId: string): Promise<void> {
    return setDoc(this.logRef(log.date), createActiveLogDocument(log, clientId));
  }

  tombstoneLog(date: string, updatedAt: string, clientId: string): Promise<void> {
    return setDoc(this.logRef(date), createTombstoneDocument(date, updatedAt, clientId));
  }

  writeProgram(program: ProgramByDay, updatedAt: string, clientId: string): Promise<void> {
    assertClientId(clientId);
    return setDoc(
      this.coreRef,
      {
        schemaVersion: CLOUD_SCHEMA_VERSION,
        program,
        programUpdatedAt: updatedAt,
        programUpdatedAtMs: timestampMillis(updatedAt, 'Program updatedAt'),
        clientId,
        syncedAt: serverTimestamp(),
      },
      { merge: true },
    );
  }

  writePreferences(preferences: Preferences, updatedAt: string, clientId: string): Promise<void> {
    assertClientId(clientId);
    return setDoc(
      this.coreRef,
      {
        schemaVersion: CLOUD_SCHEMA_VERSION,
        preferences,
        preferencesUpdatedAt: updatedAt,
        preferencesUpdatedAtMs: timestampMillis(updatedAt, 'Preferences updatedAt'),
        clientId,
        syncedAt: serverTimestamp(),
      },
      { merge: true },
    );
  }
}

/** Returns null when the deployed build has no Firebase configuration. */
export async function createGymSyncRepository(uid: string): Promise<GymSyncRepository | null> {
  const services = await getFirebaseServices();
  return services ? new FirestoreGymSyncRepository(services.db, uid) : null;
}

/**
 * Selects the newest logical document without depending on Firestore arrival
 * order. Tombstones participate in the same updatedAt ordering as active logs.
 */
export function chooseNewestWorkoutDocument(
  left: CloudWorkoutDocument | undefined,
  right: CloudWorkoutDocument | undefined,
): CloudWorkoutDocument | undefined {
  if (!left) return right;
  if (!right) return left;
  if (left.updatedAtMs !== right.updatedAtMs) {
    return left.updatedAtMs > right.updatedAtMs ? left : right;
  }
  // When timestamps tie, deletion wins so a cleared workout cannot reappear.
  if (left.deleted !== right.deleted) {
    return left.deleted ? left : right;
  }
  return left.clientId.localeCompare(right.clientId) >= 0 ? left : right;
}
