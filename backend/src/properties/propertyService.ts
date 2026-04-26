import { db } from '../database/connection';
import { fileStorageService } from '../files/fileService';
import logger from '../utils/logger';

export enum PropertyType {
  // Doc §10: TST PlotConnect property types
  STUDENT_RESIDENCE = 'STUDENT_RESIDENCE',  // Type 1 — fixed price per room
  APARTMENT         = 'APARTMENT',          // Type 2 — Others
  AIRBNB            = 'AIRBNB',
  LODGE             = 'LODGE',
  RENTAL_FLAT       = 'RENTAL_FLAT',
  // Legacy generic types kept for backward compat
  LAND              = 'LAND',
  RESIDENTIAL       = 'RESIDENTIAL',
  COMMERCIAL        = 'COMMERCIAL',
  INDUSTRIAL        = 'INDUSTRIAL',
  AGRICULTURAL      = 'AGRICULTURAL',
}

export enum PlacementTier {
  // Doc §10: Placement tiers for Type 2 properties (amounts editable by EA/CFO/CoS/CEO)
  TOP    = 'TOP',
  MEDIUM = 'MEDIUM',
  BASIC  = 'BASIC',
}

export enum PropertyStatus {
  AVAILABLE = 'AVAILABLE',
  SOLD = 'SOLD',
  UNAVAILABLE = 'UNAVAILABLE',
}

export interface CreatePropertyInput {
  title: string;
  description: string;
  location: string;
  country: string;
  price: number;
  currency: string;
  propertyType: PropertyType;
  placementTier?: PlacementTier;  // Doc §10: required for Type 2 properties
  numberOfRooms?: number;          // Doc §10: required for STUDENT_RESIDENCE
  numberOfUnits?: number;          // Doc §10: for Type 2
  monthlyOrDailyStay?: 'MONTHLY' | 'DAILY'; // Doc §10: for Type 2
  contactPerson?: string;
  websiteLink?: string;
  size: number;
  createdBy: string;
}

export interface UpdatePropertyInput {
  title?: string;
  description?: string;
  location?: string;
  country?: string;
  price?: number;
  currency?: string;
  propertyType?: PropertyType;
  placementTier?: PlacementTier;  // Trainer-only modification per doc §10
  size?: number;
  status?: PropertyStatus;
}

export interface PropertyListing {
  id: string;
  referenceNumber: string;
  title: string;
  description: string;
  location: string;
  country: string;
  price: number;
  currency: string;
  propertyType: PropertyType;
  placementTier?: PlacementTier;
  size: number;
  status: PropertyStatus;
  viewCount: number;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ListPropertyFilters {
  country?: string;
  propertyType?: PropertyType;
  status?: PropertyStatus;
  priceMin?: number;
  priceMax?: number;
  sizeMin?: number;
  sizeMax?: number;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface SearchPropertyFilters extends ListPropertyFilters {
  // Full-text search across title, description, location
  query?: string;
}

export interface SearchSuggestion {
  type: 'title' | 'location' | 'country';
  value: string;
  count: number;
}

export interface PropertyImage {
  id: string;
  propertyId: string;
  fileId: string;
  url: string;
  thumbnailUrl: string;
  displayOrder: number;
  createdAt: Date;
}

/** Maximum number of images allowed per property listing (Requirement 11.4) */
export const MAX_IMAGES_PER_LISTING = 20;

/**
 * Property Listing Service
 * Handles CRUD operations for TST PlotConnect property listings
 * Requirements: 11.1-11.3
 */
export class PropertyService {
  /**
   * Generate unique listing reference number in format TST-PLT-YYYY-NNNNNN
   * Requirement 11.7: Assign unique listing reference number
   */
  async generateReferenceNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `TST-PLT-${year}-`;

    const result = await db.query(
      `SELECT reference_number FROM property_listings
       WHERE reference_number LIKE $1
       ORDER BY reference_number DESC
       LIMIT 1`,
      [`${prefix}%`]
    );

    let sequence = 1;
    if (result.rows.length > 0) {
      const lastRef = result.rows[0].reference_number as string;
      const parts = lastRef.split('-');
      const lastSequence = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(lastSequence)) {
        sequence = lastSequence + 1;
      }
    }

    return `${prefix}${sequence.toString().padStart(6, '0')}`;
  }

