import { Router, Request, Response } from 'express';
import {
  propertyService,
  CreatePropertyInput,
  UpdatePropertyInput,
  PropertyType,
  SearchPropertyFilters,
} from './propertyService';
import { Role } from '../auth/authorizationService';
import logger from '../utils/logger';

const router = Router();

/**
 * Create a new property listing
 * POST /api/properties
 * Requirements: 11.1, 11.2, 11.3
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { title, description, location, country, price, currency, propertyType, size } = req.body;

    if (!title || !description || !location || !country || !price || !currency || !propertyType || size === undefined) {
      return res.status(400).json({
        error: 'Missing required fields: title, description, location, country, price, currency, propertyType, size',
      });
    }

    const input: CreatePropertyInput = {
      title,
      description,
      location,
      country,
      price: parseFloat(price),
      currency,
      propertyType,
      size: parseFloat(size),
      createdBy: userId,
    };

    const listing = await propertyService.createListing(input);
    return res.status(201).json(listing);
  } catch (error: any) {
    logger.error('Error creating property listing', { error, body: req.body });
    return res.status(400).json({ error: error.message || 'Failed to create property listing' });
  }
});

/**
 * List property listings (public — hides SOLD/UNAVAILABLE by default)
 * GET /api/properties
 * Requirements: 11.8, 11.9, 11.12
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { db } = await import('../database/connection');
    const result = await db.query(
      `SELECT id, reference_number, title, location, country, property_type,
              price, currency, size, view_count,
              description, status, created_at
       FROM property_listings
       ORDER BY created_at DESC
       LIMIT 100`
    );
    return res.json({ success: true, data: result.rows });
  } catch (error: any) {
    logger.error('Error listing property listings', { error, query: req.query });
    return res.status(500).json({ error: 'Failed to list property listings' });
  }
});

/**
 * Search property listings with full-text search (public — AVAILABLE only)
 * GET /api/properties/search
 * Requirements: 11.8, 11.9, 11.12
 */
router.get('/search', async (req: Request, res: Response) => {
  try {
    const filters: SearchPropertyFilters = {
      query: req.query.q as string | undefined,
      country: req.query.country as string | undefined,
      propertyType: req.query.propertyType as PropertyType | undefined,
      priceMin: req.query.priceMin ? parseFloat(req.query.priceMin as string) : undefined,
      priceMax: req.query.priceMax ? parseFloat(req.query.priceMax as string) : undefined,
      sizeMin: req.query.sizeMin ? parseFloat(req.query.sizeMin as string) : undefined,
      sizeMax: req.query.sizeMax ? parseFloat(req.query.sizeMax as string) : undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
      offset: req.query.offset ? parseInt(req.query.offset as string, 10) : undefined,
    };

    const result = await propertyService.searchListings(filters);
    return res.json(result);
  } catch (error: any) {
    logger.error('Error searching property listings', { error, query: req.query });
    return res.status(500).json({ error: 'Failed to search property listings' });
  }
});

/**
 * Get search suggestions for autocomplete
 * GET /api/properties/suggestions?q=<query>
 * Requirements: 11.9
 */
router.get('/suggestions', async (req: Request, res: Response) => {
  try {
    const query = req.query.q as string | undefined;
    if (!query) {
      return res.json([]);
    }
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 10;
    const suggestions = await propertyService.getSearchSuggestions(query, limit);
    return res.json(suggestions);
  } catch (error: any) {
    logger.error('Error getting search suggestions', { error, query: req.query });
    return res.status(500).json({ error: 'Failed to get search suggestions' });
  }
});

/**
 * Get a property listing by ID (increments view count)
 * GET /api/properties/:listingId
 * Requirements: 11.10
 */
router.get('/:listingId', async (req: Request, res: Response) => {
  try {
    const { listingId } = req.params;

    const listing = await propertyService.getListing(listingId);
    if (!listing) {
      return res.status(404).json({ error: 'Property listing not found' });
    }

    // Increment view count asynchronously (don't block response)
    propertyService.incrementViewCount(listingId).catch((err) => {
      logger.error('Failed to increment view count', { err, listingId });
    });

    return res.json(listing);
  } catch (error: any) {
    logger.error('Error getting property listing', { error, listingId: req.params.listingId });
    return res.status(500).json({ error: 'Failed to get property listing' });
  }
});

/**
 * Update a property listing
 * PATCH /api/properties/:listingId
 * Doc §10: Only a Trainer can modify placement tier after submission
 * Requirements: 11.11
 */
