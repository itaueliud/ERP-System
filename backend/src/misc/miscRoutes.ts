/**
 * Miscellaneous routes for features that don't have dedicated backend modules yet.
 * Covers: service-amounts, budget-requests, expense-reports, tech-funding-requests,
 *         liaison-requests, finance/tot-rate, trainers/performance, coo/achievements,
 *         admin-tasks, regions, countries, invitations (alias), approvals/service-amounts
 */
import { Router, Request, Response } from 'express';
import logger from '../utils/logger';

const router = Router();

// ─── Helper ───────────────────────────────────────────────────────────────────
const db = async () => (await import('../database/connection')).db;

const safeQuery = async (sql: string, params: any[] = []) => {
  try {
    const d = await db();
    return await d.query(sql, params);
  } catch {
    return { rows: [] };
  }
};

// ─── Service Amounts ──────────────────────────────────────────────────────────
router.get('/service-amounts', async (_req, res) => {
  const r = await safeQuery(`SELECT id, service_name as "serviceName", current_amount as "currentAmount", status, updated_at as "updatedAt" FROM service_amounts ORDER BY service_name`);
  res.json({ success: true, data: r.rows });
});

router.post('/service-amounts/:id/propose', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { newAmount, reason } = req.body;
    const requestedBy = (req as any).user?.id;
    await safeQuery(
      `INSERT INTO service_amount_changes (service_amount_id, new_amount, reason, requested_by, status, created_at)
       VALUES ($1, $2, $3, $4, 'PENDING', NOW())`,
      [id, newAmount, reason, requestedBy]
    );
    res.json({ success: true, message: 'Proposal submitted for CEO approval' });
  } catch (e: any) {
    res.status(400).json({ success: false, error: e.message || 'Failed to propose change' });
  }
});

router.post('/service-amounts/:id/approve', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { newAmount, reason } = req.body;
    await safeQuery(`UPDATE service_amounts SET current_amount = $1, updated_at = NOW() WHERE id = $2`, [newAmount, id]);
    logger.info('Service amount approved', { id, newAmount, reason });
    res.json({ success: true, message: 'Amount updated' });
  } catch (e: any) {
    res.status(400).json({ success: false, error: e.message || 'Failed to update amount' });
  }
});

router.get('/approvals/service-amounts', async (_req, res) => {
  const r = await safeQuery(
    `SELECT sac.id, sa.service_name as "clientName", sac.new_amount as "requestedAmount",
            sac.reason, sac.status, sac.created_at as "createdAt"
     FROM service_amount_changes sac
     JOIN service_amounts sa ON sa.id = sac.service_amount_id
     WHERE sac.status = 'PENDING'
     ORDER BY sac.created_at DESC`
  );
  res.json({ success: true, data: r.rows });
});

router.post('/service-amounts/changes/:id/:action', async (req: Request, res: Response) => {
  const { id, action } = req.params;
  const status = action === 'approve' ? 'APPROVED' : 'REJECTED';
  await safeQuery(`UPDATE service_amount_changes SET status = $1 WHERE id = $2`, [status, id]);
  res.json({ success: true });
});

// ─── Budget Requests ──────────────────────────────────────────────────────────
router.get('/budget-requests', async (req, res) => {
  const userId = (req as any).user?.id;
  const role = (req as any).user?.role;
  const canSeeAll = ['CFO', 'CoS', 'CEO', 'CFO_ASSISTANT'].includes(role);

  const r = canSeeAll
    ? await safeQuery(
        `SELECT br.id, u.full_name AS requester, br.amount, br.purpose, br.department, br.status, br.created_at as "createdAt"
         FROM budget_requests br
         LEFT JOIN users u ON u.id = br.requester_id
         ORDER BY br.created_at DESC`
      )
    : await safeQuery(
        `SELECT br.id, u.full_name AS requester, br.amount, br.purpose, br.department, br.status, br.created_at as "createdAt"
         FROM budget_requests br
         LEFT JOIN users u ON u.id = br.requester_id
         WHERE br.requester_id = $1
         ORDER BY br.created_at DESC`,
        [userId]
      );
  res.json({ success: true, data: r.rows });
});