  /**
   * Create a new property listing
   * Requirements: 11.1, 11.2, 11.3
   */
  async createListing(input: CreatePropertyInput): Promise<PropertyListing> {
    try {
      // Validate required fields
      if (!input.title || !input.description || !input.location || !input.country) {
        throw new Error('Missing required fields: title, description, location, country');
      }
      if (!input.price || input.price <= 0) {
        throw new Error('Price must be greater than 0');
      }
      if (!input.currency) {
        throw new Error('Currency is required');
      }
      if (!input.propertyType || !Object.values(PropertyType).includes(input.propertyType)) {
        throw new Error(
          `Invalid property type. Must be one of: ${Object.values(PropertyType).join(', ')}`
        );
      }
      if (input.size === undefined || input.size === null || input.size < 0) {
        throw new Error('Size must be a non-negative number');
      }

      const referenceNumber = await this.generateReferenceNumber();

      const result = await db.query(
        `INSERT INTO property_listings (
          reference_number, title, description, location, country,
          price, currency, property_type, size, status, view_count, created_by
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING id, reference_number, title, description, location, country,
                  price, currency, property_type, size, status, view_count,
                  created_by, created_at, updated_at`,
        [
          referenceNumber,
          input.title,
          input.description,
          input.location,
          input.country,
          input.price,
          input.currency,
          input.propertyType,
          input.size,
          PropertyStatus.AVAILABLE,
          0,
          input.createdBy,
        ]
      );

      logger.info('Property listing created', {
        id: result.rows[0].id,
        referenceNumber,
        createdBy: input.createdBy,
      });

      return this.mapFromDb(result.rows[0]);
    } catch (error) {
      logger.error('Failed to create property listing', { error, input });
      throw error;
    }
  }

  /**
   * Get a listing by ID
   */
  async getListing(listingId: string): Promise<PropertyListing | null> {
    try {
      const result = await db.query(
        `SELECT id, reference_number, title, description, location, country,
                price, currency, property_type, size, status, view_count,
                created_by, created_at, updated_at
         FROM property_listings
         WHERE id = $1`,
        [listingId]
      );

      if (result.rows.length === 0) return null;
      return this.mapFromDb(result.rows[0]);
    } catch (error) {
      logger.error('Failed to get property listing', { error, listingId });
      throw error;
    }
  }

  /**
   * Get a listing by reference number
   */
  async getListingByReference(referenceNumber: string): Promise<PropertyListing | null> {
    try {
      const result = await db.query(
        `SELECT id, reference_number, title, description, location, country,
                price, currency, property_type, size, status, view_count,
                created_by, created_at, updated_at
         FROM property_listings
         WHERE reference_number = $1`,
        [referenceNumber]
      );

      if (result.rows.length === 0) return null;
      return this.mapFromDb(result.rows[0]);
    } catch (error) {
      logger.error('Failed to get property listing by reference', { error, referenceNumber });
      throw error;
    }
  }

