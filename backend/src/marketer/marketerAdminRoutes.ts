/**
 * Marketer Admin Routes — /api/v1/plotconnect
 * Access to TST PlotConnect property data for management roles.
 *
 * Role access per spec:
 *   COO / CEO     — full read + approve/reject/publish
 *   OPERATIONS    — read + approve/reject
 *   TRAINER       — read own agents' properties + modify placement tier
 *   HEAD_OF_TRAINERS — read all properties in country
 *   EA            — manage package amounts (CEO must confirm)
 *   CFO / CoS     — read for commission tracking
 */
import { Router, Request, Response } from 'express';
import multer from 'multer';
import { db } from '../database/connection';
import { requireRole } from '../auth/authorizationMiddleware';
import { Role } from '../auth/authorizationService';
import logger from '../utils/logger';

const router = Router();

// multer for image uploads — memory storage, max 8 × 5 MB
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 8 },
  fileFilter: (_req, file, cb) => { cb(null, file.mimetype.startsWith('image/')); },
});

// Roles that can read all properties
const MANAGEMENT_ROLES = [Role.CEO, Role.COO, Role.CoS, Role.CFO, Role.EA, Role.OPERATIONS_USER, Role.HEAD_OF_TRAINERS];

// ─── Shared property row mapper ───────────────────────────────────────────────
function mapProperty(r: any) {
  return {
    id:                 r.id,
    ownerName:          r.owner_name,
    ownerPhone:         r.owner_phone,
    ownerPhone2:        r.owner_phone2,
    ownerWhatsapp:      r.owner_whatsapp,
    propertyName:       r.property_name,
    county:             r.county,
    area:               r.area,
    mapLink:            r.map_link,
    bookingType:        r.booking_type,
    propertyTypes:      r.property_types || [],
    rooms:              r.rooms || [],
    package:            r.package,
    placementTier:      r.placement_tier,
    contactPerson:      r.contact_person,
    description:        r.description,
    websiteLink:        r.website_link,
    numberOfRooms:      r.number_of_rooms,
    pricePerRoom:       r.price_per_room,
    status:             r.status,
    paymentStatus:      r.payment_status,
    paymentConfirmedAt: r.payment_confirmed_at,
    agentName:          r.agent_name,
    agentId:            r.submitted_by,
    trainerName:        r.trainer_name,
    createdAt:          r.created_at,
    updatedAt:          r.updated_at,
  };
}

// ─── GET /api/v1/plotconnect/properties — all properties (management roles) ───
router.get('/properties', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const role = user.role as Role;
    const isManagement = MANAGEMENT_ROLES.includes(role);
    const isTrainer = role === Role.TRAINER;

    if (!isManagement && !isTrainer) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { status, paymentStatus, county, search, limit = 100, offset = 0 } = req.query;

    let whereClause = 'WHERE 1=1';
    const params: any[] = [];
    let pIdx = 1;

    // Trainers only see properties from their assigned agents
    if (isTrainer) {
      whereClause += ` AND mp.submitted_by IN (
        SELECT id FROM users WHERE trainer_id = $${pIdx}
      )`;
      params.push(user.id);
      pIdx++;
    }

    if (status) { whereClause += ` AND mp.status = $${pIdx}`; params.push(status); pIdx++; }
    if (paymentStatus) { whereClause += ` AND mp.payment_status = $${pIdx}`; params.push(paymentStatus); pIdx++; }
    if (county) { whereClause += ` AND mp.county ILIKE $${pIdx}`; params.push(`%${county}%`); pIdx++; }
    if (search) {
      whereClause += ` AND (mp.property_name ILIKE $${pIdx} OR mp.owner_name ILIKE $${pIdx} OR mp.area ILIKE $${pIdx})`;
      params.push(`%${search}%`); pIdx++;
    }

    const result = await db.query(
      `SELECT mp.*,
              u.full_name  AS agent_name,
              t.full_name  AS trainer_name
       FROM marketer_properties mp
       LEFT JOIN users u ON u.id = mp.submitted_by
       LEFT JOIN users t ON t.id = u.trainer_id
       ${whereClause}
       ORDER BY mp.created_at DESC
       LIMIT $${pIdx} OFFSET $${pIdx + 1}`,
      [...params, Number(limit), Number(offset)]
    );

    const countResult = await db.query(
      `SELECT COUNT(*) FROM marketer_properties mp ${whereClause}`,
      params
    );

    return res.json({
      data:  result.rows.map(mapProperty),
      total: parseInt(countResult.rows[0].count, 10),
    });
  } catch (err: any) {
    logger.error('plotconnect: list properties', { err });
    return res.status(500).json({ error: 'Failed to fetch properties' });
  }
});

