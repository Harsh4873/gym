export type SyncAccountProblem = 'missing-email' | 'unverified-email' | 'non-google-provider';

export interface SyncAccountClaims {
  email: string | null | undefined;
  emailVerified: boolean;
  signInProvider: string | null | undefined;
}

/** Match the shared rules exactly; an unavailable token must fail closed. */
export function syncAccountProblem(claims: SyncAccountClaims): SyncAccountProblem | null {
  if (!(claims.email ?? '').trim()) return 'missing-email';
  if (!claims.emailVerified) return 'unverified-email';
  return claims.signInProvider === 'google.com' ? null : 'non-google-provider';
}
