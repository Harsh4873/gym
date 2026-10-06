export function backupImportConfirmation(
  exportedAt: string,
  currentDates: string[],
  importedDates: string[],
  synced: boolean,
) {
  const current = new Set(currentDates);
  const incoming = new Set(importedDates);
  const added = [...incoming].filter((date) => !current.has(date)).length;
  const replaced = [...incoming].filter((date) => current.has(date)).length;
  const removed = [...current].filter((date) => !incoming.has(date)).length;
  const scope = synced
    ? 'your synced Gym data on all signed-in devices'
    : 'the Gym data saved on this device';

  return `Replace ${scope} with the backup from ${new Date(exportedAt).toLocaleString()}?\n\n`
    + `Workouts: ${added} added, ${replaced} replaced, ${removed} removed.\n`
    + 'Your program and settings will also be replaced.';
}