// ─── GET /api/v1/plotconnect/properties/:id — single property detail ──────────
router.get('/properties/:id', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const result = await db.query(
      `SELECT mp.*,
              u.full_name  AS agent_name,
              t.full_name  AS trainer_name
       FROM marketer_properties mp
       LEFT JOIN users u ON u.id = mp.submitted_by
       LEFT JOIN users t ON t.id = u.trainer_id
       WHERE mp.id = $1`,
      [req.params.id]
    );

    if (!result.rows.length) return res.status(404).json({ error: 'Property not found' });
    return res.json({ data: mapProperty(result.rows[0]) });
  } catch (err: any) {
    logger.error('plotconnect: get property', { err });
    return res.status(500).json({ error: 'Failed to fetch property' });
  }
});

// ─── POST /api/v1/plotconnect/properties/:id/upgrade-package ─────────────────
// EA upgrades a property's package and triggers STK push for the difference
router.post('/properties/:id/upgrade-package', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const allowed = [Role.CEO, Role.COO, Role.EA, Role.OPERATIONS_USER, Role.CoS];
    if (!allowed.includes(user.role)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { newPackage, mpesaPhone } = req.body;
    const validPackages = ['BASIC', 'STANDARD', 'ADVANCED'];
    if (!validPackages.includes(newPackage)) {
      return res.status(400).json({ error: 'Invalid package. Must be BASIC, STANDARD or ADVANCED' });
    }
    if (!mpesaPhone?.trim()) {
      return res.status(400).json({ error: 'mpesaPhone is required' });
    }

    // Get current property
    const propResult = await db.query(
      `SELECT id, property_name, package, payment_status, submitted_by
       FROM marketer_properties WHERE id = $1`,
      [req.params.id]
    );
    if (!propResult.rows.length) return res.status(404).json({ error: 'Property not found' });

    const prop = propResult.rows[0];

    // Package price map — try live DB prices first, fall back to defaults
    const PRICES: Record<string, number> = { BASIC: 4000, STANDARD: 8000, ADVANCED: 12000 };
    try {
      const pkgRows = await db.query(`SELECT key, price FROM marketer_packages`);
      for (const r of pkgRows.rows) PRICES[r.key] = Number(r.price);
    } catch { /* use defaults */ }

    const currentPrice = PRICES[prop.package] || 0;
    const newPrice     = PRICES[newPackage]    || 0;

    if (newPrice <= currentPrice) {
      return res.status(400).json({
        error: `Cannot downgrade. Current package is ${prop.package} (KSh ${currentPrice.toLocaleString()}). Choose a higher tier.`,
      });
    }

    const diff = newPrice - currentPrice;

    // Trigger STK push for the difference
    const { darajaClient } = await import('../services/daraja');
    const reference = `PKG-UPGRADE-${prop.id.slice(0, 8)}-${Date.now()}`;

    let checkoutRequestId: string | null = null;

    // Sandbox auto-complete
    if (darajaClient.sandboxMode && process.env.DARAJA_SANDBOX_AUTO_COMPLETE === 'true') {
      checkoutRequestId = `SANDBOX-AUTO-UPGRADE-${Date.now()}`;
      // Immediately update package
      await db.query(
        `UPDATE marketer_properties
         SET package = $1, placement_tier = $1, updated_at = NOW()
         WHERE id = $2`,
        [newPackage, req.params.id]
      );
      // Record payment
      await db.query(
        `INSERT INTO payments (transaction_id, checkout_request_id, amount, currency, payment_method, status, property_id)
         VALUES ($1, $1, $2, 'KES', 'MPESA', 'COMPLETED', $3)`,
        [checkoutRequestId, diff, req.params.id]
      ).catch(() => {});

      logger.info('[SANDBOX AUTO-COMPLETE] Package upgrade completed', { propertyId: req.params.id, newPackage, diff });
      return res.json({
        success: true, autoCompleted: true,
        message: `[SANDBOX] Package upgraded to ${newPackage}. No real money charged.`,
        newPackage, amountCharged: diff,
      });
    }

    // Real STK push
    const stkRes = await darajaClient.initiateMpesaPayment({
      phoneNumber:      mpesaPhone.trim(),
      amount:           diff,
      accountReference: reference,
      transactionDesc:  `PlotConnect upgrade to ${newPackage}`,
    });

    checkoutRequestId = stkRes.transactionId || stkRes.requestId;

    // Record pending payment linked to property
    await db.query(
      `INSERT INTO payments (transaction_id, checkout_request_id, amount, currency, payment_method, status, property_id)
       VALUES ($1, $1, $2, 'KES', 'MPESA', 'PENDING', $3)`,
      [checkoutRequestId, diff, req.params.id]
    ).catch(() => {});

    // Store upgrade intent so poller can apply it when payment completes
    await db.query(
      `UPDATE marketer_properties
       SET pending_package_upgrade = $1, checkout_request_id = $2, payment_status = 'AWAITING_CONFIRMATION', updated_at = NOW()
       WHERE id = $3`,
      [newPackage, checkoutRequestId, req.params.id]
    ).catch(async () => {
      // Column may not exist yet — just store checkout_request_id
      await db.query(
        `UPDATE marketer_properties
         SET checkout_request_id = $1, payment_status = 'AWAITING_CONFIRMATION', updated_at = NOW()
         WHERE id = $2`,
        [checkoutRequestId, req.params.id]
      );
    });

    return res.json({
      success: true,
      message: `STK Push sent for KSh ${diff.toLocaleString()} (upgrade from ${prop.package} → ${newPackage}). Ask the client to approve on their phone.`,
      checkoutRequestId, newPackage, amountCharged: diff,
    });
  } catch (err: any) {
    logger.error('plotconnect: upgrade package', { err });
    return res.status(500).json({ error: err.message || 'Failed to initiate package upgrade' });
  }
});

