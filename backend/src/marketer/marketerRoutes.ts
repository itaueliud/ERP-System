/**
 * Marketer Routes — /api/v1/marketer
 * Implements Tab 2–5 of the Agent portal spec (TST PlotConnect module).
 * Doc: Agent Portal spec — Tab 2, Tab 3, Tab 4, Tab 5, Section 14
 */
import { Router, Request, Response } from 'express';
import multer from 'multer';
import { db } from '../database/connection';
import logger from '../utils/logger';

// multer — memory storage, max 8 images × 5 MB each
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 8 },
  fileFilter: (_req, file, cb) => {
    cb(null, file.mimetype.startsWith('image/'));
  },
});

const router = Router();

// ─── Package amounts (EA-editable, CEO-confirmed) ─────────────────────────────
// GET /api/v1/marketer/packages — returns live package amounts for the form
router.get('/packages', async (_req: Request, res: Response) => {
  try {
    // Try to load EA-configured amounts from DB; fall back to defaults
    const result = await db.query(
      `SELECT key, label, price, description AS desc
       FROM marketer_packages
       ORDER BY sort_order ASC`
    );
    if (result.rows.length) {
      return res.json({ data: result.rows });
    }
    // Default amounts (Section E)
    return res.json({
      data: [
        { key: 'BASIC',    label: 'Basic',    price: 4000,  desc: 'Starter visibility for the listing' },
        { key: 'STANDARD', label: 'Standard', price: 8000,  desc: 'More reach and additional features' },
        { key: 'ADVANCED', label: 'Advanced', price: 12000, desc: 'Top placement and highest priority visibility' },
      ],
    });
  } catch {
    // Table may not exist yet — return defaults
    return res.json({
      data: [
        { key: 'BASIC',    label: 'Basic',    price: 4000,  desc: 'Starter visibility for the listing' },
        { key: 'STANDARD', label: 'Standard', price: 8000,  desc: 'More reach and additional features' },
        { key: 'ADVANCED', label: 'Advanced', price: 12000, desc: 'Top placement and highest priority visibility' },
      ],
    });
  }
});

// ─── Properties ───────────────────────────────────────────────────────────────

// GET /api/v1/marketer/properties — list this agent's submitted properties
router.get('/properties', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const result = await db.query(
      `SELECT id, owner_name, owner_phone, owner_phone2, owner_whatsapp,
              property_name, county, area, map_link, booking_type,
              property_types, rooms, package, contact_person,
              description, website_link, number_of_rooms, price_per_room,
              status, payment_status, payment_confirmed_at,
              created_at, updated_at
       FROM marketer_properties
       WHERE submitted_by = $1
       ORDER BY created_at DESC`,
      [userId]
    );

    const properties = result.rows.map((r: any) => ({
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
      contactPerson:      r.contact_person,
      description:        r.description,
      websiteLink:        r.website_link,
      numberOfRooms:      r.number_of_rooms,
      pricePerRoom:       r.price_per_room,
      status:             r.status,
      paymentStatus:      r.payment_status,
      paymentConfirmedAt: r.payment_confirmed_at,
      createdAt:          r.created_at,
      updatedAt:          r.updated_at,
    }));

    return res.json({ data: properties });
  } catch (err: any) {
    logger.error('marketer: list properties', { err });
    return res.status(500).json({ error: 'Failed to fetch properties' });
  }
});