router.post('/budget-requests', async (req: Request, res: Response) => {
  try {
    const { amount, purpose, department } = req.body;
    const requestedBy = (req as any).user?.id;
    const r = await safeQuery(
      `INSERT INTO budget_requests (requester_id, amount, purpose, department, status, created_at)
       VALUES ($1, $2, $3, $4, 'PENDING', NOW()) RETURNING id`,
      [requestedBy, amount, purpose, department]
    );

    // Notify CFO and CoS about the new budget request
    const { notificationService, NotificationType, NotificationPriority } = await import('../notifications/notificationService');
    const approvers = await safeQuery(
      `SELECT u.id FROM users u JOIN roles r ON r.id = u.role_id WHERE r.name IN ('CFO', 'CoS') AND u.is_active = TRUE`
    );
    const requesterResult = await safeQuery(`SELECT full_name FROM users WHERE id = $1`, [requestedBy]);
    const requesterName = requesterResult.rows[0]?.full_name || 'A team member';
    for (const approver of approvers.rows) {
      notificationService.sendNotification({
        userId: approver.id,
        type: NotificationType.PAYMENT_APPROVAL,
        priority: NotificationPriority.HIGH,
        title: 'New Budget Request',
        message: `${requesterName} submitted a budget request of KSh ${Number(amount).toLocaleString()} for: ${purpose}`,
      }).catch(() => {});
    }

    res.status(201).json({ success: true, data: r.rows[0] });
  } catch (e: any) {
    res.status(400).json({ success: false, error: e.message || 'Failed to submit budget request' });
  }
});

router.post('/budget-requests/:id/:action', async (req: Request, res: Response) => {
  const { id, action } = req.params;
  const status = action === 'approve' ? 'APPROVED' : 'REJECTED';
  await safeQuery(`UPDATE budget_requests SET status = $1, reviewed_by = $2, reviewed_at = NOW() WHERE id = $3`, [status, (req as any).user?.id, id]);

  // Notify the requester
  try {
    const { notificationService, NotificationType, NotificationPriority } = await import('../notifications/notificationService');
    const br = await safeQuery(`SELECT requester_id, purpose, amount FROM budget_requests WHERE id = $1`, [id]);
    if (br.rows.length > 0) {
      const { requester_id, purpose, amount } = br.rows[0];
      notificationService.sendNotification({
        userId: requester_id,
        type: NotificationType.PAYMENT_APPROVAL,
        priority: NotificationPriority.HIGH,
        title: `Budget Request ${status === 'APPROVED' ? 'Approved' : 'Rejected'}`,
        message: `Your budget request of KSh ${Number(amount).toLocaleString()} for "${purpose}" has been ${status.toLowerCase()}.`,
      }).catch(() => {});
    }
  } catch { /* non-blocking */ }

  res.json({ success: true });
});

// Execute an approved budget request (CFO / CoS only)
router.post('/budget-requests/:id/execute', async (req: Request, res: Response) => {
  const { id } = req.params;
  const executorId = (req as any).user?.id;
  const executorRole = (req as any).user?.role;

  if (!['CFO', 'CoS', 'CEO'].includes(executorRole)) {
    return res.status(403).json({ success: false, error: 'Only CFO, CoS or CEO can execute budget requests' });
  }

  const existing = await safeQuery(`SELECT status, requester_id, purpose, amount FROM budget_requests WHERE id = $1`, [id]);
  if (!existing.rows.length) return res.status(404).json({ success: false, error: 'Budget request not found' });
  if (existing.rows[0].status !== 'APPROVED') {
    return res.status(400).json({ success: false, error: 'Only approved budget requests can be executed' });
  }

  await safeQuery(
    `UPDATE budget_requests SET status = 'EXECUTED', executed_by = $1, executed_at = NOW() WHERE id = $2`,
    [executorId, id]
  );

  // Notify the requester
  try {
    const { notificationService, NotificationType, NotificationPriority } = await import('../notifications/notificationService');
    const { requester_id, purpose, amount } = existing.rows[0];
    notificationService.sendNotification({
      userId: requester_id,
      type: NotificationType.PAYMENT_APPROVAL,
      priority: NotificationPriority.HIGH,
      title: 'Budget Request Executed',
      message: `Your approved budget request of KSh ${Number(amount).toLocaleString()} for "${purpose}" has been executed — funds released.`,
    }).catch(() => {});
  } catch { /* non-blocking */ }

  return res.json({ success: true });
});