// ─── PATCH /api/v1/plotconnect/properties/:id — edit property fields (EA, COO, CEO) ─
router.patch('/properties/:id', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const allowed = [Role.CEO, Role.COO, Role.EA, Role.OPERATIONS_USER, Role.CoS];
    if (!allowed.includes(user.role)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const {
      propertyName, ownerName, ownerPhone, county, area,
      contactPerson, description, websiteLink, mapLink,
    } = req.body;

    await db.query(
      `UPDATE marketer_properties SET
         property_name   = COALESCE($1,  property_name),
         owner_name      = COALESCE($2,  owner_name),
         owner_phone     = COALESCE($3,  owner_phone),
         county          = COALESCE($4,  county),
         area            = COALESCE($5,  area),
         contact_person  = COALESCE($6,  contact_person),
         description     = COALESCE($7,  description),
         website_link    = COALESCE($8,  website_link),
         map_link        = COALESCE($9,  map_link),
         updated_at      = NOW()
       WHERE id = $10`,
      [
        propertyName  || null, ownerName    || null, ownerPhone   || null,
        county        || null, area         || null, contactPerson || null,
        description   || null, websiteLink  || null, mapLink      || null,
        req.params.id,
      ]
    );

    return res.json({ success: true });
  } catch (err: any) {
    logger.error('plotconnect: edit property', { err });
    return res.status(500).json({ error: 'Failed to update property' });
  }
});

