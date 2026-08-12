import { describe, expect, it } from 'vitest';
import { syncAccountProblem } from './sync-account';

const verifiedGoogle = {
  email: 'owner@example.test',
  emailVerified: true,
  signInProvider: 'google.com',
};

describe('Gym sync account eligibility', () => {
  it('accepts a verified Google token', () => {
    expect(syncAccountProblem(verifiedGoogle)).toBeNull();
  });

  it('rejects missing and unverified email claims', () => {
    expect(syncAccountProblem({ ...verifiedGoogle, email: '' })).toBe('missing-email');
    expect(syncAccountProblem({ ...verifiedGoogle, emailVerified: false })).toBe('unverified-email');
  });

  it('rejects a non-Google session even when Google is linked', () => {
    expect(syncAccountProblem({ ...verifiedGoogle, signInProvider: 'password' }))
      .toBe('non-google-provider');
  });

  it('fails closed when token inspection is unavailable', () => {
    expect(syncAccountProblem({ ...verifiedGoogle, signInProvider: undefined }))
      .toBe('non-google-provider');
    expect(syncAccountProblem({ ...verifiedGoogle, signInProvider: null }))
      .toBe('non-google-provider');
  });
});