// ─── Expense Reports ──────────────────────────────────────────────────────────
router.get('/expense-reports', async (req, res) => {
  const userId = (req as any).user?.id;
  const r = await safeQuery(
    `SELECT er.id, er.amount, er.category, er.description, er.status, er.created_at as "createdAt"
     FROM expense_reports er
     WHERE er.requester_id = $1
     ORDER BY er.created_at DESC`,
    [userId]
  );
  res.json({ success: true, data: r.rows });
});

router.post('/expense-reports', async (req: Request, res: Response) => {
  try {
    const { amount, category, description } = req.body;
    const submittedBy = (req as any).user?.id;
    const r = await safeQuery(
      `INSERT INTO expense_reports (requester_id, amount, category, description, status, created_at)
       VALUES ($1, $2, $3, $4, 'PENDING', NOW()) RETURNING id`,
      [submittedBy, amount, category, description]
    );
    res.status(201).json({ success: true, data: r.rows[0] });
  } catch (e: any) {
    res.status(400).json({ success: false, error: e.message || 'Failed to submit expense report' });
  }
});

// ─── Tech Funding Requests ────────────────────────────────────────────────────
router.get('/tech-funding-requests', async (_req, res) => {
  const r = await safeQuery(
    `SELECT t.id, t.project, t.amount, t.justification, t.status,
            t.created_at as "createdAt",
            u.full_name as "requesterName", u.email as "requesterEmail"
     FROM tech_funding_requests t
     LEFT JOIN users u ON u.id = t.requested_by
     ORDER BY t.created_at DESC`
  );
  res.json({ success: true, data: r.rows });
});

router.post('/tech-funding-requests', async (req: Request, res: Response) => {
  try {
    const { project, amount, justification } = req.body;
    const requestedBy = (req as any).user?.id;
    const r = await safeQuery(
      `INSERT INTO tech_funding_requests (project, amount, justification, status, requested_by, created_at)
       VALUES ($1, $2, $3, 'PENDING', $4, NOW()) RETURNING id`,
      [project, amount, justification, requestedBy]
    );
    res.status(201).json({ success: true, data: r.rows[0] });
  } catch (e: any) {
    res.status(400).json({ success: false, error: e.message || 'Failed to submit funding request' });
  }
});

router.patch('/tech-funding-requests/:id/:action', async (req: Request, res: Response) => {
  try {
    const { id, action } = req.params;
    const approverId = (req as any).user?.id;
    const approverRole = (req as any).user?.role;
    const allowed = ['CEO', 'CoS', 'CFO', 'COO'];
    if (!allowed.includes(approverRole)) {
      return res.status(403).json({ success: false, error: 'Not authorised to approve tech funding' });
    }
    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ success: false, error: 'Action must be approve or reject' });
    }
    const newStatus = action === 'approve' ? 'APPROVED' : 'REJECTED';
    const { rejectionReason } = req.body;
    const r = await safeQuery(
      `UPDATE tech_funding_requests
       SET status = $1, approved_by = $2, approved_at = NOW(), rejection_reason = $3
       WHERE id = $4 RETURNING id, status`,
      [newStatus, approverId, rejectionReason || null, id]
    );
    if (!r.rows.length) return res.status(404).json({ success: false, error: 'Request not found' });
    return res.json({ success: true, data: r.rows[0] });
  } catch (e: any) {
    return res.status(400).json({ success: false, error: e.message || 'Failed to update request' });
  }
});

// ─── Finance / ToT Rate ───────────────────────────────────────────────────────
router.put('/finance/tot-rate', async (req: Request, res: Response) => {
  try {
    const { rate } = req.body;
    await safeQuery(
      `INSERT INTO system_settings (key, value, updated_at) VALUES ('tot_rate', $1, NOW())
       ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()`,
      [String(rate)]
    );
    res.json({ success: true, message: 'ToT rate updated' });
  } catch (e: any) {
    res.status(400).json({ success: false, error: e.message || 'Failed to update ToT rate' });
  }
});

