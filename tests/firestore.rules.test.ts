import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestContext,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { readFile } from 'node:fs/promises';
import { deleteDoc, doc, getDoc, setDoc } from 'firebase/firestore';
import { afterAll, afterEach, beforeAll, beforeEach, describe, it } from 'vitest';

const PROJECT_ID = 'demo-gym';
const OWNER_UID = 'gym-user';
const TEST_EMAIL = 'user.one@example.com';
const EMULATOR_ADDRESS = process.env.FIRESTORE_EMULATOR_HOST;

function verifiedGoogleContext(
  environment: RulesTestEnvironment,
  uid = OWNER_UID,
  overrides: Record<string, unknown> = {},
): RulesTestContext {
  return environment.authenticatedContext(uid, {
    email: TEST_EMAIL,
    email_verified: true,
    firebase: { sign_in_provider: 'google.com' },
    ...overrides,
  });
}

function validLog(date = '2026-08-07', updatedAtMs = 1) {
  return {
    schemaVersion: 1,
    date,
    deleted: false,
    updatedAt: '2026-08-07T12:00:00.000Z',
    updatedAtMs,
    clientId: 'rules-test',
  };
}

describe.skipIf(!EMULATOR_ADDRESS)('Gym Firestore security rules', () => {
  let environment: RulesTestEnvironment;

  beforeAll(async () => {
    const [host, rawPort] = EMULATOR_ADDRESS!.split(':');
    const rules = await readFile(new URL('../firestore.rules', import.meta.url), 'utf8');
    environment = await initializeTestEnvironment({
      projectId: PROJECT_ID,
      firestore: { host, port: Number(rawPort), rules },
    });
  });

  beforeEach(async () => {
    await environment.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'owner_vault_members', OWNER_UID), {
        vaultId: OWNER_UID,
        schemaVersion: 1,
        status: 'active',
        legacyWritesEnabled: false,
      });
    });
  });

  afterEach(async () => environment.clearFirestore());
  afterAll(async () => environment.cleanup());

  it('allows only a provisioned verified Google account to use its Gym vault', async () => {
    const first = verifiedGoogleContext(environment).firestore();
    const secondUid = 'second-gym-user';
    const second = verifiedGoogleContext(environment, secondUid, {
      email: 'user.two@example.com',
    }).firestore();

    await assertSucceeds(setDoc(doc(first, 'users', OWNER_UID, 'gym', 'core'), { schemaVersion: 1 }));
    await assertSucceeds(setDoc(doc(first, 'users', OWNER_UID, 'logs', '2026-08-07'), validLog()));
    await assertFails(setDoc(doc(second, 'users', secondUid, 'gym', 'core'), { schemaVersion: 1 }));
    await assertFails(getDoc(doc(second, 'users', secondUid, 'gym', 'core')));
    await assertFails(getDoc(doc(second, 'users', OWNER_UID, 'gym', 'core')));
  });

  it('rejects signed-out, unverified, and non-Google sessions', async () => {
    const anonymous = environment.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(anonymous, 'users', OWNER_UID, 'gym', 'core')));

    const unverified = verifiedGoogleContext(environment, OWNER_UID, { email_verified: false }).firestore();
    await assertFails(getDoc(doc(unverified, 'users', OWNER_UID, 'gym', 'core')));

    const password = verifiedGoogleContext(environment, OWNER_UID, {
      firebase: { sign_in_provider: 'password' },
    }).firestore();
    await assertFails(getDoc(doc(password, 'users', OWNER_UID, 'gym', 'core')));
  });

  it('rejects malformed or stale logs and physical deletes', async () => {
    const firestore = verifiedGoogleContext(environment).firestore();
    const log = doc(firestore, 'users', OWNER_UID, 'logs', '2026-08-07');

    await assertFails(setDoc(log, validLog('wrong-date')));
    await assertSucceeds(setDoc(log, validLog('2026-08-07', 10)));
    await assertFails(setDoc(log, validLog('2026-08-07', 9)));
    await assertFails(deleteDoc(log));
  });

  it('keeps every sibling app namespace in the shared project ruleset', async () => {
    const firestore = verifiedGoogleContext(environment).firestore();
    const paths = [
      ['daymark_users', OWNER_UID],
      ['slate_users', OWNER_UID],
      ['fare_users', OWNER_UID, 'profile', 'current'],
      ['research_users', OWNER_UID, 'notes', 'note-1'],
      ['notes_users', OWNER_UID, 'settings', 'current'],
      ['recall_users', OWNER_UID, 'sets', 'set-1'],
    ] as const;

    for (const path of paths) await assertSucceeds(getDoc(doc(firestore, ...path)));
  });
});
