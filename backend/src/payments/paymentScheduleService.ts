import { db } from '../database/connection';

export type PaymentType =
  | 'AGENT_COMMISSION'   // Agents — every Friday 16:00–22:00
  | 'STAFF_SUPPORT'      // All staff — every Monday 16:00–22:00
  | 'SALARY'             // All payable staff — 2nd of each month
  | 'DEVELOPER_PAYMENT'  // Developer teams — approved by EA or CTO
  | 'GENERAL';

interface ScheduleWindow {
  dayOfWeek: number | null;   // 0=Sun … 6=Sat
  dayOfMonth: number | null;  // 1–31
  windowStart: string;        // 'HH:MM'
  windowEnd: string;
}

const SCHEDULE: Record<string, ScheduleWindow> = {
  AGENT_COMMISSION: { dayOfWeek: 5, dayOfMonth: null, windowStart: '16:00', windowEnd: '22:00' },
  STAFF_SUPPORT:    { dayOfWeek: 1, dayOfMonth: null, windowStart: '16:00', windowEnd: '22:00' },
  SALARY:           { dayOfWeek: null, dayOfMonth: 2, windowStart: '00:00', windowEnd: '23:59' },
};

/**
 * Check whether a given payment type is within its allowed processing window right now.
 * DEVELOPER_PAYMENT and GENERAL have no time restriction.
 */
export function isWithinPaymentWindow(paymentType: PaymentType, now: Date = new Date()): boolean {
  const schedule = SCHEDULE[paymentType];
  if (!schedule) return true; // DEVELOPER_PAYMENT, GENERAL — no restriction

  const day = now.getDay();           // 0=Sun … 6=Sat
  const date = now.getDate();         // 1–31
  const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  // Check day
  if (schedule.dayOfWeek !== null && day !== schedule.dayOfWeek) return false;
  if (schedule.dayOfMonth !== null && date !== schedule.dayOfMonth) return false;

  // Check time window
  return hhmm >= schedule.windowStart && hhmm <= schedule.windowEnd;
}

/**
 * Return a human-readable description of when a payment type is next allowed.
 */
export function getNextWindowDescription(paymentType: PaymentType): string {
  switch (paymentType) {
    case 'AGENT_COMMISSION': return 'Every Friday between 4:00 PM and 10:00 PM';
    case 'STAFF_SUPPORT':    return 'Every Monday between 4:00 PM and 10:00 PM';
    case 'SALARY':           return '2nd of every month (all day)';
    default:                 return 'Anytime';
  }
}

/**
 * Determine the payment type for a given requester role and purpose.
 * Used when creating a payment approval request.
 */
export function inferPaymentType(requesterRole: string, purpose: string): PaymentType {
  const p = purpose.toLowerCase();
  if (requesterRole === 'AGENT' || p.includes('commission') || p.includes('agent')) {
    return 'AGENT_COMMISSION';
  }
  if (p.includes('salary') || p.includes('salaries')) return 'SALARY';
  if (p.includes('support') || p.includes('allowance') || p.includes('welfare')) return 'STAFF_SUPPORT';
  if (requesterRole === 'DEVELOPER' || p.includes('developer') || p.includes('dev team')) {
    return 'DEVELOPER_PAYMENT';
  }
  return 'GENERAL';
}

/**
 * Get all agents with their commission data — for CFO payment dashboard.
 * CFO is responsible for paying agents every Friday.
 */
export async function getAgentsForCFO(): Promise<any[]> {
  const result = await db.query(
    `SELECT
       u.id, u.full_name, u.email, u.phone,
       u.payout_method, u.payout_phone, u.payout_bank_name, u.payout_bank_account,
       u.payout_updated_at,
       COUNT(DISTINCT c.id)                                    AS total_clients,
       COUNT(DISTINCT c.id) FILTER (WHERE c.status = 'CLOSED_WON') AS closed_deals,
       COALESCE(SUM(p.amount) FILTER (
         WHERE p.status = 'COMPLETED'
           AND p.created_at >= date_trunc('month', NOW())
       ), 0)                                                   AS commissions_this_month,
       COALESCE(SUM(p.amount) FILTER (WHERE p.status = 'COMPLETED'), 0) AS total_commissions
     FROM users u
     JOIN roles r ON r.id = u.role_id
     LEFT JOIN clients c ON c.agent_id = u.id
     LEFT JOIN payments p ON p.client_id = c.id
     WHERE r.name = 'AGENT' AND u.is_active = TRUE
     GROUP BY u.id
     ORDER BY u.full_name`
  );
  return result.rows;
}

/**
 * Get upcoming scheduled payments for the CFO dashboard.
 * Shows what needs to be processed this week.
 */
export function getUpcomingPaymentSchedule(now: Date = new Date()): Array<{
  type: PaymentType;
  label: string;
  nextWindow: string;
  isOpen: boolean;
}> {
  return [
    {
      type: 'AGENT_COMMISSION',
      label: 'Agent Commissions',
      nextWindow: 'Every Friday 4:00 PM – 10:00 PM',
      isOpen: isWithinPaymentWindow('AGENT_COMMISSION', now),
    },
    {
      type: 'STAFF_SUPPORT',
      label: 'Staff Support Payments',
      nextWindow: 'Every Monday 4:00 PM – 10:00 PM',
      isOpen: isWithinPaymentWindow('STAFF_SUPPORT', now),
    },
    {
      type: 'SALARY',
      label: 'Salaries',
      nextWindow: '2nd of every month',
      isOpen: isWithinPaymentWindow('SALARY', now),
    },
  ];
}

/**
 * Validate that a payment approval can be executed now based on its type.
 * Throws if outside the allowed window.
 */
export function assertPaymentWindowOpen(paymentType: PaymentType): void {
  if (!isWithinPaymentWindow(paymentType)) {
    const desc = getNextWindowDescription(paymentType);
    throw new Error(
      `This payment type (${paymentType}) can only be processed during its scheduled window: ${desc}`
    );
  }
}

export const paymentScheduleService = {
  isWithinPaymentWindow,
  getNextWindowDescription,
  inferPaymentType,
  getAgentsForCFO,
  getUpcomingPaymentSchedule,
  assertPaymentWindowOpen,
};
