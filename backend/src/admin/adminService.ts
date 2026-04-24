/**
 * CEO System Admin Panel Service
 * Doc §6 Section 6 — SYSTEM ADMIN PANEL (CEO Exclusive)
 * All methods enforce CEO-only access at the route level.
 */
import { db } from '../database/connection';
import logger from '../utils/logger';

export class AdminService {
  // ── User Management ───────────────────────────────────────────────────────
  async listAllUsers(filters: { role?: string; isActive?: boolean; search?: string; limit?: number; offset?: number }) {
    const conditions: string[] = [];
    const values: any[] = [];
    let p = 1;

    if (filters.role) { conditions.push(`r.name = $${p++}`); values.push(filters.role); }
    if (filters.isActive !== undefined) { conditions.push(`u.is_active = $${p++}`); values.push(filters.isActive); }
    if (filters.search) {
      conditions.push(`(u.full_name ILIKE $${p} OR u.email ILIKE $${p})`);
      values.push(`%${filters.search}%`); p++;
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const total = await db.query(`SELECT COUNT(*) FROM users u JOIN roles r ON r.id = u.role_id ${where}`, values);
    const limit = filters.limit || 50;
    const offset = filters.offset || 0;
    values.push(limit, offset);

    const rows = await db.query(
      `SELECT u.id, u.email, u.full_name, u.phone, u.country, u.region,
              r.name AS role, u.department_id, u.is_active, u.suspended_at,
              u.two_fa_enabled, u.two_fa_mandatory, u.last_login, u.created_at
       FROM users u JOIN roles r ON r.id = u.role_id
       ${where}
       ORDER BY u.created_at DESC LIMIT $${p} OFFSET $${p + 1}`,
      values
    );

    return { users: rows.rows, total: parseInt(total.rows[0].count) };
  }

  async deactivateUser(userId: string, suspendedBy: string, reason: string) {
    await db.query(
      `UPDATE users SET is_active = FALSE, suspended_at = NOW(), suspended_by = $1, updated_at = NOW()
       WHERE id = $2`,
      [suspendedBy, userId]
    );
    await this._auditLog(suspendedBy, 'DEACTIVATE_USER', 'users', userId, { reason });
    logger.info('User deactivated by CEO', { userId, suspendedBy });
  }

  async reactivateUser(userId: string, reactivatedBy: string) {
    await db.query(
      `UPDATE users SET is_active = TRUE, suspended_at = NULL, suspended_by = NULL, updated_at = NOW()
       WHERE id = $1`,
      [userId]
    );
    await this._auditLog(reactivatedBy, 'REACTIVATE_USER', 'users', userId, {});
    logger.info('User reactivated by CEO', { userId, reactivatedBy });
  }

  async hardDeleteUser(userId: string, deletedBy: string) {
    // CEO-only hard delete (doc §21 Data Deletion Policy)
    // Archive first, then delete
    const user = await db.query(`SELECT * FROM users WHERE id = $1`, [userId]);
    if (!user.rows.length) throw new Error('User not found');

    await this._auditLog(deletedBy, 'HARD_DELETE_USER', 'users', userId, { archivedData: user.rows[0] });
    await db.query(`DELETE FROM users WHERE id = $1`, [userId]);
    logger.warn('User hard-deleted by CEO', { userId, deletedBy });
  }

  async changeUserRole(userId: string, newRole: string, changedBy: string) {
    const roleResult = await db.query(`SELECT id FROM roles WHERE name = $1`, [newRole]);
    if (!roleResult.rows.length) throw new Error(`Role "${newRole}" not found`);

    const oldRole = await db.query(`SELECT r.name FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = $1`, [userId]);
    await db.query(`UPDATE users SET role_id = $1, updated_at = NOW() WHERE id = $2`, [roleResult.rows[0].id, userId]);
    await this._auditLog(changedBy, 'CHANGE_USER_ROLE', 'users', userId, {
      oldRole: oldRole.rows[0]?.name,
      newRole,
    });
    logger.info('User role changed by CEO', { userId, newRole, changedBy });
  }

  // ── Invitation Management ─────────────────────────────────────────────────
  async listPendingInvitations() {
    const result = await db.query(
      `SELECT it.id, it.email, r.name AS role, it.expires_at, it.created_at,
              u.full_name AS invited_by
       FROM invitation_tokens it
       JOIN roles r ON r.id = it.role_id
       JOIN users u ON u.id = it.created_by
       WHERE it.used_at IS NULL AND it.expires_at > NOW()
       ORDER BY it.created_at DESC`
    );
    return result.rows;
  }

  async revokeInvitation(invitationId: string, revokedBy: string) {
    await db.query(`DELETE FROM invitation_tokens WHERE id = $1`, [invitationId]);
    await this._auditLog(revokedBy, 'REVOKE_INVITATION', 'invitation_tokens', invitationId, {});
  }

  // ── Full Audit Log ────────────────────────────────────────────────────────
  async getFullAuditLog(filters: { userId?: string; action?: string; from?: string; to?: string; limit?: number; offset?: number }) {
    const conditions: string[] = [];
    const values: any[] = [];
    let p = 1;

    if (filters.userId) { conditions.push(`al.user_id = $${p++}`); values.push(filters.userId); }
    if (filters.action) { conditions.push(`al.action ILIKE $${p++}`); values.push(`%${filters.action}%`); }
    if (filters.from) { conditions.push(`al.created_at >= $${p++}`); values.push(filters.from); }
    if (filters.to) { conditions.push(`al.created_at <= $${p++}`); values.push(filters.to); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = filters.limit || 100;
    const offset = filters.offset || 0;
    values.push(limit, offset);

    const rows = await db.query(
      `SELECT al.id, al.user_id, u.full_name AS user_name, r.name AS user_role,
              al.action, al.resource_type, al.resource_id, al.ip_address,
              al.result, al.metadata, al.created_at
       FROM audit_logs al
       JOIN users u ON u.id = al.user_id
       JOIN roles r ON r.id = u.role_id
       ${where}
       ORDER BY al.created_at DESC LIMIT $${p} OFFSET $${p + 1}`,
      values
    );

    return rows.rows;
  }

  // ── System Configuration ──────────────────────────────────────────────────
  async getSystemConfig() {
    const result = await db.query(`SELECT key, value, description, updated_at FROM system_config ORDER BY key`);
    return result.rows;
  }

  async updateSystemConfig(key: string, value: any, updatedBy: string) {
    const old = await db.query(`SELECT value FROM system_config WHERE key = $1`, [key]);
    await db.query(
      `INSERT INTO system_config (key, value, updated_by, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = NOW()`,
      [key, JSON.stringify(value), updatedBy]
    );
    await this._auditLog(updatedBy, 'UPDATE_SYSTEM_CONFIG', 'system_config', null, {
      key, oldValue: old.rows[0]?.value, newValue: value,
    });
  }

  // ── Pricing / Amount Changes — CEO Confirmation (doc §21) ─────────────────
  async getPendingPricingChanges() {
    const result = await db.query(
      `SELECT pcr.*, u.full_name AS proposed_by_name
       FROM pricing_change_requests pcr
       JOIN users u ON u.id = pcr.proposed_by
       WHERE pcr.status = 'PENDING'
       ORDER BY pcr.created_at ASC`
    );
    return result.rows;
  }

  async confirmPricingChange(changeId: string, ceoId: string) {
    const change = await db.query(`SELECT * FROM pricing_change_requests WHERE id = $1`, [changeId]);
    if (!change.rows.length) throw new Error('Pricing change request not found');
    if (change.rows[0].status !== 'PENDING') throw new Error('Change already processed');

    const { change_type, target_id, new_amount } = change.rows[0];

    // Apply the change to the correct table
    if (change_type === 'SERVICE_CATALOGUE') {
      await db.query(`UPDATE service_catalogue SET base_amount = $1, updated_at = NOW() WHERE id = $2`, [new_amount, target_id]);
    } else if (change_type === 'COMMITMENT_AMOUNT') {
      await db.query(`UPDATE commitment_amounts SET amount = $1, updated_by = $2, updated_at = NOW() WHERE id = $3`, [new_amount, ceoId, target_id]);
    } else if (change_type === 'PLOTCONNECT_PLACEMENT') {
      await db.query(`UPDATE property_listings SET placement_amount = $1, updated_at = NOW() WHERE id = $2`, [new_amount, target_id]);
    }

    await db.query(
      `UPDATE pricing_change_requests SET status = 'CONFIRMED', confirmed_by = $1, confirmed_at = NOW() WHERE id = $2`,
      [ceoId, changeId]
    );

    await this._auditLog(ceoId, 'CONFIRM_PRICING_CHANGE', 'pricing_change_requests', changeId, change.rows[0]);
    logger.info('Pricing change confirmed by CEO', { changeId, ceoId });
  }

  async rejectPricingChange(changeId: string, ceoId: string, reason: string) {
    await db.query(
      `UPDATE pricing_change_requests SET status = 'REJECTED', confirmed_by = $1, confirmed_at = NOW(), rejected_reason = $2 WHERE id = $3`,
      [ceoId, reason, changeId]
    );
    await this._auditLog(ceoId, 'REJECT_PRICING_CHANGE', 'pricing_change_requests', changeId, { reason });
  }

  // ── Session Management ────────────────────────────────────────────────────
  async getActiveSessions() {
    const result = await db.query(
      `SELECT s.id, s.user_id, u.full_name, r.name AS role,
              s.ip_address, s.user_agent, s.created_at, s.expires_at
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       JOIN roles r ON r.id = u.role_id
       WHERE s.expires_at > NOW()
       ORDER BY s.created_at DESC`
    );
    return result.rows;
  }

  async forceLogoutUser(userId: string, forcedBy: string) {
    await db.query(`DELETE FROM sessions WHERE user_id = $1`, [userId]);
    await this._auditLog(forcedBy, 'FORCE_LOGOUT_USER', 'sessions', userId, {});
    logger.warn('User force-logged out by CEO', { userId, forcedBy });
  }

  async forceLogoutAll(forcedBy: string) {
    // Keep CEO's own session
    await db.query(`DELETE FROM sessions WHERE user_id != $1`, [forcedBy]);
    await this._auditLog(forcedBy, 'FORCE_LOGOUT_ALL', 'sessions', null, {});
    logger.warn('All sessions force-terminated by CEO', { forcedBy });
  }

  // ── Portal Access Control ─────────────────────────────────────────────────
  async setPortalEnabled(portal: string, enabled: boolean, ceoId: string) {
    const key = `portal_${portal.toLowerCase()}_enabled`;
    await this.updateSystemConfig(key, enabled, ceoId);
  }

  // ── Country & Region Tables ───────────────────────────────────────────────
  async listCountries() {
    const result = await db.query(`SELECT * FROM countries ORDER BY name`);
    return result.rows;
  }

  // ── Internal audit helper ─────────────────────────────────────────────────
  private async _auditLog(userId: string, action: string, resourceType: string, resourceId: string | null, metadata: any) {
    try {
      await db.query(
        `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, ip_address, result, metadata)
         VALUES ($1, $2, $3, $4, '0.0.0.0', 'SUCCESS', $5)`,
        [userId, action, resourceType, resourceId, JSON.stringify(metadata)]
      );
    } catch (err) {
      logger.error('Audit log insert failed', { err });
    }
  }
}

export const adminService = new AdminService();
export default adminService;
