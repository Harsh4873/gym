import { describe, expect, it } from 'vitest';
import { DEFAULT_PREFERENCES, normalizePreferences } from './storage';

describe('preferences', () => {
  it('keeps the logbook on the full log unless checklist is stored', () => {
    expect(normalizePreferences(undefined).logbookView).toBe('log');
    expect(normalizePreferences({}).logbookView).toBe('log');
    expect(normalizePreferences({ logbookView: 'checklist' }).logbookView).toBe('checklist');
    expect(normalizePreferences({ logbookView: 'todo' }).logbookView).toBe('log');
    expect(normalizePreferences({ weeklySessionGoal: 4 }).weeklySessionGoal).toBe(4);
    expect(DEFAULT_PREFERENCES.logbookView).toBe('log');
  });
});