// ─── Trainers Performance ─────────────────────────────────────────────────────
router.get('/trainers/performance', async (_req, res) => {
  const r = await safeQuery(
    `SELECT u.id, u.full_name AS name, u.email, u.country,
            COUNT(DISTINCT ag.id)  AS "agentsCount",
            COUNT(DISTINCT cl.id)  AS "assignedClients"
     FROM users u
     JOIN roles ro ON ro.id = u.role_id
     LEFT JOIN users ag ON ag.trainer_id = u.id
     LEFT JOIN clients cl ON cl.trainer_id = u.id
       AND cl.status IN ('NEGOTIATION', 'CONVERTED', 'LEAD_ACTIVATED', 'LEAD_QUALIFIED')
     WHERE ro.name IN ('TRAINER', 'HEAD_OF_TRAINERS')
       AND u.is_active = TRUE
     GROUP BY u.id, u.full_name, u.email, u.country
     ORDER BY u.full_name ASC`
  );
  res.json({ success: true, data: r.rows });
});

// ─── Agents Performance (CFO / CoS view) ─────────────────────────────────────
router.get('/agents/performance', async (_req, res) => {
  const r = await safeQuery(
    `SELECT u.id, u.full_name as name, u.country, u.email,
            u.payout_method as "payoutMethod",
            u.payout_phone as "payoutPhone",
            u.payout_bank_name as "payoutBankName",
            u.payout_bank_account as "payoutBankAccount",
            COUNT(DISTINCT c.id) as "totalClients",
            COUNT(DISTINCT c.id) FILTER (WHERE c.status = 'CLOSED_WON') as "closedDeals",
            COALESCE(SUM(p.amount) FILTER (WHERE p.status = 'COMPLETED'), 0) as "totalCommissions"
     FROM users u
     JOIN roles r ON r.id = u.role_id AND r.name = 'AGENT'
     LEFT JOIN clients c ON c.agent_id = u.id
     LEFT JOIN payments p ON p.client_id = c.id
     WHERE u.is_active = TRUE
     GROUP BY u.id ORDER BY u.full_name`
  );
  res.json({ success: true, data: r.rows });
});

// ─── Marketing Leads ──────────────────────────────────────────────────────────
router.get('/marketing/leads', async (_req, res) => {
  const r = await safeQuery(
    `SELECT id, name, email, phone, country, status, created_at as "createdAt"
     FROM clients WHERE status IN ('NEW_LEAD','CONVERTED','LEAD_ACTIVATED','LEAD_QUALIFIED')
     ORDER BY created_at DESC LIMIT 100`
  );
  res.json({ success: true, data: r.rows });
});

// ─── COO Achievements ─────────────────────────────────────────────────────────
router.get('/coo/achievements', async (_req, res) => {
  const r = await safeQuery(
    `SELECT id, country, achievement, value, period, created_at as "createdAt"
     FROM coo_achievements ORDER BY created_at DESC`
  );
  res.json({ success: true, data: r.rows });
});

// ─── Admin Tasks ──────────────────────────────────────────────────────────────
router.get('/admin-tasks', async (_req, res) => {
  const r = await safeQuery(
    `SELECT id, title, description, status, priority, due_date as "dueDate", assigned_to as "assignedTo"
     FROM admin_tasks ORDER BY created_at DESC`
  );
  res.json({ success: true, data: r.rows });
});

// ─── Regions ──────────────────────────────────────────────────────────────────
router.get('/regions', async (_req, res) => {
  const r = await safeQuery(
    `SELECT id, name, type, status FROM regions ORDER BY name`
  );
  res.json({ success: true, data: r.rows });
});

router.post('/regions', async (req: Request, res: Response) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ success: false, error: 'name is required' });
    const r = await safeQuery(
      `INSERT INTO regions (name, type, status, created_at) VALUES ($1, 'REGION', 'ACTIVE', NOW()) RETURNING id, name, type, status`,
      [name]
    );
    return res.status(201).json({ success: true, data: r.rows[0] });
  } catch (e: any) {
    return res.status(400).json({ success: false, error: e.message || 'Failed to add region' });
  }
});

