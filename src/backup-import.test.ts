import { describe, expect, it } from 'vitest';
import { backupImportConfirmation } from './backup-import';

describe('backup import confirmation', () => {
  it('discloses the synced scope and the workouts removed by an older backup', () => {
    const message = backupImportConfirmation(
      '2026-10-01T12:00:00.000Z', ['2026-10-01', '2026-10-03', '2026-10-04'], ['2026-09-30', '2026-10-01'], true,
    );
    expect(message).toContain('all signed-in devices');
    expect(message).toContain('1 added, 1 replaced, 2 removed');
    expect(message).toContain('program and settings will also be replaced');
  });

  it('describes a signed-out replacement as local to the device', () => {
    const message = backupImportConfirmation('2026-10-01T12:00:00.000Z', ['2026-10-04'], [], false);
    expect(message).toContain('saved on this device');
    expect(message).not.toContain('all signed-in devices');
    expect(message).toContain('0 added, 0 replaced, 1 removed');
  });
});