  /**
   * List property listings with optional filters
   * Requirements: 11.8, 11.12
   */
  /**
     * List property listings with optional filters
     * Requirements: 11.8, 11.12
     */
    async listListings(
      filters: ListPropertyFilters = {}
    ): Promise<{ listings: PropertyListing[]; total: number }> {
      try {
        const conditions: string[] = [];
        const values: any[] = [];
        let paramIndex = 1;

        if (filters.country) {
          conditions.push(`country = $${paramIndex++}`);
          values.push(filters.country);
        }

        if (filters.propertyType) {
          conditions.push(`property_type = $${paramIndex++}`);
          values.push(filters.propertyType);
        }

        if (filters.status) {
          conditions.push(`status = $${paramIndex++}`);
          values.push(filters.status);
        }

        if (filters.priceMin !== undefined) {
          conditions.push(`price >= $${paramIndex++}`);
          values.push(filters.priceMin);
        }

        if (filters.priceMax !== undefined) {
          conditions.push(`price <= $${paramIndex++}`);
          values.push(filters.priceMax);
        }

        if (filters.sizeMin !== undefined) {
          conditions.push(`size >= $${paramIndex++}`);
          values.push(filters.sizeMin);
        }

        if (filters.sizeMax !== undefined) {
          conditions.push(`size <= $${paramIndex++}`);
          values.push(filters.sizeMax);
        }

        if (filters.search) {
          conditions.push(
            `(title ILIKE $${paramIndex} OR description ILIKE $${paramIndex} OR location ILIKE $${paramIndex})`
          );
          values.push(`%${filters.search}%`);
          paramIndex++;
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

        const countResult = await db.query(
          `SELECT COUNT(*) FROM property_listings ${whereClause}`,
          values
        );
        const total = parseInt(countResult.rows[0].count, 10);

        const limit = filters.limit || 50;
        const offset = filters.offset || 0;

        const listValues = [...values, limit, offset];
        const listResult = await db.query(
          `SELECT id, reference_number, title, description, location, country,
                  price, currency, property_type, size, status, view_count,
                  created_by, created_at, updated_at
           FROM property_listings
           ${whereClause}
           ORDER BY created_at DESC
           LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
          listValues
        );

        return {
          listings: listResult.rows.map((row) => this.mapFromDb(row)),
          total,
        };
      } catch (error) {
        logger.error('Failed to list property listings', { error, filters });
        throw error;
      }
    }

    /**
     * Search property listings with full-text search across title, description, location.
     * Public search only returns AVAILABLE listings by default (hides SOLD/UNAVAILABLE).
     * Requirements: 11.8, 11.9, 11.12
     */
    async searchListings(
      filters: SearchPropertyFilters = {}
    ): Promise<{ listings: PropertyListing[]; total: number }> {
      // Default to AVAILABLE for public search (hides SOLD/UNAVAILABLE)
      const searchFilters: ListPropertyFilters = {
        ...filters,
        status: filters.status ?? PropertyStatus.AVAILABLE,
        // Map query to search if provided
        search: filters.query ?? filters.search,
      };
      return this.listListings(searchFilters);
    }

    /**
     * Get search suggestions for autocomplete based on a partial query string.
     * Only returns suggestions from AVAILABLE listings.
     * Requirements: 11.9
     */
    async getSearchSuggestions(
      query: string,
      limit = 10
    ): Promise<SearchSuggestion[]> {
      try {
        if (!query || query.trim().length < 2) {
          return [];
        }

        const pattern = `%${query.trim()}%`;

        // Fetch distinct title, location, and country suggestions in parallel
        const [titleResult, locationResult, countryResult] = await Promise.all([
          db.query(
            `SELECT title AS value, COUNT(*) AS count
             FROM property_listings
             WHERE status = $1 AND title ILIKE $2
             GROUP BY title
             ORDER BY count DESC
             LIMIT $3`,
            [PropertyStatus.AVAILABLE, pattern, limit]
          ),
          db.query(
            `SELECT location AS value, COUNT(*) AS count
             FROM property_listings
             WHERE status = $1 AND location ILIKE $2
             GROUP BY location
             ORDER BY count DESC
             LIMIT $3`,
            [PropertyStatus.AVAILABLE, pattern, limit]
          ),
          db.query(
            `SELECT country AS value, COUNT(*) AS count
             FROM property_listings
             WHERE status = $1 AND country ILIKE $2
             GROUP BY country
             ORDER BY count DESC
             LIMIT $3`,
            [PropertyStatus.AVAILABLE, pattern, limit]
          ),
        ]);

        const suggestions: SearchSuggestion[] = [
          ...titleResult.rows.map((r: any) => ({
            type: 'title' as const,
            value: r.value,
            count: parseInt(r.count, 10),
          })),
          ...locationResult.rows.map((r: any) => ({
            type: 'location' as const,
            value: r.value,
            count: parseInt(r.count, 10),
          })),
          ...countryResult.rows.map((r: any) => ({
            type: 'country' as const,
            value: r.value,
            count: parseInt(r.count, 10),
          })),
        ];

        // Sort by count descending and return top `limit` results
        return suggestions.sort((a, b) => b.count - a.count).slice(0, limit);
      } catch (error) {
        logger.error('Failed to get search suggestions', { error, query });
        throw error;
      }
    }

  /**
   * Update a property listing
   * Requirements: 11.11
   */
  async updateListing(
    listingId: string,
    userId: string,
    updates: UpdatePropertyInput
  ): Promise<PropertyListing> {
    try {
      const existing = await this.getListing(listingId);
      if (!existing) {
        throw new Error('Property listing not found');
      }

      if (existing.createdBy !== userId) {
        throw new Error('Unauthorized: You can only update your own listings');
      }

      if (updates.propertyType && !Object.values(PropertyType).includes(updates.propertyType)) {
        throw new Error(
          `Invalid property type. Must be one of: ${Object.values(PropertyType).join(', ')}`
        );
      }

      if (updates.price !== undefined && updates.price <= 0) {
        throw new Error('Price must be greater than 0');
      }

      if (updates.size !== undefined && updates.size < 0) {
        throw new Error('Size must be a non-negative number');
      }

      const fields: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      const fieldMap: Record<string, string> = {
        title: 'title',
        description: 'description',
        location: 'location',
        country: 'country',
        price: 'price',
        currency: 'currency',
        propertyType: 'property_type',
        size: 'size',
        status: 'status',
      };

      for (const [key, col] of Object.entries(fieldMap)) {
        const val = (updates as any)[key];
        if (val !== undefined) {
          fields.push(`${col} = $${paramIndex++}`);
          values.push(val);
        }
      }

      if (fields.length === 0) {
        throw new Error('No fields to update');
      }

      fields.push(`updated_at = NOW()`);
      values.push(listingId);

      const result = await db.query(
        `UPDATE property_listings
         SET ${fields.join(', ')}
         WHERE id = $${paramIndex}
         RETURNING id, reference_number, title, description, location, country,
                   price, currency, property_type, size, status, view_count,
                   created_by, created_at, updated_at`,
        values
      );

      if (result.rows.length === 0) {
        throw new Error('Property listing not found');
      }

      logger.info('Property listing updated', { listingId, userId, updates });
      return this.mapFromDb(result.rows[0]);
    } catch (error) {
      logger.error('Failed to update property listing', { error, listingId, userId });
      throw error;
    }
  }

  /**
   * Soft delete a listing by marking it as UNAVAILABLE
   * Requirements: 11.11
   */
  async deleteListing(listingId: string, userId: string): Promise<PropertyListing> {
    try {
      const existing = await this.getListing(listingId);
      if (!existing) {
        throw new Error('Property listing not found');
      }

      if (existing.createdBy !== userId) {
        throw new Error('Unauthorized: You can only delete your own listings');
      }

      const result = await db.query(
        `UPDATE property_listings
         SET status = $1, updated_at = NOW()
         WHERE id = $2
         RETURNING id, reference_number, title, description, location, country,
                   price, currency, property_type, size, status, view_count,
                   created_by, created_at, updated_at`,
        [PropertyStatus.UNAVAILABLE, listingId]
      );

      logger.info('Property listing marked as unavailable', { listingId, userId });
      return this.mapFromDb(result.rows[0]);
    } catch (error) {
      logger.error('Failed to delete property listing', { error, listingId, userId });
      throw error;
    }
  }

  /**
   * Increment view count for a listing
   * Requirement 11.10: Track view count
   */
  async incrementViewCount(listingId: string): Promise<void> {
    try {
      await db.query(
        `UPDATE property_listings SET view_count = view_count + 1 WHERE id = $1`,
        [listingId]
      );
    } catch (error) {
      logger.error('Failed to increment view count', { error, listingId });
      throw error;
    }
  }

  /**
   * Get count of images for a listing
   * Requirement 11.4: Support uploading up to 20 images per listing
   */
  async getImageCount(listingId: string): Promise<number> {
    try {
      const result = await db.query(
        `SELECT COUNT(*) FROM property_images WHERE property_id = $1`,
        [listingId]
      );
      return parseInt(result.rows[0].count, 10);
    } catch (error) {
      logger.error('Failed to get image count', { error, listingId });
      throw error;
    }
  }

  /**
   * Add an image to a property listing
   * Requirements: 11.4, 11.5, 11.6
   */
  async addImage(
    listingId: string,
    userId: string,
    imageBuffer: Buffer,
    mimetype: string,
    filename: string
  ): Promise<PropertyImage> {
    try {
      // Verify listing exists
      const listing = await this.getListing(listingId);
      if (!listing) {
        throw new Error('Property listing not found');
      }

      // Enforce max 20 images (Requirement 11.4)
      const imageCount = await this.getImageCount(listingId);
      if (imageCount >= MAX_IMAGES_PER_LISTING) {
        throw new Error(`Maximum of ${MAX_IMAGES_PER_LISTING} images allowed per listing`);
      }

      // Generate thumbnail at 300x200 (Requirement 11.6)
      const thumbnailBuffer = await fileStorageService.generateThumbnail(
        imageBuffer,
        mimetype,
        300,
        200
      );

      // Upload original image (Requirement 11.5)
      const storedFile = await fileStorageService.uploadFile({
        filename,
        mimetype,
        size: imageBuffer.length,
        buffer: imageBuffer,
        uploadedBy: userId,
        entityType: 'property_image',
        entityId: listingId,
      });

      // Upload thumbnail separately
      const thumbFilename = `thumb_${filename}`;
      const thumbStoredFile = await fileStorageService.uploadFile({
        filename: thumbFilename,
        mimetype,
        size: thumbnailBuffer.length,
        buffer: thumbnailBuffer,
        uploadedBy: userId,
        entityType: 'property_image',
        entityId: listingId,
        description: 'thumbnail',
      });

      // Determine display order (append at end)
      const nextOrder = imageCount;

      // Insert into property_images table
      const result = await db.query(
        `INSERT INTO property_images (property_id, file_id, url, thumbnail_url, display_order)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, property_id, file_id, url, thumbnail_url, display_order, created_at`,
        [listingId, storedFile.fileId, storedFile.url, thumbStoredFile.url, nextOrder]
      );

      logger.info('Property image added', { listingId, fileId: storedFile.fileId, userId });
      return this.mapImageFromDb(result.rows[0]);
    } catch (error) {
      logger.error('Failed to add property image', { error, listingId, userId });
      throw error;
    }
  }

  /**
   * Get all images for a listing ordered by display_order
   * Requirement 11.4
   */
  async getImages(listingId: string): Promise<PropertyImage[]> {
    try {
      const result = await db.query(
        `SELECT id, property_id, file_id, url, thumbnail_url, display_order, created_at
         FROM property_images
         WHERE property_id = $1
         ORDER BY display_order ASC, created_at ASC`,
        [listingId]
      );
      return result.rows.map((row: any) => this.mapImageFromDb(row));
    } catch (error) {
      logger.error('Failed to get property images', { error, listingId });
      throw error;
    }
  }

  /**
   * Delete an image from storage and DB
   * Requirement 11.5
   */
  async deleteImage(imageId: string, listingId: string, userId: string): Promise<void> {
    try {
      // Fetch the image record
      const result = await db.query(
        `SELECT id, property_id, file_id, url, thumbnail_url, display_order
         FROM property_images
         WHERE id = $1 AND property_id = $2`,
        [imageId, listingId]
      );

      if (result.rows.length === 0) {
        throw new Error('Image not found');
      }

      const image = result.rows[0];

      // Delete from storage (best-effort)
      try {
        await fileStorageService.deleteFile(image.file_id, userId);
      } catch (err) {
        logger.warn('Failed to delete image file from storage', { imageId, fileId: image.file_id, err });
      }

      // Delete from DB
      await db.query(`DELETE FROM property_images WHERE id = $1`, [imageId]);

      logger.info('Property image deleted', { imageId, listingId, userId });
    } catch (error) {
      logger.error('Failed to delete property image', { error, imageId, listingId });
      throw error;
    }
  }

  /**
   * Reorder images by updating display_order
   * Requirement 11.4: Track image display order
   */
  async reorderImages(
    listingId: string,
    userId: string,
    imageIds: string[]
  ): Promise<PropertyImage[]> {
    try {
      // Verify listing exists and user owns it
      const listing = await this.getListing(listingId);
      if (!listing) {
        throw new Error('Property listing not found');
      }
      if (listing.createdBy !== userId) {
        throw new Error('Unauthorized: You can only reorder images on your own listings');
      }

      // Validate all imageIds belong to this listing
      const existing = await this.getImages(listingId);
      const existingIds = new Set(existing.map((img) => img.id));
      for (const id of imageIds) {
        if (!existingIds.has(id)) {
          throw new Error(`Image ${id} does not belong to listing ${listingId}`);
        }
      }

      // Update display_order for each image
      for (let i = 0; i < imageIds.length; i++) {
        await db.query(
          `UPDATE property_images SET display_order = $1 WHERE id = $2 AND property_id = $3`,
          [i, imageIds[i], listingId]
        );
      }

      logger.info('Property images reordered', { listingId, userId, imageIds });
      return this.getImages(listingId);
    } catch (error) {
      logger.error('Failed to reorder property images', { error, listingId, userId });
      throw error;
    }
  }

  private mapImageFromDb(row: any): PropertyImage {
    return {
      id: row.id,
      propertyId: row.property_id,
      fileId: row.file_id,
      url: row.url,
      thumbnailUrl: row.thumbnail_url,
      displayOrder: row.display_order,
      createdAt: row.created_at,
    };
  }

  private mapFromDb(row: any): PropertyListing {
    return {
      id: row.id,
      referenceNumber: row.reference_number,
      title: row.title,
      description: row.description,
      location: row.location,
      country: row.country,
      price: parseFloat(row.price),
      currency: row.currency,
      propertyType: row.property_type as PropertyType,
      size: parseFloat(row.size),
      status: row.status as PropertyStatus,
      viewCount: row.view_count,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

export const propertyService = new PropertyService();
export default propertyService;