// POST /api/v1/marketer/properties — submit a new property listing
// Accepts multipart/form-data (images) or JSON
router.post('/properties', upload.array('images', 8), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    // Support both multipart (with images) and JSON body
    const body = req.body || {};

    const ownerName     = body.ownerName?.trim();
    const ownerPhone    = body.ownerPhone?.trim();
    const ownerPhone2   = body.ownerPhone2?.trim() || null;
    const ownerWhatsapp = body.ownerWhatsapp?.trim() || null;
    const propertyName  = body.propertyName?.trim();
    const county        = body.county?.trim();
    const area          = body.area?.trim();
    const mapLink       = body.mapLink?.trim() || null;
    const bookingType   = body.bookingType || 'MONTHLY';
    const contactPerson = body.contactPerson?.trim() || null;
    const description   = body.description?.trim() || null;
    const websiteLink   = body.websiteLink?.trim() || null;
    const numberOfRooms = body.numberOfRooms?.trim() || null;
    const pricePerRoom  = body.pricePerRoom?.trim() || null;

    let propertyTypes: string[] = [];
    try { propertyTypes = typeof body.propertyTypes === 'string' ? JSON.parse(body.propertyTypes) : (body.propertyTypes || []); } catch { propertyTypes = []; }

    let rooms: any[] = [];
    try { rooms = typeof body.rooms === 'string' ? JSON.parse(body.rooms) : (body.rooms || []); } catch { rooms = []; }

    const validPackages = ['BASIC', 'STANDARD', 'ADVANCED'];
    const pkg = validPackages.includes(body.package) ? body.package : 'BASIC';

    // Validation
    if (!ownerName)              return res.status(400).json({ error: 'Owner name is required' });
    if (!ownerPhone)             return res.status(400).json({ error: 'Phone number is required' });
    if (!propertyName)           return res.status(400).json({ error: 'Property name is required' });
    if (!county)                 return res.status(400).json({ error: 'County is required' });
    if (!area)                   return res.status(400).json({ error: 'Area is required' });
    if (!propertyTypes.length)   return res.status(400).json({ error: 'At least one property type is required' });

    const result = await db.query(
      `INSERT INTO marketer_properties
         (owner_name, owner_phone, owner_phone2, owner_whatsapp,
          property_name, county, area, map_link, booking_type,
          property_types, rooms, package,
          contact_person, description, website_link,
          number_of_rooms, price_per_room,
          status, payment_status, submitted_by, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,
               'PENDING','UNPAID',$18,NOW(),NOW())
       RETURNING id, created_at`,
      [
        ownerName, ownerPhone, ownerPhone2, ownerWhatsapp,
        propertyName, county, area, mapLink, bookingType,
        JSON.stringify(propertyTypes), JSON.stringify(rooms), pkg,
        contactPerson, description, websiteLink,
        numberOfRooms, pricePerRoom,
        userId,
      ]
    );

    const propId = result.rows[0].id;

    // Handle uploaded images via multer (req.files is Express.Multer.File[])
    const files = (req.files as Express.Multer.File[]) || [];
    if (files.length) {
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        await db.query(
          `INSERT INTO marketer_property_images (property_id, filename, mimetype, size, sort_order, data, url, created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,NOW())`,
          [propId, f.originalname, f.mimetype, f.size, i, f.buffer,
           `/api/v1/marketer/images/${propId}/${i}`]
        ).catch(() => { /* images table may not exist yet — non-blocking */ });
      }
    }

    // Notify COO and CEO after submission (non-blocking)
    db.query(
      `INSERT INTO notifications (user_id, title, message, type, created_at)
       SELECT u.id,
              'New PlotConnect Property Submitted',
              $1,
              'NEW_PLOTCONNECT_PROPERTY',
              NOW()
       FROM users u
       WHERE u.role IN ('COO','CEO')`,
      [`New property "${propertyName}" submitted by agent for review.`]
    ).catch(() => { /* non-blocking */ });

    return res.status(201).json({ id: propId, createdAt: result.rows[0].created_at });
  } catch (err: any) {
    logger.error('marketer: create property', { err });
    return res.status(500).json({ error: 'Failed to submit property' });
  }
});

// GET /api/v1/marketer/properties/:id/payment-status — poll payment status
router.get('/properties/:id/payment-status', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const result = await db.query(
      `SELECT payment_status, payment_confirmed_at
       FROM marketer_properties
       WHERE id = $1 AND submitted_by = $2`,
      [req.params.id, userId]
    );

    if (!result.rows.length) return res.status(404).json({ error: 'Property not found' });
    return res.json({
      paymentStatus:      result.rows[0].payment_status,
      paymentConfirmedAt: result.rows[0].payment_confirmed_at,
    });
  } catch (err: any) {
    logger.error('marketer: payment status', { err });
    return res.status(500).json({ error: 'Failed to fetch payment status' });
  }
});

// POST /api/v1/marketer/properties/:id/initiate-payment
// Called by the frontend after STK push is sent — marks property as AWAITING_CONFIRMATION
// and stores the CheckoutRequestID so we can query Safaricom for the result
router.post('/properties/:id/initiate-payment', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { checkoutRequestId, reset } = req.body;

    // Verify ownership
    const check = await db.query(
      `SELECT id FROM marketer_properties WHERE id = $1 AND submitted_by = $2`,
      [req.params.id, userId]
    );
    if (!check.rows.length) return res.status(404).json({ error: 'Property not found' });

    // Allow resend: update if UNPAID or (AWAITING + reset flag)
    await db.query(
      `UPDATE marketer_properties
       SET payment_status = 'AWAITING_CONFIRMATION',
           checkout_request_id = COALESCE($2, checkout_request_id),
           updated_at = NOW()
       WHERE id = $1
         AND ($3 = true OR payment_status = 'UNPAID')`,
      [req.params.id, checkoutRequestId || null, reset === true]
    );

    return res.json({ success: true });
  } catch (err: any) {
    logger.error('marketer: initiate payment', { err });
    return res.status(500).json({ error: 'Failed to update payment status' });
  }
});