router.patch('/:listingId', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const userRole = (req as any).user?.role;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Placement tier modification is Trainer-only (doc §10 Placement Modification Rule)
    if (req.body.placementTier !== undefined && userRole !== Role.TRAINER) {
      return res.status(403).json({ error: 'Only a Trainer can modify the placement tier' });
    }

    const { listingId } = req.params;
    const updates: UpdatePropertyInput = {};

    if (req.body.title !== undefined) updates.title = req.body.title;
    if (req.body.description !== undefined) updates.description = req.body.description;
    if (req.body.location !== undefined) updates.location = req.body.location;
    if (req.body.country !== undefined) updates.country = req.body.country;
    if (req.body.price !== undefined) updates.price = parseFloat(req.body.price);
    if (req.body.currency !== undefined) updates.currency = req.body.currency;
    if (req.body.propertyType !== undefined) updates.propertyType = req.body.propertyType;
    if (req.body.size !== undefined) updates.size = parseFloat(req.body.size);
    if (req.body.status !== undefined) updates.status = req.body.status;

    const listing = await propertyService.updateListing(listingId, userId, updates);
    return res.json(listing);
  } catch (error: any) {
    logger.error('Error updating property listing', { error, listingId: req.params.listingId });
    if (error.message?.includes('not found')) {
      return res.status(404).json({ error: error.message });
    }
    if (error.message?.includes('Unauthorized')) {
      return res.status(403).json({ error: error.message });
    }
    return res.status(400).json({ error: error.message || 'Failed to update property listing' });
  }
});

/**
 * Delete (mark as unavailable) a property listing
 * DELETE /api/properties/:listingId
 * Requirements: 11.11
 */
router.delete('/:listingId', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { listingId } = req.params;
    const listing = await propertyService.deleteListing(listingId, userId);
    return res.json(listing);
  } catch (error: any) {
    logger.error('Error deleting property listing', { error, listingId: req.params.listingId });
    if (error.message?.includes('not found')) {
      return res.status(404).json({ error: error.message });
    }
    if (error.message?.includes('Unauthorized')) {
      return res.status(403).json({ error: error.message });
    }
    return res.status(400).json({ error: error.message || 'Failed to delete property listing' });
  }
});

// ============================================================================
// Property Image Routes
// Requirements: 11.4, 11.5, 11.6
// ============================================================================

/**
 * Upload an image for a property listing
 * POST /api/properties/:listingId/images
 * Requirements: 11.4, 11.5, 11.6
 */
router.post('/:listingId/images', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { listingId } = req.params;

    // Expect multer or similar middleware to populate req.file
    const file = (req as any).file as
      | { originalname: string; mimetype: string; size: number; buffer: Buffer }
      | undefined;

    if (!file) {
      return res.status(400).json({ error: 'No image file provided. Use multipart/form-data with an "image" field.' });
    }

    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
    if (!allowedTypes.includes(file.mimetype)) {
      return res.status(400).json({ error: 'Only image files are allowed (jpeg, jpg, png, gif)' });
    }

    const image = await propertyService.addImage(
      listingId,
      userId,
      file.buffer,
      file.mimetype,
      file.originalname
    );

    return res.status(201).json(image);
  } catch (error: any) {
    logger.error('Error uploading property image', { error, listingId: req.params.listingId });
    if (error.message?.includes('not found')) {
      return res.status(404).json({ error: error.message });
    }
    if (error.message?.includes('Maximum of')) {
      return res.status(422).json({ error: error.message });
    }
    return res.status(400).json({ error: error.message || 'Failed to upload image' });
  }
});

/**
 * Get all images for a property listing
 * GET /api/properties/:listingId/images
 * Requirement: 11.4
 */
router.get('/:listingId/images', async (req: Request, res: Response) => {
  try {
    const { listingId } = req.params;
    const images = await propertyService.getImages(listingId);
    return res.json(images);
  } catch (error: any) {
    logger.error('Error getting property images', { error, listingId: req.params.listingId });
    return res.status(500).json({ error: 'Failed to get property images' });
  }
});

/**
 * Delete an image from a property listing
 * DELETE /api/properties/:listingId/images/:imageId
 * Requirement: 11.5
 */
router.delete('/:listingId/images/:imageId', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { listingId, imageId } = req.params;
    await propertyService.deleteImage(imageId, listingId, userId);
    return res.status(204).send();
  } catch (error: any) {
    logger.error('Error deleting property image', {
      error,
      listingId: req.params.listingId,
      imageId: req.params.imageId,
    });
    if (error.message?.includes('not found') || error.message?.includes('Image not found')) {
      return res.status(404).json({ error: error.message });
    }
    return res.status(400).json({ error: error.message || 'Failed to delete image' });
  }
});

/**
 * Reorder images for a property listing
 * PATCH /api/properties/:listingId/images/reorder
 * Requirement: 11.4 (track image display order)
 */
router.patch('/:listingId/images/reorder', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { listingId } = req.params;
    const { imageIds } = req.body;

    if (!Array.isArray(imageIds) || imageIds.length === 0) {
      return res.status(400).json({ error: 'imageIds must be a non-empty array' });
    }

    const images = await propertyService.reorderImages(listingId, userId, imageIds);
    return res.json(images);
  } catch (error: any) {
    logger.error('Error reordering property images', { error, listingId: req.params.listingId });
    if (error.message?.includes('not found')) {
      return res.status(404).json({ error: error.message });
    }
    if (error.message?.includes('Unauthorized')) {
      return res.status(403).json({ error: error.message });
    }
    return res.status(400).json({ error: error.message || 'Failed to reorder images' });
  }
});

export default router;