// ─── Countries ────────────────────────────────────────────────────────────────
router.post('/countries', async (req: Request, res: Response) => {
  try {
    const { name, regionId } = req.body;
    if (!name) return res.status(400).json({ success: false, error: 'name is required' });
    const r = await safeQuery(
      `INSERT INTO regions (name, type, status, parent_id, created_at) VALUES ($1, 'COUNTRY', 'ACTIVE', $2, NOW()) RETURNING id, name, type, status`,
      [name, regionId || null]
    );
    return res.status(201).json({ success: true, data: r.rows[0] });
  } catch (e: any) {
    return res.status(400).json({ success: false, error: e.message || 'Failed to add country' });
  }
});

// ─── Invitations (alias → /api/v1/users/invite) ───────────────────────────────
router.post('/invitations', async (req: Request, res: Response) => {
  try {
    const { email, role } = req.body;
    if (!email) return res.status(400).json({ success: false, error: 'email is required' });
    const inviter = (req as any).user;
    if (!inviter?.id) return res.status(401).json({ success: false, error: 'Unauthorized' });

    // Look up roleId from role name
    const d = await db();
    const roleResult = await d.query('SELECT id FROM roles WHERE name = $1', [role || 'CFO_ASSISTANT']);
    if (roleResult.rows.length === 0) {
      return res.status(400).json({ success: false, error: `Role "${role}" not found` });
    }
    const roleId = roleResult.rows[0].id;

    const { userService } = await import('../users/userService');
    const invitation = await userService.sendInvitation({ email, roleId, invitedBy: inviter.id });
    return res.status(201).json({ success: true, data: { id: invitation.id, email: invitation.email } });
  } catch (e: any) {
    logger.error('Failed to send invitation via /invitations', { error: e });
    return res.status(400).json({ success: false, error: e.message || 'Failed to send invitation' });
  }
});

// ─── Commissions ──────────────────────────────────────────────────────────────
router.get('/commissions', async (_req, res) => {
  const r = await safeQuery(
    `SELECT id, agent_id as "agentId", agent_name as "agentName", amount, type, status, created_at as "createdAt"
     FROM commissions ORDER BY created_at DESC`
  );
  res.json({ success: true, data: r.rows });
});

router.get('/commissions/me', async (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  const r = await safeQuery(
    `SELECT id, client_id as "clientId", client_name as "clientName",
            amount, commission_rate as "commissionRate", status,
            paid_at as "paidAt", created_at as "createdAt"
     FROM agent_commissions WHERE agent_id = $1 ORDER BY created_at DESC`,
    [userId]
  );
  res.json({ success: true, data: r.rows });
});

// ─── GitHub ───────────────────────────────────────────────────────────────────
router.get('/github/repos', async (_req, res) => {
  const r = await safeQuery(
    `SELECT id, name, full_name as "fullName", language, stars, open_prs as "openPRs",
            open_issues as "openIssues", last_commit as "lastCommit", pushed_at as "pushedAt"
     FROM github_repos ORDER BY pushed_at DESC`
  );
  res.json({ success: true, data: r.rows });
});

router.get('/github/commits', async (_req, res) => {
  const r = await safeQuery(
    `SELECT sha, message, author, additions, deletions, committed_at as "committedAt"
     FROM github_commits ORDER BY committed_at DESC LIMIT 50`
  );
  res.json({ success: true, data: r.rows });
});

router.get('/github/contributions', async (_req, res) => {
  const r = await safeQuery(
    `SELECT user_id as "userId", name, commits, additions, deletions, pull_requests as "pullRequests"
     FROM github_contributions ORDER BY commits DESC`
  );
  res.json({ success: true, data: r.rows });
});

// ─── Security Alerts ─────────────────────────────────────────────────────────
router.get('/security/alerts', async (_req, res) => {
  // Proxy to audit-logs security-alerts
  const r = await safeQuery(
    `SELECT id, type, title, description, severity, status, created_at as "createdAt"
     FROM security_alerts ORDER BY created_at DESC LIMIT 20`
  );
  res.json({ success: true, data: r.rows });
});

// ─── Audit aliases ────────────────────────────────────────────────────────────
router.get('/audit/trail', async (_req, res) => {
  const r = await safeQuery(
    `SELECT id, user_id as "userId", action, resource_type as "resourceType",
            old_value as "oldValue", new_value as "newValue", created_at as "timestamp"
     FROM audit_logs ORDER BY created_at DESC LIMIT 100`
  );
  res.json({ success: true, data: r.rows });
});