// POST /api/v1/marketer/properties/:id/query-payment
// Actively queries Safaricom STK status and updates the DB — used when callback doesn't arrive
router.post('/properties/:id/query-payment', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const prop = await db.query(
      `SELECT id, payment_status, checkout_request_id
       FROM marketer_properties WHERE id = $1 AND submitted_by = $2`,
      [req.params.id, userId]
    );
    if (!prop.rows.length) return res.status(404).json({ error: 'Property not found' });

    const { payment_status, checkout_request_id } = prop.rows[0];

    // Already paid — nothing to do
    if (payment_status === 'PAID') return res.json({ paymentStatus: 'PAID' });

    // No checkout request ID stored — can't query Safaricom
    if (!checkout_request_id) {
      return res.json({ paymentStatus: payment_status, message: 'No checkout request ID available' });
    }

    // Query Safaricom for the real status
    const { darajaClient } = await import('../services/daraja');
    const result = await darajaClient.getPaymentStatus(checkout_request_id);

    if (result.status === 'COMPLETED') {
      await db.query(
        `UPDATE marketer_properties
         SET payment_status = 'PAID', payment_confirmed_at = NOW(), updated_at = NOW()
         WHERE id = $1`,
        [req.params.id]
      );
      // Also update the payments table
      await db.query(
        `UPDATE payments SET status = 'COMPLETED', updated_at = NOW()
         WHERE transaction_id = $1`,
        [checkout_request_id]
      ).catch(() => {});
      // Auto-publish if approved
      await db.query(
        `UPDATE marketer_properties SET status = 'PUBLISHED', updated_at = NOW()
         WHERE id = $1 AND status = 'APPROVED'`,
        [req.params.id]
      ).catch(() => {});
      return res.json({ paymentStatus: 'PAID' });
    }

    if (result.status === 'FAILED') {
      await db.query(
        `UPDATE marketer_properties SET payment_status = 'FAILED', updated_at = NOW() WHERE id = $1`,
        [req.params.id]
      ).catch(() => {});
      return res.json({ paymentStatus: 'FAILED' });
    }

    return res.json({ paymentStatus: payment_status });
  } catch (err: any) {
    logger.error('marketer: query payment', { err });
    return res.status(500).json({ error: 'Failed to query payment status' });
  }
});

// ─── MPesa Messages ───────────────────────────────────────────────────────────

// GET /api/v1/marketer/mpesa-messages — list this agent's sent messages
router.get('/mpesa-messages', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const result = await db.query(
      `SELECT id, message, status, created_at
       FROM marketer_mpesa_messages
       WHERE sent_by = $1
       ORDER BY created_at DESC`,
      [userId]
    );

    return res.json({
      data: result.rows.map((r: any) => ({
        id: r.id, message: r.message, status: r.status, createdAt: r.created_at,
      })),
    });
  } catch (err: any) {
    logger.error('marketer: list mpesa messages', { err });
    return res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// POST /api/v1/marketer/mpesa-messages — forward a manual M-Pesa message to admin
router.post('/mpesa-messages', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { message } = req.body;
    if (!message?.trim()) return res.status(400).json({ error: 'Message is required' });

    const result = await db.query(
      `INSERT INTO marketer_mpesa_messages (message, status, sent_by, created_at)
       VALUES ($1, 'PENDING', $2, NOW())
       RETURNING id, created_at`,
      [message.trim(), userId]
    );

    return res.status(201).json({ id: result.rows[0].id, createdAt: result.rows[0].created_at });
  } catch (err: any) {
    logger.error('marketer: create mpesa message', { err });
    return res.status(500).json({ error: 'Failed to send message' });
  }
});

// ─── GET /api/v1/marketer/properties/:id/images — list images for a property ──
router.get('/properties/:id/images', async (req: Request, res: Response) => {
  try {
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

// ─── GET /api/v1/marketer/images/:propertyId/:index — serve image bytes ───────
router.get('/images/:propertyId/:index', async (req: Request, res: Response) => {
  try {
    const result = await db.query(
      `SELECT data, mimetype, filename
       FROM marketer_property_images
       WHERE property_id = $1 AND sort_order = $2
       LIMIT 1`,
      [req.params.propertyId, parseInt(req.params.index)]
    );
    if (!result.rows.length || !result.rows[0].data) {
      return res.status(404).json({ error: 'Image not found' });
    }
    const { data, mimetype, filename } = result.rows[0];
    res.set('Content-Type', mimetype || 'image/jpeg');
    res.set('Cache-Control', 'public, max-age=86400');
    res.set('Content-Disposition', `inline; filename="${filename}"`);
    return res.send(data);
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to serve image' });
  }
});

export default router;
