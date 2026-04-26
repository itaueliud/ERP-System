/**
 * Compute the display status of a project from its DB status + dates.
 *
 * DB statuses: PENDING_APPROVAL | ACTIVE | ON_HOLD | COMPLETED | CANCELLED
 *
 * Display rules:
 *  - COMPLETED / CANCELLED          → "CLOSED"
 *  - PENDING_APPROVAL                → "PENDING_APPROVAL"  (unchanged)
 *  - ON_HOLD                         → "ON_HOLD"           (unchanged)
 *  - ACTIVE + start_date > today     → "UPCOMING"
 *  - ACTIVE + end_date < today       → "CLOSED"
 *  - ACTIVE (within dates / no dates)→ "ACTIVE"
 */
export function projectDisplayStatus(project: {
  status?: string;
  startDate?: string | Date | null;
  start_date?: string | Date | null;
  endDate?: string | Date | null;
  end_date?: string | Date | null;
}): string {
  const status = (project.status || '').toUpperCase();

  if (status === 'COMPLETED' || status === 'CANCELLED') return 'CLOSED';
  if (status === 'PENDING_APPROVAL') return 'PENDING_APPROVAL';
  if (status === 'ON_HOLD') return 'ON_HOLD';

  // For ACTIVE — check dates
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const rawStart = project.startDate ?? project.start_date;
  const rawEnd   = project.endDate   ?? project.end_date;

  const start = rawStart ? new Date(rawStart) : null;
  const end   = rawEnd   ? new Date(rawEnd)   : null;

  if (start && start > today) return 'UPCOMING';
  if (end   && end   < today) return 'CLOSED';

  return 'ACTIVE';
}