router.get('/audit/alerts', async (_req, res) => {
  const r = await safeQuery(
    `SELECT id, type, description, severity, created_at as "createdAt"
     FROM security_alerts WHERE severity IN ('HIGH','CRITICAL') ORDER BY created_at DESC LIMIT 20`
  );
  res.json({ success: true, data: r.rows });
});

router.get('/audit/fraud-flags', async (_req, res) => {
  const r = await safeQuery(
    `SELECT id, flagged_by as "flaggedBy", description, severity, created_at as "createdAt"
     FROM fraud_flags ORDER BY created_at DESC LIMIT 50`
  );
  res.json({ success: true, data: r.rows });
});

// ─── Finance ──────────────────────────────────────────────────────────────────
router.get('/finance/cash-flow', async (_req, res) => {
  const r = await safeQuery(
    `SELECT date, inflow, outflow, net_flow as "netFlow" FROM cash_flow ORDER BY date DESC LIMIT 30`
  );
  res.json({ success: true, data: r.rows });
});

router.get('/finance/invoices', async (_req, res) => {
  const r = await safeQuery(
    `SELECT id, invoice_number as "invoiceNumber", client, amount, status, due_date as "dueDate"
     FROM invoices ORDER BY created_at DESC`
  );
  res.json({ success: true, data: r.rows });
});

router.get('/finance/ledger', async (_req, res) => {
  const r = await safeQuery(
    `SELECT id, date, description, debit, credit, balance FROM ledger_entries ORDER BY date DESC LIMIT 100`
  );
  res.json({ success: true, data: r.rows });
});

// ─── Reports (additional) ─────────────────────────────────────────────────────
router.get('/reports/compliance', async (_req, res) => {
  const r = await safeQuery(
    `SELECT id, title, report_name as "reportName", period, report_period as "reportPeriod",
            description, summary, status, pdf_url as "pdfUrl", created_at as "createdAt"
     FROM compliance_reports ORDER BY created_at DESC`
  );
  res.json({ success: true, data: r.rows });
});

router.get('/reports/compliance/:id', async (req: Request, res: Response) => {
  const r = await safeQuery(`SELECT * FROM compliance_reports WHERE id = $1`, [req.params.id]);
  if (!r.rows.length) return res.status(404).json({ success: false, error: 'Not found' });
  return res.json({ success: true, data: r.rows[0] });
});

router.get('/reports/compliance/:id/download', async (req: Request, res: Response) => {
  const r = await safeQuery(`SELECT pdf_url as "pdfUrl" FROM compliance_reports WHERE id = $1`, [req.params.id]);
  res.json({ success: true, data: { pdfUrl: r.rows[0]?.pdfUrl || null } });
});

router.get('/reports/paye', async (_req, res) => {
  const r = await safeQuery(
    `SELECT id, period, type, amount, status FROM paye_records ORDER BY period DESC`
  );
  res.json({ success: true, data: r.rows });
});

router.get('/reports/pl', async (_req, res) => {
  const r = await safeQuery(
    `SELECT month, revenue, expenses, profit FROM pl_reports ORDER BY month DESC LIMIT 12`
  );
  res.json({ success: true, data: r.rows });
});

router.get('/reports/tax', async (_req, res) => {
  const r = await safeQuery(
    `SELECT id, period, type, amount, status FROM tax_reports ORDER BY period DESC`
  );
  res.json({ success: true, data: r.rows });
});

router.get('/reports/tax/generate', async (_req, res) => {
  res.json({ success: true, data: { url: null, message: 'Tax report generation queued' } });
});

