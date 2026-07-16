import type { User } from 'firebase/auth';
import type { Dispatch, SetStateAction } from 'react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { isFirebaseConfigured } from './firebaseConfig';
import type {
  CloudGymCore,
  CloudWorkoutDocument,
  GymCloudState,
  GymSyncRepository,
} from './gymSync';
import { normalizeLog, normalizePreferences, normalizeProgram } from './storage';
import type { LogsByDate, Preferences, ProgramByDay } from './types';

const SYNC_META_STORAGE_KEY = 'harsh-gym-sync-meta-v1';
const SYNC_DEBOUNCE_MS = 650;
type GymSyncModule = typeof import('./gymSync');

export type GymSyncStatus = 'local' | 'connecting' | 'syncing' | 'synced' | 'offline' | 'error';

export interface GymSyncUser {
  uid: string;
  displayName: string;
  email: string;
  photoURL?: string;
}

interface SyncMetadata {
  version: 1;
  clientId: string;
  accountUid?: string;
  programFingerprint: string;
  programUpdatedAt: string;
  preferencesFingerprint: string;
  preferencesUpdatedAt: string;
  tombstones: Record<string, string>;
}

interface UseGymSyncOptions {
  logs: LogsByDate;
  setLogs: Dispatch<SetStateAction<LogsByDate>>;
  program: ProgramByDay;
  setProgram: Dispatch<SetStateAction<ProgramByDay>>;
  preferences: Preferences;
  setPreferences: Dispatch<SetStateAction<Preferences>>;
}