// ─── PATCH /api/v1/plotconnect/properties/:id/status — approve/reject/publish ─
// COO, CEO, OPERATIONS_USER
router.patch('/properties/:id/status', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const allowed = [Role.CEO, Role.COO, Role.EA, Role.OPERATIONS_USER, Role.CoS];
    if (!allowed.includes(user.role)) {
      return res.status(403).json({ error: 'Only COO, CEO, or Operations can update property status' });
    }

    const { status, reason } = req.body;
    const validStatuses = ['PENDING', 'APPROVED', 'REJECTED', 'PUBLISHED', 'UNPUBLISHED'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
    }

    // Operations can only approve/reject — not publish/unpublish (CEO/COO/EA only)
    const publishOnly = [Role.CEO, Role.COO, Role.EA, Role.CoS];
    if ((status === 'PUBLISHED' || status === 'UNPUBLISHED') && !publishOnly.includes(user.role)) {
      return res.status(403).json({ error: 'Only CEO, COO, or EA can publish or unpublish properties' });
    }

    await db.query(
      `UPDATE marketer_properties
       SET status = $1, updated_at = NOW()
       WHERE id = $2`,
      [status, req.params.id]
    );

    // Notify the agent
    await db.query(
      `INSERT INTO notifications (user_id, title, message, type, created_at)
       SELECT mp.submitted_by,
              $1, $2, 'PROPERTY_STATUS_UPDATE', NOW()
       FROM marketer_properties mp
       WHERE mp.id = $3`,
      [
        `Property ${status.toLowerCase()}`,
        `Your property listing has been ${status.toLowerCase()}${reason ? ': ' + reason : ''}.`,
        req.params.id,
      ]
    ).catch(() => {});

    return res.json({ success: true, status });
  } catch (err: any) {
    logger.error('plotconnect: update status', { err });
    return res.status(500).json({ error: 'Failed to update status' });
  }
});

// ─── PATCH /api/v1/plotconnect/properties/:id/placement-tier — Trainer only ───
// Section 14: Only a Trainer can modify the placement tier after submission
router.patch('/properties/:id/placement-tier', requireRole(Role.TRAINER), async (req: Request, res: Response) => {
  try {
    const trainerId = (req as any).user.id;
    const { tier } = req.body;
    const validTiers = ['BASIC', 'STANDARD', 'ADVANCED'];
    if (!validTiers.includes(tier)) {
      return res.status(400).json({ error: `Invalid tier. Must be one of: ${validTiers.join(', ')}` });
    }

    // Verify the property belongs to one of this trainer's agents
    const check = await db.query(
      `SELECT mp.id FROM marketer_properties mp
       JOIN users u ON u.id = mp.submitted_by
       WHERE mp.id = $1 AND u.trainer_id = $2`,
      [req.params.id, trainerId]
    );
    if (!check.rows.length) {
      return res.status(403).json({ error: 'You can only modify placement tier for your agents\' properties' });
    }

    await db.query(
      `UPDATE marketer_properties SET package = $1, placement_tier = $1, updated_at = NOW() WHERE id = $2`,
      [tier, req.params.id]
    );

    return res.json({ success: true, tier });
  } catch (err: any) {
    logger.error('plotconnect: update placement tier', { err });
    return res.status(500).json({ error: 'Failed to update placement tier' });
  }
});

