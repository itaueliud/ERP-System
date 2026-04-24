/**
 * Contract Routes
 * Doc §12: Contract Generator
 * - Contracts can ONLY be generated AFTER payment is confirmed (enforced here)
 * - Developer Team Leaders can download and upload signed contracts
 * - Non-leader developers can view but cannot download
 */
import { Router, Request, Response } from 'express';
import { contractService } from './contractService';
import { requireRole } from '../auth/authorizationMiddleware';
import { Role } from '../auth/authorizationService';
import { db } from '../database/connection';
import logger from '../utils/logger';

const router = Router();

// ── Generate contract (CEO or EA only — doc §12) ──────────────────────────────
router.post('/', requireRole(Role.CEO, Role.EA), async (req: Request, res: Response) => {
  try {
    const requesterId = (req as any).user.id;
    const { projectId } = req.body;
    if (!projectId) return res.status(400).json({ error: 'projectId is required' });

    // Doc §12 Trigger Rule: contract can ONLY be generated after payment is confirmed
    const paymentCheck = await db.query(
      `SELECT p.id FROM payments p
       WHERE p.project_id = $1 AND p.status = 'COMPLETED'
       LIMIT 1`,
      [projectId]
    );
    // Also check commitment payment on the client
    const commitCheck = await db.query(
      `SELECT p.id FROM payments p
       JOIN clients c ON c.id = p.client_id
       JOIN projects pr ON pr.client_id = c.id
       WHERE pr.id = $1 AND p.status = 'COMPLETED'
       LIMIT 1`,
      [projectId]
    );

    if (!paymentCheck.rows.length && !commitCheck.rows.length) {
      return res.status(400).json({
        error: 'CONTRACT_PAYMENT_REQUIRED',
        message: 'A contract can only be generated after payment is confirmed (doc §12)',
      });
    }

    const contract = await contractService.generateContract(projectId, requesterId);
    return res.status(201).json(contract);
  } catch (error: any) {
    logger.error('Generate contract error', { error });
    return res.status(400).json({ error: error.message || 'Failed to generate contract' });
  }
});

// ── List contracts ────────────────────────────────────────────────────────────
router.get('/', async (req: Request, res: Response) => {
  try {
    const { projectId, status, limit, offset } = req.query;
    const result = await contractService.listContracts({
      projectId: projectId as string,
      status: status as any,
      limit: limit ? parseInt(limit as string) : undefined,
      offset: offset ? parseInt(offset as string) : undefined,
    });
    return res.json(result);
  } catch (error: any) {
    logger.error('List contracts error', { error });
    return res.status(500).json({ error: 'Failed to list contracts' });
  }
});

// ── Get contract by ID ────────────────────────────────────────────────────────
router.get('/:contractId', async (req: Request, res: Response) => {
  try {
    const contract = await contractService.getContract(req.params.contractId);
    if (!contract) return res.status(404).json({ error: 'Contract not found' });
    return res.json(contract);
  } catch (error: any) {
    logger.error('Get contract error', { error });
    return res.status(500).json({ error: 'Failed to get contract' });
  }
});

// ── Download contract PDF (Team Leaders, CEO, EA, CFO — doc §12) ──────────────
router.get('/:contractId/download', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { contractId } = req.params;

    // Non-leader developers cannot download (doc §17)
    if (user.role === 'DEVELOPER') {
      const leaderCheck = await db.query(
        `SELECT is_team_leader FROM users WHERE id = $1`, [user.id]
      );
      if (!leaderCheck.rows.length || !leaderCheck.rows[0].is_team_leader) {
        return res.status(403).json({ error: 'Only Team Leaders can download contracts' });
      }
    }

    const url = await contractService.getDownloadUrl(contractId);

    // Log download by Team Leader (doc §12)
    if (user.role === 'DEVELOPER') {
      await db.query(
        `INSERT INTO contract_signatures (contract_id, team_leader_id, downloaded_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT DO NOTHING`,
        [contractId, user.id]
      );
    }

    return res.json({ downloadUrl: url });
  } catch (error: any) {
    logger.error('Download contract error', { error });
    return res.status(400).json({ error: error.message || 'Failed to get download URL' });
  }
});

// ── Upload signed contract (Team Leaders only — doc §12) ─────────────────────
router.post('/:contractId/upload-signed', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { contractId } = req.params;
    const { signedPdfUrl } = req.body;

    if (!signedPdfUrl) return res.status(400).json({ error: 'signedPdfUrl is required' });

    // Only Team Leaders can upload signed contracts (doc §12, §17)
    if (user.role === 'DEVELOPER') {
      const leaderCheck = await db.query(
        `SELECT is_team_leader FROM users WHERE id = $1`, [user.id]
      );
      if (!leaderCheck.rows.length || !leaderCheck.rows[0].is_team_leader) {
        return res.status(403).json({ error: 'Only Team Leaders can upload signed contracts' });
      }
    } else if (!['CEO', 'EA', 'CFO', 'CoS'].includes(user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions to upload signed contracts' });
    }

    await db.query(
      `INSERT INTO contract_signatures (contract_id, team_leader_id, signed_pdf_url, uploaded_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (contract_id, team_leader_id) DO UPDATE
         SET signed_pdf_url = EXCLUDED.signed_pdf_url, uploaded_at = NOW()`,
      [contractId, user.id, signedPdfUrl]
    );

    logger.info('Signed contract uploaded', { contractId, uploadedBy: user.id });
    return res.json({ success: true, message: 'Signed contract uploaded' });
  } catch (error: any) {
    logger.error('Upload signed contract error', { error });
    return res.status(400).json({ error: error.message || 'Failed to upload signed contract' });
  }
});

// ── Get contract versions ─────────────────────────────────────────────────────
router.get('/:contractId/versions', async (req: Request, res: Response) => {
  try {
    const versions = await contractService.getContractVersions(req.params.contractId);
    return res.json({ versions });
  } catch (error: any) {
    logger.error('Get contract versions error', { error });
    return res.status(400).json({ error: error.message || 'Failed to get versions' });
  }
});

export { router as contractRoutes };
export default router;
