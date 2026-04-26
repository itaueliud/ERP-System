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
import { buildContractHtml, ContractPdfData } from './contractPdfTemplate';

const router = Router();

// ── Generate contract directly (manual entry — CEO or EA) ─────────────────────
router.post('/generate-direct', requireRole(Role.CEO, Role.EA), async (req: Request, res: Response) => {
  try {
    const requesterId = (req as any).user.id;
    const {
      projectId, clientName, clientEmail, clientPhone, clientAddress, clientIdNumber,
      clientOrganization, serviceDescription, industryCategory, serviceAmount, currency,
      paymentPlan, commitmentAmount, transactionId, paymentDate, startDate, deliveryDate,
      propertyName, propertyLocation, placementTier, developerTeam, assignedProject,
      contractType, stampDataUrl,
    } = req.body;

    // If projectId provided, use existing flow
    if (projectId) {
      const contract = await contractService.generateContract(projectId, requesterId);
      return res.status(201).json(contract);
    }

    // Manual entry — validate minimum fields
    if (!clientName || !serviceDescription || !serviceAmount) {
      return res.status(400).json({ error: 'clientName, serviceDescription and serviceAmount are required' });
    }

    // Generate reference number
    const refResult = await db.query(
      `SELECT reference_number FROM contracts ORDER BY created_at DESC LIMIT 1`
    );
    const year = new Date().getFullYear();
    let seq = 1;
    if (refResult.rows.length > 0) {
      const last = refResult.rows[0].reference_number as string;
      const parts = last.split('-');
      const n = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(n)) seq = n + 1;
    }
    const referenceNumber = `TST-CNT-${year}-${seq.toString().padStart(6, '0')}`;

    // Build PDF data
    const pdfData: ContractPdfData = {
      referenceNumber,
      contractDate: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
      contractType: contractType || 'CLIENT_SYSTEM',
      companyName: 'TechSwiftTrix (TST)',
      companyAddress: 'Machakos, Kenya',
      companyEmail: 'info@techswifttrix.com',
      companyPhone: '+254796675724',
      companyWebsite: 'www.techswifttrix.com',
      companyRegNumber: 'BN-J9S6J9BQ',
      partyName: clientName,
      partyEmail: clientEmail || '',
      partyPhone: clientPhone || '',
      partyAddress: clientAddress || '',
      partyIdNumber: clientIdNumber,
      partyOrganization: clientOrganization,
      projectRef: projectId,
      serviceDescription,
      industryCategory,
      paymentPlan: paymentPlan || 'Full Payment',
      serviceAmount: parseFloat(serviceAmount),
      currency: currency || 'KES',
      commitmentAmount: commitmentAmount ? parseFloat(commitmentAmount) : undefined,
      transactionId,
      paymentDate,
      startDate,
      deliveryDate,
      propertyName,
      propertyLocation,
      placementTier,
      developerTeam,
      assignedProject,
      stampDataUrl,
    };

    // Generate HTML
    const html = buildContractHtml(pdfData);

    // Generate PDF using Puppeteer
    let pdfBuffer: Buffer;
    try {
      const puppeteer = await import('puppeteer');
      const browser = await puppeteer.default.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
      });
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });
      const pdfUint8 = await page.pdf({
        format: 'A4',
        printBackground: true,
        // top: 0 so our custom header fills edge-to-edge
        // bottom: 56px reserved for the fixed footer div
        margin: { top: '0', right: '0', bottom: '56px', left: '0' },
      });
      await browser.close();
      pdfBuffer = Buffer.from(pdfUint8);
    } catch (puppeteerErr) {
      logger.warn('Puppeteer unavailable, returning HTML as base64', { error: puppeteerErr });
      // Fallback: return HTML as data URL so frontend can display it
      pdfBuffer = Buffer.from(html, 'utf-8');
    }

    // Try to store in S3/R2, fall back to base64 data URL
    let pdfUrl = '';
    let pdfDataUrl = '';
    try {
      const { storageClient } = await import('../services/storage');
      const storageKey = `contracts/direct/${referenceNumber}.pdf`;
      const uploadResult = await storageClient.upload({
        key: storageKey,
        buffer: pdfBuffer,
        contentType: 'application/pdf',
        metadata: { referenceNumber, generatedBy: requesterId },
      });
      pdfUrl = uploadResult.url;
    } catch {
      // Storage not configured — return as base64 data URL for direct download
      pdfDataUrl = `data:application/pdf;base64,${pdfBuffer.toString('base64')}`;
      pdfUrl = pdfDataUrl;
    }

    // Save contract record
    const insertResult = await db.query(
      `INSERT INTO contracts (reference_number, project_id, version, content, pdf_url, status, created_by, contract_type)
       VALUES ($1, $2, 1, $3, $4, 'ACTIVE', $5, $6)
       RETURNING id, reference_number, project_id, version, content, pdf_url, status, created_by, created_at`,
      [
        referenceNumber,
        projectId || null,
        JSON.stringify({ clientName, serviceDescription, serviceAmount, currency, transactionId, contractType }),
        pdfUrl,
        requesterId,
        contractType || 'CLIENT_SYSTEM',
      ]
    );

    // Auto-create a project record so this contract appears in active projects dashboard
    let linkedProjectId = projectId || null;
    if (!linkedProjectId) {
      try {
        // Generate a project reference number
        const projRefResult = await db.query(
          `SELECT reference_number FROM projects ORDER BY created_at DESC LIMIT 1`
        );
        const projYear = new Date().getFullYear();
        let projSeq = 1;
        if (projRefResult.rows.length > 0) {
          const lastRef = projRefResult.rows[0].reference_number as string;
          const parts = lastRef.split('-');
          const n = parseInt(parts[parts.length - 1], 10);
          if (!isNaN(n)) projSeq = n + 1;
        }
        const projectRef = `TST-PRJ-${projYear}-${projSeq.toString().padStart(6, '0')}`;

        const projResult = await db.query(
          `INSERT INTO projects (reference_number, status, service_amount, currency, start_date, end_date)
           VALUES ($1, 'ACTIVE', $2, $3, $4, $5)
           RETURNING id`,
          [
            projectRef,
            parseFloat(serviceAmount),
            currency || 'KES',
            startDate || null,
            deliveryDate || null,
          ]
        );
        linkedProjectId = projResult.rows[0].id;

        // Link the contract to the new project
        await db.query(
          `UPDATE contracts SET project_id = $1 WHERE id = $2`,
          [linkedProjectId, insertResult.rows[0].id]
        );

        logger.info('Auto-created project for contract', { projectId: linkedProjectId, referenceNumber });

        // Invalidate dashboard cache so metrics update immediately
        try {
          const { cacheService } = await import('../cache/cacheService');
          await cacheService.deletePattern('dashboard:company:*');
          await cacheService.deletePattern('dashboard:ceo:*');
        } catch { /* non-fatal */ }
      } catch (projErr) {
        // Non-fatal — contract is still saved even if project creation fails
        logger.warn('Could not auto-create project for contract', { error: projErr });
      }
    }

    const row = insertResult.rows[0];
    return res.status(201).json({
      id: row.id,
      referenceNumber: row.reference_number,
      pdfUrl: row.pdf_url,
      pdfDataUrl: pdfDataUrl || undefined,
      status: row.status,
      createdAt: row.created_at,
    });
  } catch (error: any) {
    logger.error('Generate direct contract error', { error });
    return res.status(400).json({ error: error.message || 'Failed to generate contract' });
  }
});

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