// ─── Training (additional) ────────────────────────────────────────────────────
router.get('/training/agent-records', async (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  const userRole = (req as any).user?.role;

  // HEAD_OF_TRAINERS: return all agents under trainers in their country
  // TRAINER: return only their own directly assigned agents
  let query: string;
  let params: any[];

  if (userRole === 'HEAD_OF_TRAINERS') {
    query = `
      SELECT a.id, u.full_name as name, a.phone, a.status,
             a.performance_score as "performanceScore",
             a.trainer_id as "trainerId",
             tu.full_name as "trainerName",
             a.created_at as "createdAt"
      FROM agents a
      LEFT JOIN users u ON u.id = a.user_id
      LEFT JOIN users tu ON tu.id = a.trainer_id
      JOIN users hot ON hot.id = $1
      WHERE tu.country = hot.country
      ORDER BY a.created_at DESC`;
    params = [userId];
  } else {
    query = `
      SELECT a.id, u.full_name as name, a.phone, a.status,
             a.performance_score as "performanceScore",
             a.trainer_id as "trainerId", a.created_at as "createdAt"
      FROM agents a
      LEFT JOIN users u ON u.id = a.user_id
      WHERE a.trainer_id = $1
      ORDER BY a.created_at DESC`;
    params = [userId];
  }

  const r = await safeQuery(query, params);
  res.json({ success: true, data: r.rows });
});

router.get('/training/assignments', async (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  const r = await safeQuery(
    `SELECT ta.id, tc.title as "courseTitle", tc.description, tc.duration_hours as "durationHours",
            ta.status, ta.progress, ta.due_date as "dueDate",
            ta.started_at as "startedAt", ta.completed_at as "completedAt",
            ta.assigned_at as "assignedAt"
     FROM training_assignments ta
     JOIN training_courses tc ON tc.id = ta.course_id
     WHERE ta.agent_id = $1
     ORDER BY ta.assigned_at DESC`,
    [userId]
  );
  res.json({ success: true, data: r.rows });
});

// ─── Cost Approvals ───────────────────────────────────────────────────────────
router.get('/cost-approvals', async (_req, res) => {
  const r = await safeQuery(
    `SELECT id, description, amount, approved_by as "approvedBy", status, created_at as "createdAt"
     FROM cost_approvals ORDER BY created_at DESC`
  );
  res.json({ success: true, data: r.rows });
});

// ─── Achievements ─────────────────────────────────────────────────────────────
router.get('/achievements', async (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  const r = await safeQuery(
    `SELECT id, trainer_name as "trainerName", country, achievement, period, created_at as "createdAt"
     FROM trainer_achievements
     WHERE trainer_id = $1 OR $1 IS NULL
     ORDER BY created_at DESC`,
    [userId]
  );
  res.json({ success: true, data: r.rows });
});

// ─── Dashboard agent-metrics ──────────────────────────────────────────────────
router.get('/dashboard/agent-metrics', async (req: Request, res: Response) => {
  const userId = (req as any).user?.id;

  const clientsR = await safeQuery(
    `SELECT
       COUNT(*) FILTER (WHERE status = 'NEW_LEAD')       AS "newLeads",
       COUNT(*) FILTER (WHERE status = 'CONVERTED')      AS "converted",
       COUNT(*) FILTER (WHERE status = 'LEAD_ACTIVATED') AS "leadActivated",
       COUNT(*) FILTER (WHERE status = 'LEAD_QUALIFIED') AS "leadQualified",
       COUNT(*) FILTER (WHERE status = 'NEGOTIATION')    AS "negotiation",
       COUNT(*) FILTER (WHERE status = 'CLOSED_WON')     AS "closedDeals",
       COUNT(*)                                           AS "totalClients"
     FROM clients WHERE agent_id = $1`,
    [userId]
  );

  const commR = await safeQuery(
    `SELECT
       COALESCE(SUM(amount), 0)                              AS "totalCommissions",
       COALESCE(SUM(amount) FILTER (WHERE status='PENDING'), 0) AS "pendingCommissions"
     FROM agent_commissions WHERE agent_id = $1`,
    [userId]
  );

  const trainingR = await safeQuery(
    `SELECT
       COUNT(*) FILTER (WHERE ta.status = 'COMPLETED') AS "completedCourses",
       COUNT(*)                                         AS "totalCourses",
       COALESCE(AVG(ta.progress), 0)                   AS "avgProgress"
     FROM training_assignments ta WHERE ta.agent_id = $1`,
    [userId]
  );

  const c = clientsR.rows[0] || {};
  const cm = commR.rows[0] || {};
  const tr = trainingR.rows[0] || {};

  const totalClients   = Number(c.totalClients   || 0);
  const closedDeals    = Number(c.closedDeals    || 0);
  const totalComm      = Number(cm.totalCommissions || 0);
  const pendingComm    = Number(cm.pendingCommissions || 0);
  const avgProgress    = Number(tr.avgProgress   || 0);
  const completedCourses = Number(tr.completedCourses || 0);
  const totalCourses   = Number(tr.totalCourses  || 0);

  // KPI: weighted score from closed deals, training progress, client count
  const kpiScore = totalClients === 0 && totalCourses === 0 ? null :
    Math.min(100, Math.round(
      (closedDeals / Math.max(totalClients, 1)) * 40 +
      avgProgress * 0.4 +
      Math.min(totalClients / 10, 1) * 20
    ));

  res.json({
    success: true,
    data: {
      totalClients,
      closedDeals,
      totalCommissions:   totalComm,
      pendingCommissions: pendingComm,
      trainingProgress:   Math.round(avgProgress),
      completedCourses,
      totalCourses,
      kpiScore,
      // pipeline breakdown
      newLeads:      Number(c.newLeads      || 0),
      converted:     Number(c.converted     || 0),
      leadActivated: Number(c.leadActivated || 0),
      leadQualified: Number(c.leadQualified || 0),
      negotiation:   Number(c.negotiation   || 0),
      // placeholder metrics (can be wired to real data later)
      attendanceRate:     null,
      clientSatisfaction: null,
    },
  });
});