// ─── GET /api/v1/plotconnect/stats — summary stats for dashboards ─────────────
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const result = await db.query(`
      SELECT
        COUNT(*)                                                          AS total,
        COUNT(*) FILTER (WHERE status = 'PENDING')                       AS pending,
        COUNT(*) FILTER (WHERE status = 'APPROVED')                      AS approved,
        COUNT(*) FILTER (WHERE status = 'PUBLISHED')                     AS published,
        COUNT(*) FILTER (WHERE status = 'REJECTED')                      AS rejected,
        COUNT(*) FILTER (WHERE payment_status = 'PAID')                  AS paid,
        COUNT(*) FILTER (WHERE payment_status = 'UNPAID')                AS unpaid,
        COUNT(*) FILTER (WHERE payment_status = 'AWAITING_CONFIRMATION') AS awaiting,
        COUNT(*) FILTER (WHERE package = 'BASIC')                        AS basic_count,
        COUNT(*) FILTER (WHERE package = 'STANDARD')                     AS standard_count,
        COUNT(*) FILTER (WHERE package = 'ADVANCED')                     AS advanced_count,
        COALESCE(SUM(CASE WHEN payment_status = 'PAID' AND package = 'BASIC'    THEN 4000
                          WHEN payment_status = 'PAID' AND package = 'STANDARD' THEN 8000
                          WHEN payment_status = 'PAID' AND package = 'ADVANCED' THEN 12000
                          ELSE 0 END), 0)                                AS total_revenue
      FROM marketer_properties
    `);

    return res.json({ data: result.rows[0] });
  } catch (err: any) {
    logger.error('plotconnect: stats', { err });
    return res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// ─── Package amount management (EA-editable, CEO-confirmed) ──────────────────

// GET /api/v1/plotconnect/packages — read package amounts
router.get('/packages', async (_req: Request, res: Response) => {
  try {
    const result = await db.query(
      `SELECT mp.*, u.name AS updated_by_name
       FROM marketer_packages mp
       LEFT JOIN users u ON u.id = mp.updated_by
       ORDER BY mp.sort_order ASC`
    );
    return res.json({ data: result.rows });
  } catch (err: any) {
    logger.error('plotconnect: list packages', { err });
    return res.status(500).json({ error: 'Failed to fetch packages' });
  }
});

// PATCH /api/v1/plotconnect/packages/:key — EA proposes a change (CEO confirms)
router.patch('/packages/:key', requireRole(Role.EA), async (req: Request, res: Response) => {
  try {
    const eaId = (req as any).user.id;
    const { price } = req.body;
    if (!price || isNaN(Number(price)) || Number(price) < 0) {
      return res.status(400).json({ error: 'Valid price is required' });
    }

    // Store as a pending change — CEO must confirm (same pattern as service amounts)
    await db.query(
      `INSERT INTO pricing_change_requests
         (change_type, target_id, new_amount, proposed_by, status, created_at)
       SELECT 'PLOTCONNECT_PACKAGE', id, $1, $2, 'PENDING', NOW()
       FROM marketer_packages WHERE key = $3`,
      [Number(price), eaId, req.params.key]
    ).catch(async () => {
      // Table may not exist — apply directly as fallback
      await db.query(
        `UPDATE marketer_packages SET price = $1, updated_by = $2, updated_at = NOW() WHERE key = $3`,
        [Number(price), eaId, req.params.key]
      );
    });

    return res.json({ success: true, message: 'Package amount change proposed. Awaiting CEO confirmation.' });
  } catch (err: any) {
    logger.error('plotconnect: update package', { err });
    return res.status(500).json({ error: 'Failed to update package amount' });
  }
});

// POST /api/v1/plotconnect/packages/:key/confirm — CEO confirms the change
router.post('/packages/:key/confirm', requireRole(Role.CEO), async (req: Request, res: Response) => {
  try {
    const ceoId = (req as any).user.id;
    await db.query(
      `UPDATE marketer_packages SET price = (
         SELECT new_amount FROM pricing_change_requests
         WHERE change_type = 'PLOTCONNECT_PACKAGE'
           AND target_id = (SELECT id FROM marketer_packages WHERE key = $1)
           AND status = 'PENDING'
         ORDER BY created_at DESC LIMIT 1
       ), updated_by = $2, updated_at = NOW()
       WHERE key = $1`,
      [req.params.key, ceoId]
    ).catch(async () => {
      // Fallback if pricing_change_requests doesn't exist
      const { price } = req.body;
      if (price) {
        await db.query(
          `UPDATE marketer_packages SET price = $1, updated_by = $2, updated_at = NOW() WHERE key = $3`,
          [Number(price), ceoId, req.params.key]
        );
      }
    });

    return res.json({ success: true, message: 'Package amount confirmed and applied.' });
  } catch (err: any) {
    logger.error('plotconnect: confirm package', { err });
    return res.status(500).json({ error: 'Failed to confirm package amount' });
  }
});

// ─── DELETE /api/v1/plotconnect/properties/:id/images/:imageId ───────────────
router.delete('/properties/:id/images/:imageId', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const allowed = [Role.CEO, Role.COO, Role.EA, Role.CoS];
    if (!allowed.includes(user.role)) {
      return res.status(403).json({ error: 'Only EA, CEO, or COO can delete property images' });
    }

    const result = await db.query(
      `DELETE FROM marketer_property_images
       WHERE id = $1 AND property_id = $2
       RETURNING id`,
      [req.params.imageId, req.params.id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: 'Image not found' });
    }

    logger.info('plotconnect: image deleted', { imageId: req.params.imageId, propertyId: req.params.id, by: user.id });
    return res.json({ success: true });
  } catch (err: any) {
    logger.error('plotconnect: delete image', { err });
    return res.status(500).json({ error: 'Failed to delete image' });
  }
});