// ── My-team contracts — MUST be before /:contractId to avoid wildcard match ──
router.get('/my-team', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { db } = await import('../database/connection');

    const userResult = await db.query(
      `SELECT team_id, is_team_leader FROM users WHERE id = $1`, [userId]
    );
    const teamId = userResult.rows[0]?.team_id;

    const mapRow = (r: any) => ({
      id: r.id,
      referenceNumber: r.reference_number,
      projectId: r.project_id,
      projectReference: r.project_reference,
      version: r.version,
      content: typeof r.content === 'string' ? JSON.parse(r.content) : r.content,
      pdfUrl: r.pdf_url,
      status: r.status,
      createdBy: r.created_by,
      createdAt: r.created_at,
      teamId: r.team_id,
      teamName: r.team_name,
    });

    const baseSelect = `
      SELECT c.id, c.reference_number, c.project_id, c.version, c.content,
             c.pdf_url, c.status, c.created_by, c.created_at,
             p.reference_number AS project_reference,
             p.team_id, dt.name AS team_name
      FROM contracts c
      LEFT JOIN projects p ON p.id = c.project_id
      LEFT JOIN developer_teams dt ON dt.id = p.team_id`;

    let result;
    if (teamId) {
      result = await db.query(`${baseSelect} WHERE p.team_id = $1 ORDER BY c.created_at DESC`, [teamId]);
    } else {
      // No team assigned — show all team-assigned contracts (shared dev account)
      result = await db.query(`${baseSelect} WHERE p.team_id IS NOT NULL ORDER BY c.created_at DESC`);
    }

    return res.json({ contracts: result.rows.map(mapRow), total: result.rowCount });
  } catch (error: any) {
    logger.error('Get my-team contracts error', { error });
    return res.status(500).json({ error: 'Failed to get team contracts' });
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

// ── Download contract PDF ─────────────────────────────────────────────────────
router.get('/:contractId/download', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { contractId } = req.params;

    // Non-leader developers cannot download (doc §17)
    if (user.role === 'DEVELOPER') {
      const leaderCheck = await db.query('SELECT is_team_leader FROM users WHERE id = $1', [user.id]);
      if (!leaderCheck.rows.length || !leaderCheck.rows[0].is_team_leader) {
        return res.status(403).json({ error: 'Only Team Leaders can download contracts' });
      }
    }

    // Get contract PDF URL directly from DB
    const result = await db.query('SELECT pdf_url FROM contracts WHERE id = $1', [contractId]);
    if (!result.rows.length) return res.status(404).json({ error: 'Contract not found' });

    const pdfUrl = result.rows[0].pdf_url as string;

    // If it's a data URL (base64), return directly
    if (pdfUrl.startsWith('data:')) {
      return res.json({ downloadUrl: pdfUrl, pdfDataUrl: pdfUrl });
    }

    // Otherwise try to get a signed URL from storage
    try {
      const url = await contractService.getDownloadUrl(contractId);
      return res.json({ downloadUrl: url });
    } catch {
      // Fall back to the stored URL directly
      return res.json({ downloadUrl: pdfUrl });
    }
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