// ─── Chat messages (alias) ────────────────────────────────────────────────────
router.post('/chat/messages', async (req: Request, res: Response) => {
  try {
    const { message, type } = req.body;
    const senderId = (req as any).user?.id;
    if (!message) return res.status(400).json({ success: false, error: 'message is required' });
    await safeQuery(
      `INSERT INTO chat_messages (sender_id, message, type, created_at) VALUES ($1, $2, $3, NOW())`,
      [senderId, message, type || 'INTERNAL']
    );
    return res.status(201).json({ success: true, message: 'Message sent' });
  } catch (e: any) {
    return res.status(400).json({ success: false, error: e.message || 'Failed to send message' });
  }
});

// ─── Communications (standalone, not client-scoped) ───────────────────────────
router.get('/communications', async (_req, res) => {
  const r = await safeQuery(
    `SELECT id, client_id as "clientId", type, summary, outcome, communication_date as "communicationDate"
     FROM communications ORDER BY communication_date DESC LIMIT 50`
  );
  res.json({ success: true, data: r.rows });
});

// ─── Reports tax submit ───────────────────────────────────────────────────────
router.post('/reports/tax/submit', async (req: Request, res: Response) => {
  try {
    const { period, items } = req.body;
    const submittedBy = (req as any).user?.id;
    for (const item of (items || [])) {
      await safeQuery(
        `INSERT INTO tax_reports (period, type, amount, status, submitted_by, created_at)
         VALUES ($1, $2, $3, 'FILED', $4, NOW())
         ON CONFLICT (period, type) DO UPDATE SET amount = $3, status = 'FILED'`,
        [period, item.type, item.amount, submittedBy]
      );
    }
    res.json({ success: true, message: `Tax report for ${period} submitted` });
  } catch (e: any) {
    res.status(400).json({ success: false, error: e.message || 'Failed to submit tax report' });
  }
});

// ─── Liaison Requests (Client Success → CTO team, doc §4 Dept 2) ─────────────
router.post('/liaison-requests', async (req: Request, res: Response) => {
  try {
    const { clientId, brief, priority } = req.body;
    const requesterId = (req as any).user?.id;
    if (!clientId || !brief) return res.status(400).json({ error: 'clientId and brief are required' });
    const r = await safeQuery(
      `INSERT INTO liaison_requests (requester_id, client_id, brief, priority, status, created_at)
       VALUES ($1, $2, $3, $4, 'PENDING', NOW()) RETURNING id`,
      [requesterId, clientId, brief, priority || 'MEDIUM']
    );
    return res.status(201).json({ success: true, data: r.rows[0] });
  } catch (e: any) {
    return res.status(400).json({ success: false, error: e.message || 'Failed to send brief' });
  }
});

router.get('/liaison-requests', async (_req, res) => {
  const r = await safeQuery(
    `SELECT id, client_id as "clientId", brief, priority, status, created_at as "createdAt"
     FROM liaison_requests ORDER BY created_at DESC`
  );
  res.json({ success: true, data: r.rows });
});

export default router;