export interface GymSyncController {
  configured: boolean;
  user: GymSyncUser | null;
  status: GymSyncStatus;
  error: string | null;
  lastSyncedAt: string | null;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  retry: () => void;
  markLogDeleted: (dateKey: string) => void;
  prepareImportedLogs: (dateKeys: string[]) => string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function fingerprint(value: unknown): string {
  return JSON.stringify(value, (_key, nestedValue) => {
    if (!isRecord(nestedValue)) {
      return nestedValue;
    }
    return Object.keys(nestedValue)
      .sort()
      .reduce<Record<string, unknown>>((sorted, key) => {
        sorted[key] = nestedValue[key];
        return sorted;
      }, {});
  }) ?? 'undefined';
}

function createClientId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `client-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeTimestamp(value: unknown, fallback = new Date().toISOString()): string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value)) ? value : fallback;
}

function loadSyncMetadata(program: ProgramByDay, preferences: Preferences): SyncMetadata {
  const now = new Date().toISOString();
  const programFingerprint = fingerprint(program);
  const preferencesFingerprint = fingerprint(preferences);

  try {
    const parsed = JSON.parse(window.localStorage.getItem(SYNC_META_STORAGE_KEY) ?? 'null') as unknown;
    if (isRecord(parsed) && parsed.version === 1 && typeof parsed.clientId === 'string' && parsed.clientId) {
      const storedTombstones = isRecord(parsed.tombstones)
        ? Object.fromEntries(
            Object.entries(parsed.tombstones).filter((entry): entry is [string, string] => {
              return /^\d{4}-\d{2}-\d{2}$/.test(entry[0]) && typeof entry[1] === 'string' && Number.isFinite(Date.parse(entry[1]));
            }),
          )
        : {};
      const storedProgramFingerprint = typeof parsed.programFingerprint === 'string'
        ? parsed.programFingerprint
        : '';
      const storedPreferencesFingerprint = typeof parsed.preferencesFingerprint === 'string'
        ? parsed.preferencesFingerprint
        : '';

      return {
        version: 1,
        clientId: parsed.clientId,
        ...(typeof parsed.accountUid === 'string' && parsed.accountUid ? { accountUid: parsed.accountUid } : {}),
        programFingerprint,
        programUpdatedAt:
          storedProgramFingerprint === programFingerprint
            ? normalizeTimestamp(parsed.programUpdatedAt, now)
            : now,
        preferencesFingerprint,
        preferencesUpdatedAt:
          storedPreferencesFingerprint === preferencesFingerprint
            ? normalizeTimestamp(parsed.preferencesUpdatedAt, now)
            : now,
        tombstones: storedTombstones,
      };
    }
  } catch {
    // A malformed sync record must never block local workout data.
  }

  return {
    version: 1,
    clientId: createClientId(),
    programFingerprint,
    programUpdatedAt: now,
    preferencesFingerprint,
    preferencesUpdatedAt: now,
    tombstones: {},
  };
}

function saveSyncMetadata(metadata: SyncMetadata): void {
  try {
    window.localStorage.setItem(SYNC_META_STORAGE_KEY, JSON.stringify(metadata));
  } catch {
    // The app still writes its primary data to the established local keys.
  }
}

function publicUser(user: User): GymSyncUser {
  return {
    uid: user.uid,
    displayName: user.displayName?.trim() || user.email?.split('@')[0] || 'Gym user',
    email: user.email ?? '',
    ...(user.photoURL ? { photoURL: user.photoURL } : {}),
  };
}

function coreTimestamp(value: string | undefined, valueMs: number | undefined): number {
  if (typeof valueMs === 'number' && Number.isFinite(valueMs)) {
    return valueMs;
  }
  const parsed = value ? Date.parse(value) : NaN;
  return Number.isFinite(parsed) ? parsed : 0;
}

function timestampAfter(...values: Array<number | string | undefined>): string {
  const newest = values.reduce<number>((current, value) => {
    const parsed = typeof value === 'number' ? value : value ? Date.parse(value) : NaN;
    return Number.isFinite(parsed) ? Math.max(current, parsed + 1) : current;
  }, Date.now());
  return new Date(newest).toISOString();
}

function cloudDocumentsHaveSameValue(
  left: CloudWorkoutDocument | undefined,
  right: CloudWorkoutDocument | undefined,
): boolean {
  if (!left || !right || left.deleted !== right.deleted) {
    return false;
  }
  if (left.deleted || right.deleted) {
    return left.updatedAtMs === right.updatedAtMs;
  }
  return fingerprint(normalizeLog(left.date, left.log)) === fingerprint(normalizeLog(right.date, right.log));
}

export function useGymSync({
  logs,
  setLogs,
  program,
  setProgram,
  preferences,
  setPreferences,
}: UseGymSyncOptions): GymSyncController {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [status, setStatus] = useState<GymSyncStatus>(isFirebaseConfigured ? 'connecting' : 'local');
  const [error, setError] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [retryToken, setRetryToken] = useState(0);
  const [initialMetadata] = useState(() => loadSyncMetadata(program, preferences));

  const logsRef = useRef(logs);
  const previousLogsRef = useRef(logs);
  const programRef = useRef(program);
  const preferencesRef = useRef(preferences);
  const metadataRef = useRef<SyncMetadata>(initialMetadata);
  const syncModuleRef = useRef<GymSyncModule | null>(null);
  const repositoryRef = useRef<GymSyncRepository | null>(null);
  const remoteCoreRef = useRef<CloudGymCore | null>(null);
  const remoteLogsRef = useRef<Record<string, CloudWorkoutDocument>>({});
  const cloudMetadataRef = useRef({ fromCache: true, hasPendingWrites: false });
  const readyRef = useRef(false);
  const repositoryGenerationRef = useRef(0);
  const flushTimerRef = useRef<number | undefined>();
  const flushInFlightRef = useRef<Promise<void> | null>(null);
  const flushInFlightGenerationRef = useRef(0);
  const flushAgainRef = useRef(false);
  const flushRef = useRef<() => Promise<void>>(async () => undefined);

  logsRef.current = logs;
  programRef.current = program;
  preferencesRef.current = preferences;

  useEffect(() => {
    saveSyncMetadata(metadataRef.current);
  }, []);

  const reportError = (reason: unknown) => {
    const message = reason instanceof Error ? reason.message : 'Firebase sync failed.';
    setError(message);
    setStatus('error');
  };

  const applyCloudState = (state: GymCloudState, uid: string) => {
    const syncModule = syncModuleRef.current;
    if (!syncModule) {
      return;
    }
    const metadata = metadataRef.current;
    cloudMetadataRef.current = state.metadata;
    const sameAccount = metadata.accountUid === uid;
    const mayMergeLocal = !metadata.accountUid || sameAccount;
    const wasReady = readyRef.current;
    const previousRemoteCore = remoteCoreRef.current;
    const previousRemoteLogs = remoteLogsRef.current;
    const currentLogs = logsRef.current;
    const localTombstones = mayMergeLocal ? { ...metadata.tombstones } : {};
    const mergedLogs: LogsByDate = {};
    const mergedTombstones: Record<string, string> = {};
    const dates = new Set([
      ...Object.keys(state.logs),
      ...(mayMergeLocal ? Object.keys(currentLogs) : []),
      ...Object.keys(localTombstones),
    ]);

    dates.forEach((date) => {
      const currentLocalLog = mayMergeLocal && currentLogs[date]
        ? normalizeLog(date, currentLogs[date])
        : undefined;
      const incomingRemote = state.logs[date];
      const previousRemote = previousRemoteLogs[date];
      const localLogChanged = Boolean(
        wasReady &&
          sameAccount &&
          currentLocalLog &&
          (!incomingRemote ||
            incomingRemote.deleted ||
            fingerprint(currentLocalLog) !== fingerprint(normalizeLog(date, incomingRemote.log))) &&
          (!previousRemote ||
            previousRemote.deleted ||
            fingerprint(currentLocalLog) !== fingerprint(normalizeLog(date, previousRemote.log))),
      );
      const adjustedLocalLog =
        currentLocalLog &&
        localLogChanged &&
        incomingRemote &&
        Date.parse(currentLocalLog.updatedAt) <= incomingRemote.updatedAtMs
          ? { ...currentLocalLog, updatedAt: timestampAfter(currentLocalLog.updatedAt, incomingRemote.updatedAtMs) }
          : currentLocalLog;
      const localLog = adjustedLocalLog
        ? syncModule.createWorkoutLogCandidate(adjustedLocalLog, metadata.clientId)
        : undefined;
      const currentTombstoneAt = localTombstones[date];
      const adjustedTombstoneAt =
        !adjustedLocalLog &&
        currentTombstoneAt &&
        incomingRemote &&
        !incomingRemote.deleted &&
        Date.parse(currentTombstoneAt) <= incomingRemote.updatedAtMs
          ? timestampAfter(currentTombstoneAt, incomingRemote.updatedAtMs)
          : currentTombstoneAt;
      const localTombstone = adjustedTombstoneAt
        ? syncModule.createWorkoutTombstoneCandidate(date, adjustedTombstoneAt, metadata.clientId)
        : undefined;
      const localWinner = syncModule.chooseNewestWorkoutDocument(localLog, localTombstone);
      const winner = syncModule.chooseNewestWorkoutDocument(incomingRemote, localWinner);
      if (!winner) {
        return;
      }
      if (winner.deleted) {
        mergedTombstones[date] = winner.updatedAt;
      } else {
        mergedLogs[date] = normalizeLog(date, winner.log);
      }
    });

    let nextProgram = programRef.current;
    let programUpdatedAt = metadata.programUpdatedAt;
    const remoteProgram = state.core?.program ? normalizeProgram(state.core.program) : null;
    const currentProgramFingerprint = fingerprint(programRef.current);
    const remoteProgramFingerprint = remoteProgram ? fingerprint(remoteProgram) : '';
    const previousRemoteProgramFingerprint = previousRemoteCore?.program
      ? fingerprint(normalizeProgram(previousRemoteCore.program))
      : '';
    const remoteProgramTime = coreTimestamp(state.core?.programUpdatedAt, state.core?.programUpdatedAtMs);
    const localProgramTime = Date.parse(metadata.programUpdatedAt);
    const localProgramIsDefault = currentProgramFingerprint === fingerprint(normalizeProgram({}));
    const localProgramChanged = Boolean(
      wasReady &&
        sameAccount &&
        remoteProgram &&
        currentProgramFingerprint !== remoteProgramFingerprint &&
        currentProgramFingerprint !== previousRemoteProgramFingerprint,
    );
    if (localProgramChanged) {
      if (remoteProgramTime >= localProgramTime) {
        programUpdatedAt = timestampAfter(metadata.programUpdatedAt, remoteProgramTime);
      }
    } else if (remoteProgram && (sameAccount ? remoteProgramTime >= localProgramTime : localProgramIsDefault)) {
      nextProgram = remoteProgram;
      programUpdatedAt = normalizeTimestamp(state.core?.programUpdatedAt);
    }

    let nextPreferences = preferencesRef.current;
    let preferencesUpdatedAt = metadata.preferencesUpdatedAt;
    const remotePreferences = state.core?.preferences ? normalizePreferences(state.core.preferences) : null;
    const currentPreferencesFingerprint = fingerprint(preferencesRef.current);
    const remotePreferencesFingerprint = remotePreferences ? fingerprint(remotePreferences) : '';
    const previousRemotePreferencesFingerprint = previousRemoteCore?.preferences
      ? fingerprint(normalizePreferences(previousRemoteCore.preferences))
      : '';
    const remotePreferencesTime = coreTimestamp(
      state.core?.preferencesUpdatedAt,
      state.core?.preferencesUpdatedAtMs,
    );
    const localPreferencesTime = Date.parse(metadata.preferencesUpdatedAt);
    const localPreferencesAreDefault = currentPreferencesFingerprint === fingerprint(normalizePreferences({}));
    const localPreferencesChanged = Boolean(
      wasReady &&
        sameAccount &&
        remotePreferences &&
        currentPreferencesFingerprint !== remotePreferencesFingerprint &&
        currentPreferencesFingerprint !== previousRemotePreferencesFingerprint,
    );
    if (localPreferencesChanged) {
      if (remotePreferencesTime >= localPreferencesTime) {
        preferencesUpdatedAt = timestampAfter(metadata.preferencesUpdatedAt, remotePreferencesTime);
      }
    } else if (
      remotePreferences &&
      (sameAccount ? remotePreferencesTime >= localPreferencesTime : localPreferencesAreDefault)
    ) {
      nextPreferences = remotePreferences;
      preferencesUpdatedAt = normalizeTimestamp(state.core?.preferencesUpdatedAt);
    }

    metadataRef.current = {
      ...metadata,
      accountUid: uid,
      programFingerprint: fingerprint(nextProgram),
      programUpdatedAt,
      preferencesFingerprint: fingerprint(nextPreferences),
      preferencesUpdatedAt,
      tombstones: mergedTombstones,
    };
    saveSyncMetadata(metadataRef.current);
    remoteCoreRef.current = state.core;
    remoteLogsRef.current = state.logs;

    if (fingerprint(nextProgram) !== fingerprint(programRef.current)) {
      programRef.current = nextProgram;
      setProgram(nextProgram);
    }
    if (fingerprint(nextPreferences) !== fingerprint(preferencesRef.current)) {
      preferencesRef.current = nextPreferences;
      setPreferences(nextPreferences);
    }
    if (fingerprint(mergedLogs) !== fingerprint(logsRef.current)) {
      logsRef.current = mergedLogs;
      setLogs(mergedLogs);
    }

    readyRef.current = true;
  };

  const performFlush = async (generation: number) => {
    const repository = repositoryRef.current;
    const syncModule = syncModuleRef.current;
    if (!repository || !syncModule || !readyRef.current) {
      return;
    }

    const isCurrentRepository = () => {
      return repositoryRef.current === repository && repositoryGenerationRef.current === generation;
    };

    try {
      let metadata = metadataRef.current;
      let metadataChanged = false;
      let logsChanged = false;
      let nextLogs = logsRef.current;
      const writes: Array<Promise<void>> = [];
      const remoteCore = remoteCoreRef.current;
      const currentProgramFingerprint = fingerprint(programRef.current);
      const remoteProgramFingerprint = remoteCore?.program
        ? fingerprint(normalizeProgram(remoteCore.program))
        : '';
      if (currentProgramFingerprint !== remoteProgramFingerprint) {
        const remoteProgramTime = coreTimestamp(remoteCore?.programUpdatedAt, remoteCore?.programUpdatedAtMs);
        const programUpdatedAt = Date.parse(metadata.programUpdatedAt) <= remoteProgramTime
          ? timestampAfter(metadata.programUpdatedAt, remoteProgramTime)
          : metadata.programUpdatedAt;
        if (programUpdatedAt !== metadata.programUpdatedAt) {
          metadata = { ...metadata, programUpdatedAt };
          metadataChanged = true;
        }
        writes.push(repository.writeProgram(programRef.current, programUpdatedAt, metadata.clientId));
      }

      const currentPreferencesFingerprint = fingerprint(preferencesRef.current);
      const remotePreferencesFingerprint = remoteCore?.preferences
        ? fingerprint(normalizePreferences(remoteCore.preferences))
        : '';
      if (currentPreferencesFingerprint !== remotePreferencesFingerprint) {
        const remotePreferencesTime = coreTimestamp(
          remoteCore?.preferencesUpdatedAt,
          remoteCore?.preferencesUpdatedAtMs,
        );
        const preferencesUpdatedAt = Date.parse(metadata.preferencesUpdatedAt) <= remotePreferencesTime
          ? timestampAfter(metadata.preferencesUpdatedAt, remotePreferencesTime)
          : metadata.preferencesUpdatedAt;
        if (preferencesUpdatedAt !== metadata.preferencesUpdatedAt) {
          metadata = { ...metadata, preferencesUpdatedAt };
          metadataChanged = true;
        }
        writes.push(
          repository.writePreferences(preferencesRef.current, preferencesUpdatedAt, metadata.clientId),
        );
      }

      const dates = new Set([
        ...Object.keys(remoteLogsRef.current),
        ...Object.keys(logsRef.current),
        ...Object.keys(metadata.tombstones),
      ]);
      dates.forEach((date) => {
        const remoteDocument = remoteLogsRef.current[date];
        let localLog = nextLogs[date]
          ? syncModule.createWorkoutLogCandidate(normalizeLog(date, nextLogs[date]), metadata.clientId)
          : undefined;
        let tombstoneAt = metadata.tombstones[date];
        let localTombstone = tombstoneAt
          ? syncModule.createWorkoutTombstoneCandidate(date, tombstoneAt, metadata.clientId)
          : undefined;
        let localWinner = syncModule.chooseNewestWorkoutDocument(localLog, localTombstone);

        if (
          localWinner &&
          remoteDocument &&
          !cloudDocumentsHaveSameValue(remoteDocument, localWinner) &&
          syncModule.chooseNewestWorkoutDocument(remoteDocument, localWinner) !== localWinner
        ) {
          const bumpedAt = timestampAfter(localWinner.updatedAt, remoteDocument.updatedAtMs);
          if (localWinner.deleted) {
            tombstoneAt = bumpedAt;
            metadata = {
              ...metadata,
              tombstones: { ...metadata.tombstones, [date]: bumpedAt },
            };
            metadataChanged = true;
            localTombstone = syncModule.createWorkoutTombstoneCandidate(date, bumpedAt, metadata.clientId);
          } else {
            const bumpedLog = { ...localWinner.log, updatedAt: bumpedAt };
            nextLogs = { ...nextLogs, [date]: bumpedLog };
            logsChanged = true;
            localLog = syncModule.createWorkoutLogCandidate(bumpedLog, metadata.clientId);
          }
          localWinner = syncModule.chooseNewestWorkoutDocument(localLog, localTombstone);
        }

        if (
          !localWinner ||
          cloudDocumentsHaveSameValue(remoteDocument, localWinner) ||
          syncModule.chooseNewestWorkoutDocument(remoteDocument, localWinner) !== localWinner
        ) {
          return;
        }
        writes.push(
          localWinner.deleted
            ? repository.tombstoneLog(date, localWinner.updatedAt, metadata.clientId)
            : repository.writeLog(localWinner.log, metadata.clientId),
        );
      });

      if (metadataChanged) {
        metadataRef.current = metadata;
        saveSyncMetadata(metadata);
      }
      if (logsChanged) {
        logsRef.current = nextLogs;
        setLogs(nextLogs);
      }

      if (writes.length === 0) {
        if (!isCurrentRepository()) {
          return;
        }
        const cloudMetadata = cloudMetadataRef.current;
        if (cloudMetadata.fromCache || !navigator.onLine) {
          setStatus('offline');
        } else if (cloudMetadata.hasPendingWrites) {
          setStatus('syncing');
        } else {
          setStatus('synced');
          setError(null);
          setLastSyncedAt(new Date().toISOString());
        }
        return;
      }

      setStatus(navigator.onLine ? 'syncing' : 'offline');
      await Promise.all(writes);
      if (!isCurrentRepository()) {
        return;
      }
      if (navigator.onLine) {
        setStatus('synced');
        setError(null);
        setLastSyncedAt(new Date().toISOString());
      } else {
        setStatus('offline');
      }
    } catch (reason) {
      if (isCurrentRepository()) {
        reportError(reason);
      }
    }
  };

  const flushLocalChanges = async () => {
    const generation = repositoryGenerationRef.current;
    const currentFlush = flushInFlightRef.current;
    if (currentFlush && flushInFlightGenerationRef.current === generation) {
      flushAgainRef.current = true;
      await currentFlush;
      return;
    }

    const run = performFlush(generation);
    flushInFlightRef.current = run;
    flushInFlightGenerationRef.current = generation;
    try {
      await run;
    } finally {
      if (flushInFlightRef.current !== run) {
        return;
      }
      flushInFlightRef.current = null;
      const shouldRunAgain = flushAgainRef.current;
      flushAgainRef.current = false;
      if (shouldRunAgain && repositoryGenerationRef.current === generation) {
        void flushRef.current();
      }
    }
  };
  flushRef.current = flushLocalChanges;

  const queueFlush = () => {
    if (!readyRef.current || !repositoryRef.current) {
      return;
    }
    if (flushTimerRef.current !== undefined) {
      window.clearTimeout(flushTimerRef.current);
    }
    flushTimerRef.current = window.setTimeout(() => {
      flushTimerRef.current = undefined;
      void flushRef.current();
    }, SYNC_DEBOUNCE_MS);
  };

  useLayoutEffect(() => {
    const currentFingerprint = fingerprint(program);
    if (currentFingerprint !== metadataRef.current.programFingerprint) {
      const remoteCore = remoteCoreRef.current;
      metadataRef.current = {
        ...metadataRef.current,
        programFingerprint: currentFingerprint,
        programUpdatedAt: timestampAfter(
          metadataRef.current.programUpdatedAt,
          coreTimestamp(remoteCore?.programUpdatedAt, remoteCore?.programUpdatedAtMs),
        ),
      };
      saveSyncMetadata(metadataRef.current);
    }
    queueFlush();
  }, [program]);

  useLayoutEffect(() => {
    const currentFingerprint = fingerprint(preferences);
    if (currentFingerprint !== metadataRef.current.preferencesFingerprint) {
      const remoteCore = remoteCoreRef.current;
      metadataRef.current = {
        ...metadataRef.current,
        preferencesFingerprint: currentFingerprint,
        preferencesUpdatedAt: timestampAfter(
          metadataRef.current.preferencesUpdatedAt,
          coreTimestamp(remoteCore?.preferencesUpdatedAt, remoteCore?.preferencesUpdatedAtMs),
        ),
      };
      saveSyncMetadata(metadataRef.current);
    }
    queueFlush();
  }, [preferences]);

  useEffect(() => {
    let metadataChanged = false;
    let logsChanged = false;
    let nextLogs = logs;
    const previousLogs = previousLogsRef.current;
    const tombstones = { ...metadataRef.current.tombstones };
    Object.entries(logs).forEach(([date, log]) => {
      const tombstoneAt = tombstones[date];
      if (!tombstoneAt) {
        return;
      }

      if (!previousLogs[date]) {
        const bumpedLog = {
          ...log,
          updatedAt: timestampAfter(log.updatedAt, tombstoneAt, remoteLogsRef.current[date]?.updatedAtMs),
        };
        nextLogs = { ...nextLogs, [date]: bumpedLog };
        logsChanged = true;
        delete tombstones[date];
        metadataChanged = true;
      } else if (Date.parse(log.updatedAt) >= Date.parse(tombstoneAt)) {
        delete tombstones[date];
        metadataChanged = true;
      }
    });
    previousLogsRef.current = nextLogs;
    if (metadataChanged) {
      metadataRef.current = { ...metadataRef.current, tombstones };
      saveSyncMetadata(metadataRef.current);
    }
    if (logsChanged) {
      logsRef.current = nextLogs;
      setLogs(nextLogs);
    }
    queueFlush();
  }, [logs]);

  useEffect(() => {
    if (!isFirebaseConfigured) {
      setStatus('local');
      return undefined;
    }

    let cancelled = false;
    let unsubscribeAuth: (() => void) | undefined;
    let unsubscribeCloud: (() => void) | undefined;
    let authRevision = 0;

    const isCurrentConnection = (
      revision: number,
      generation: number,
      repository?: GymSyncRepository,
    ) => {
      return Boolean(
        !cancelled &&
          revision === authRevision &&
          generation === repositoryGenerationRef.current &&
          (!repository || repositoryRef.current === repository),
      );
    };

    const handleCloudSnapshot = (
      state: GymCloudState,
      uid: string,
      repository: GymSyncRepository,
      revision: number,
      generation: number,
    ) => {
      if (!isCurrentConnection(revision, generation, repository)) {
        return;
      }
      cloudMetadataRef.current = state.metadata;
      if (!readyRef.current && state.metadata.fromCache) {
        setStatus(navigator.onLine ? 'connecting' : 'offline');
        return;
      }

      applyCloudState(state, uid);
      if (state.metadata.fromCache || !navigator.onLine) {
        setStatus('offline');
      } else if (state.metadata.hasPendingWrites) {
        setStatus('syncing');
      } else {
        setStatus('synced');
        setError(null);
        setLastSyncedAt(new Date().toISOString());
      }
      queueFlush();
    };

    const connectUser = async (
      user: User,
      revision: number,
      generation: number,
      syncModule: GymSyncModule,
    ) => {
      setStatus('connecting');
      setError(null);
      const linkedAccountUid = metadataRef.current.accountUid;
      if (linkedAccountUid && linkedAccountUid !== user.uid) {
        reportError(new Error('This device is linked to a different Google account. Sign out and use the linked account.'));
        return;
      }

      const repository = await syncModule.createGymSyncRepository(user.uid);
      if (!repository || !isCurrentConnection(revision, generation)) {
        return;
      }
      repositoryRef.current = repository;
      const connectionUnsubscribe = repository.subscribe(
        (state) => handleCloudSnapshot(state, user.uid, repository, revision, generation),
        (reason) => {
          if (isCurrentConnection(revision, generation, repository)) {
            reportError(reason);
          }
        },
      );
      if (!isCurrentConnection(revision, generation, repository)) {
        connectionUnsubscribe();
        return;
      }
      unsubscribeCloud = connectionUnsubscribe;
    };

    void Promise.all([import('./firebase'), import('./gymSync')])
      .then(([firebaseModule, syncModule]) => {
        if (cancelled) {
          return undefined;
        }
        syncModuleRef.current = syncModule;
        return firebaseModule.observeFirebaseAuth(
          (user) => {
            authRevision += 1;
            const revision = authRevision;
            repositoryGenerationRef.current += 1;
            const generation = repositoryGenerationRef.current;
            unsubscribeCloud?.();
            unsubscribeCloud = undefined;
            repositoryRef.current = null;
            remoteCoreRef.current = null;
            remoteLogsRef.current = {};
            readyRef.current = false;
            flushAgainRef.current = false;
            if (flushTimerRef.current !== undefined) {
              window.clearTimeout(flushTimerRef.current);
              flushTimerRef.current = undefined;
            }
            setFirebaseUser(user);
            if (!user) {
              setStatus('local');
              setError(null);
              return;
            }
            void connectUser(user, revision, generation, syncModule).catch((reason) => {
              if (isCurrentConnection(revision, generation)) {
                reportError(reason);
              }
            });
          },
          (reason) => {
            if (!cancelled) {
              reportError(reason);
            }
          },
        );
      })
      .then((unsubscribe) => {
        if (!unsubscribe) {
          return;
        }
        if (cancelled) {
          unsubscribe();
        } else {
          unsubscribeAuth = unsubscribe;
        }
      })
      .catch((reason) => {
        if (!cancelled) {
          reportError(reason);
        }
      });

    return () => {
      cancelled = true;
      repositoryGenerationRef.current += 1;
      unsubscribeAuth?.();
      unsubscribeCloud?.();
      repositoryRef.current = null;
      syncModuleRef.current = null;
      readyRef.current = false;
      if (flushTimerRef.current !== undefined) {
        window.clearTimeout(flushTimerRef.current);
        flushTimerRef.current = undefined;
      }
    };
  }, [retryToken]);

  useEffect(() => {
    const handleOnline = () => {
      if (firebaseUser && readyRef.current) {
        setStatus('syncing');
        void flushRef.current();
      }
    };
    const handleOffline = () => {
      if (firebaseUser) {
        setStatus('offline');
      }
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [firebaseUser]);

  const markLogDeleted = (dateKey: string) => {
    const deletedAt = timestampAfter(
      logsRef.current[dateKey]?.updatedAt,
      remoteLogsRef.current[dateKey]?.updatedAtMs,
      metadataRef.current.tombstones[dateKey],
    );
    metadataRef.current = {
      ...metadataRef.current,
      tombstones: {
        ...metadataRef.current.tombstones,
        [dateKey]: deletedAt,
      },
    };
    saveSyncMetadata(metadataRef.current);
    setLogs((current) => {
      const next = { ...current };
      delete next[dateKey];
      logsRef.current = next;
      return next;
    });
    queueFlush();
  };

  const prepareImportedLogs = (dateKeys: string[]) => {
    const importedDates = new Set(dateKeys);
    const importedAt = timestampAfter(
      ...Object.values(logsRef.current).map((log) => log.updatedAt),
      ...Object.values(remoteLogsRef.current).map((document) => document.updatedAtMs),
      ...Object.values(metadataRef.current.tombstones),
    );
    const tombstones = Object.fromEntries(
      Object.entries(metadataRef.current.tombstones).filter(([date]) => !importedDates.has(date)),
    );
    metadataRef.current = { ...metadataRef.current, tombstones };
    saveSyncMetadata(metadataRef.current);
    return importedAt;
  };

  return {
    configured: isFirebaseConfigured,
    user: firebaseUser ? publicUser(firebaseUser) : null,
    status,
    error,
    lastSyncedAt,
    signIn: async () => {
      try {
        setStatus('connecting');
        setError(null);
        const firebaseModule = await import('./firebase');
        await firebaseModule.signInToFirebaseWithGoogle();
      } catch (reason) {
        reportError(reason);
      }
    },
    signOut: async () => {
      try {
        const firebaseModule = await import('./firebase');
        await firebaseModule.signOutOfFirebase();
      } catch (reason) {
        reportError(reason);
      }
    },
    retry: () => {
      setError(null);
      setStatus('connecting');
      setRetryToken((current) => current + 1);
    },
    markLogDeleted,
    prepareImportedLogs,
  };
}