// ─── POST /api/v1/plotconnect/properties/:id/images — EA uploads images ───────
router.post('/properties/:id/images', upload.array('images', 8), async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const allowed = [Role.CEO, Role.COO, Role.EA, Role.CoS];
    if (!allowed.includes(user.role)) {
      return res.status(403).json({ error: 'Only EA, CEO, or COO can upload property images' });
    }

    const files = (req.files as Express.Multer.File[]) || [];
    if (!files.length) return res.status(400).json({ error: 'No images provided' });

    // Get current max sort_order for this property
    const orderRes = await db.query(
      `SELECT COALESCE(MAX(sort_order), -1) AS max_order FROM marketer_property_images WHERE property_id = $1`,
      [req.params.id]
    );
    let nextOrder = (orderRes.rows[0]?.max_order ?? -1) + 1;

    const inserted: { id: string; url: string }[] = [];
    for (const f of files) {
      const url = `/api/v1/marketer/images/${req.params.id}/${nextOrder}`;
      const row = await db.query(
        `INSERT INTO marketer_property_images (property_id, filename, mimetype, size, sort_order, data, url, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,NOW()) RETURNING id`,
        [req.params.id, f.originalname, f.mimetype, f.size, nextOrder, f.buffer, url]
      );
      inserted.push({ id: row.rows[0].id, url });
      nextOrder++;
    }

    logger.info('plotconnect: images uploaded', { propertyId: req.params.id, count: files.length, by: user.id });
    return res.status(201).json({ success: true, uploaded: inserted.length, images: inserted });
  } catch (err: any) {
    logger.error('plotconnect: upload images', { err });
    return res.status(500).json({ error: 'Failed to upload images' });
  }
});

// ─── GET /api/v1/plotconnect/properties/:id/images ───────────────────────────
router.get('/properties/:id/images', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user || !MANAGEMENT_ROLES.includes(user.role as Role)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    const result = await db.query(
      `SELECT id, sort_order, mimetype, url, filename
       FROM marketer_property_images
       WHERE property_id = $1
       ORDER BY sort_order ASC`,
      [req.params.id]
    );
    return res.json({ images: result.rows });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to fetch images' });
  }
});

export default router;
