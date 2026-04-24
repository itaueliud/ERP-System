import { PropertyService, PropertyType, PropertyStatus, CreatePropertyInput } from './propertyService';
import { db } from '../database/connection';

jest.mock('../database/connection');
jest.mock('../utils/logger');
jest.mock('../files/fileService', () => ({
  fileStorageService: {
    generateThumbnail: jest.fn().mockResolvedValue(Buffer.from('thumbnail-data')),
    uploadFile: jest.fn().mockResolvedValue({
      id: 'stored-file-id',
      fileId: 'abc123fileId',
      filename: 'photo.jpg',
      mimetype: 'image/jpeg',
      size: 1024,
      url: 'https://storage.example.com/property_images/abc123fileId/photo.jpg',
      uploadedBy: '123e4567-e89b-12d3-a456-426614174000',
      createdAt: new Date(),
    }),
    deleteFile: jest.fn().mockResolvedValue(undefined),
  },
}));
jest.mock('../services/storage', () => ({
  storageClient: {
    upload: jest.fn().mockResolvedValue({ url: 'https://storage.example.com/test' }),
    delete: jest.fn().mockResolvedValue(undefined),
    generateKey: jest.fn().mockReturnValue('test-key'),
    getSignedDownloadUrl: jest.fn().mockResolvedValue('https://signed-url.example.com'),
    exists: jest.fn().mockResolvedValue(true),
  },
}));
jest.mock('../config', () => ({
  config: {
    apiBaseUrl: 'http://localhost:3000',
    logging: { level: 'info', filePath: '/tmp/test.log' },
    database: { host: 'localhost', port: 5432, name: 'test', user: 'test', password: 'test' },
  },
}));

const MOCK_USER_ID = '123e4567-e89b-12d3-a456-426614174000';
const MOCK_LISTING_ID = '456e4567-e89b-12d3-a456-426614174001';

const validInput: CreatePropertyInput = {
  title: 'Beautiful Land in Nairobi',
  description: 'A prime piece of land in the heart of Nairobi',
  location: 'Westlands, Nairobi',
  country: 'Kenya',
  price: 5000000,
  currency: 'KES',
  propertyType: PropertyType.LAND,
  size: 0.5,
  createdBy: MOCK_USER_ID,
};

const mockDbRow = {
  id: MOCK_LISTING_ID,
  reference_number: 'TST-PLT-2024-000001',
  title: validInput.title,
  description: validInput.description,
  location: validInput.location,
  country: validInput.country,
  price: '5000000.00',
  currency: validInput.currency,
  property_type: validInput.propertyType,
  size: '0.50',
  status: PropertyStatus.AVAILABLE,
  view_count: 0,
  created_by: MOCK_USER_ID,
  created_at: new Date(),
  updated_at: new Date(),
};

describe('PropertyService', () => {
  let service: PropertyService;

  beforeEach(() => {
    service = new PropertyService();
    jest.clearAllMocks();
  });

  // ─── generateReferenceNumber ───────────────────────────────────────────────

  describe('generateReferenceNumber', () => {
    it('should generate TST-PLT-YYYY-000001 when no listings exist', async () => {
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      const ref = await service.generateReferenceNumber();
      const year = new Date().getFullYear();
      expect(ref).toBe(`TST-PLT-${year}-000001`);
    });

    it('should increment sequence from last reference number', async () => {
      const year = new Date().getFullYear();
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ reference_number: `TST-PLT-${year}-000005` }],
      });

      const ref = await service.generateReferenceNumber();
      expect(ref).toBe(`TST-PLT-${year}-000006`);
    });

    it('should zero-pad sequence to 6 digits', async () => {
      const year = new Date().getFullYear();
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ reference_number: `TST-PLT-${year}-000099` }],
      });

      const ref = await service.generateReferenceNumber();
      expect(ref).toBe(`TST-PLT-${year}-000100`);
    });
  });

  // ─── createListing ─────────────────────────────────────────────────────────

  describe('createListing', () => {
    it('should create a listing with valid data', async () => {
      // Mock generateReferenceNumber query
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [] });
      // Mock INSERT
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [mockDbRow] });

      const result = await service.createListing(validInput);

      expect(result.referenceNumber).toMatch(/^TST-PLT-\d{4}-\d{6}$/);
      expect(result.title).toBe(validInput.title);
      expect(result.propertyType).toBe(PropertyType.LAND);
      expect(result.status).toBe(PropertyStatus.AVAILABLE);
      expect(result.viewCount).toBe(0);
    });

    it('should reject when price is 0 or negative', async () => {
      await expect(
        service.createListing({ ...validInput, price: 0 })
      ).rejects.toThrow('Price must be greater than 0');

      await expect(
        service.createListing({ ...validInput, price: -100 })
      ).rejects.toThrow('Price must be greater than 0');
    });

    it('should reject invalid property type', async () => {
      await expect(
        service.createListing({ ...validInput, propertyType: 'INVALID' as PropertyType })
      ).rejects.toThrow('Invalid property type');
    });

    it('should reject negative size', async () => {
      await expect(
        service.createListing({ ...validInput, size: -1 })
      ).rejects.toThrow('Size must be a non-negative number');
    });

    it('should reject missing required fields', async () => {
      await expect(
        service.createListing({ ...validInput, title: '' })
      ).rejects.toThrow('Missing required fields');
    });

    it('should accept all valid property types', async () => {
      for (const type of Object.values(PropertyType)) {
        (db.query as jest.Mock).mockResolvedValueOnce({ rows: [] });
        (db.query as jest.Mock).mockResolvedValueOnce({
          rows: [{ ...mockDbRow, property_type: type }],
        });

        const result = await service.createListing({ ...validInput, propertyType: type });
        expect(result.propertyType).toBe(type);
      }
    });
  });

  // ─── getListing ────────────────────────────────────────────────────────────

  describe('getListing', () => {
    it('should return a listing by ID', async () => {
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [mockDbRow] });

      const result = await service.getListing(MOCK_LISTING_ID);
      expect(result).not.toBeNull();
      expect(result!.id).toBe(MOCK_LISTING_ID);
    });

    it('should return null for non-existent listing', async () => {
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      const result = await service.getListing('non-existent-id');
      expect(result).toBeNull();
    });
  });

  // ─── getListingByReference ─────────────────────────────────────────────────

  describe('getListingByReference', () => {
    it('should return a listing by reference number', async () => {
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [mockDbRow] });

      const result = await service.getListingByReference('TST-PLT-2024-000001');
      expect(result).not.toBeNull();
      expect(result!.referenceNumber).toBe('TST-PLT-2024-000001');
    });

    it('should return null for non-existent reference', async () => {
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      const result = await service.getListingByReference('TST-PLT-9999-999999');
      expect(result).toBeNull();
    });
  });

  // ─── listListings ──────────────────────────────────────────────────────────

  describe('listListings', () => {
    it('should return listings with total count', async () => {
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [{ count: '1' }] });
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [mockDbRow] });

      const result = await service.listListings({});
      expect(result.total).toBe(1);
      expect(result.listings).toHaveLength(1);
    });

    it('should filter by country', async () => {
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [{ count: '1' }] });
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [mockDbRow] });

      const result = await service.listListings({ country: 'Kenya' });
      expect(result.total).toBe(1);
    });

    it('should filter by property type', async () => {
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [{ count: '1' }] });
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [mockDbRow] });

      const result = await service.listListings({ propertyType: PropertyType.LAND });
      expect(result.total).toBe(1);
    });

    it('should filter by price range', async () => {
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [{ count: '1' }] });
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [mockDbRow] });

      const result = await service.listListings({ priceMin: 1000000, priceMax: 10000000 });
      expect(result.total).toBe(1);
    });

    it('should filter by size range (sizeMin and sizeMax)', async () => {
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [{ count: '1' }] });
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [mockDbRow] });

      const result = await service.listListings({ sizeMin: 0.1, sizeMax: 5.0 });
      expect(result.total).toBe(1);

      // Verify the query included size conditions
      const countCall = (db.query as jest.Mock).mock.calls[0];
      expect(countCall[0]).toContain('size >=');
      expect(countCall[0]).toContain('size <=');
    });

    it('should filter by sizeMin only', async () => {
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [{ count: '1' }] });
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [mockDbRow] });

      await service.listListings({ sizeMin: 1.0 });

      const countCall = (db.query as jest.Mock).mock.calls[0];
      expect(countCall[0]).toContain('size >=');
      expect(countCall[0]).not.toContain('size <=');
    });

    it('should filter by sizeMax only', async () => {
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [{ count: '1' }] });
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [mockDbRow] });

      await service.listListings({ sizeMax: 10.0 });

      const countCall = (db.query as jest.Mock).mock.calls[0];
      expect(countCall[0]).not.toContain('size >=');
      expect(countCall[0]).toContain('size <=');
    });

    it('should filter by search text across title, description, location', async () => {
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [{ count: '1' }] });
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [mockDbRow] });

      await service.listListings({ search: 'Nairobi' });

      const countCall = (db.query as jest.Mock).mock.calls[0];
      expect(countCall[0]).toContain('title ILIKE');
      expect(countCall[0]).toContain('description ILIKE');
      expect(countCall[0]).toContain('location ILIKE');
      expect(countCall[1]).toContain('%Nairobi%');
    });

    it('should use $N placeholders in SQL (not bare numbers)', async () => {
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [{ count: '1' }] });
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [mockDbRow] });

      await service.listListings({ country: 'Kenya', priceMin: 100 });

      const countCall = (db.query as jest.Mock).mock.calls[0];
      expect(countCall[0]).toMatch(/\$1/);
      expect(countCall[0]).toMatch(/\$2/);
    });

    it('should return empty list when no listings match', async () => {
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [{ count: '0' }] });
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      const result = await service.listListings({ country: 'Nonexistent' });
      expect(result.total).toBe(0);
      expect(result.listings).toHaveLength(0);
    });
  });

  // ─── searchListings ────────────────────────────────────────────────────────

  describe('searchListings', () => {
    it('should default to AVAILABLE status (hide SOLD/UNAVAILABLE)', async () => {
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [{ count: '1' }] });
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [mockDbRow] });

      await service.searchListings({});

      const countCall = (db.query as jest.Mock).mock.calls[0];
      expect(countCall[0]).toContain('status =');
      expect(countCall[1]).toContain(PropertyStatus.AVAILABLE);
    });

    it('should map query param to search text', async () => {
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [{ count: '1' }] });
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [mockDbRow] });

      await service.searchListings({ query: 'Nairobi' });

      const countCall = (db.query as jest.Mock).mock.calls[0];
      expect(countCall[0]).toContain('title ILIKE');
      expect(countCall[1]).toContain('%Nairobi%');
    });

    it('should support all filters: country, propertyType, priceRange, sizeRange', async () => {
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [{ count: '2' }] });
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [mockDbRow, mockDbRow] });

      const result = await service.searchListings({
        country: 'Kenya',
        propertyType: PropertyType.LAND,
        priceMin: 1000000,
        priceMax: 10000000,
        sizeMin: 0.1,
        sizeMax: 5.0,
      });

      expect(result.total).toBe(2);
      const countCall = (db.query as jest.Mock).mock.calls[0];
      expect(countCall[0]).toContain('country =');
      expect(countCall[0]).toContain('property_type =');
      expect(countCall[0]).toContain('price >=');
      expect(countCall[0]).toContain('price <=');
      expect(countCall[0]).toContain('size >=');
      expect(countCall[0]).toContain('size <=');
    });

    it('should not override explicit status filter', async () => {
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [{ count: '1' }] });
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [{ ...mockDbRow, status: PropertyStatus.SOLD }] });

      await service.searchListings({ status: PropertyStatus.SOLD });

      const countCall = (db.query as jest.Mock).mock.calls[0];
      expect(countCall[1]).toContain(PropertyStatus.SOLD);
    });
  });

  // ─── getSearchSuggestions ──────────────────────────────────────────────────

  describe('getSearchSuggestions', () => {
    it('should return empty array for query shorter than 2 characters', async () => {
      const result = await service.getSearchSuggestions('a');
      expect(result).toEqual([]);
      expect(db.query).not.toHaveBeenCalled();
    });

    it('should return empty array for empty query', async () => {
      const result = await service.getSearchSuggestions('');
      expect(result).toEqual([]);
    });

    it('should return suggestions from title, location, and country', async () => {
      // title query
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ value: 'Beautiful Land in Nairobi', count: '3' }],
      });
      // location query
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ value: 'Westlands, Nairobi', count: '5' }],
      });
      // country query
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ value: 'Kenya', count: '10' }],
      });

      const result = await service.getSearchSuggestions('Nairobi');

      expect(result).toHaveLength(3);
      // Should be sorted by count descending
      expect(result[0].value).toBe('Kenya');
      expect(result[0].type).toBe('country');
      expect(result[0].count).toBe(10);
    });

    it('should only query AVAILABLE listings for suggestions', async () => {
      (db.query as jest.Mock).mockResolvedValue({ rows: [] });

      await service.getSearchSuggestions('test');

      // All 3 parallel queries should filter by AVAILABLE
      const calls = (db.query as jest.Mock).mock.calls;
      expect(calls).toHaveLength(3);
      calls.forEach((call) => {
        expect(call[1][0]).toBe(PropertyStatus.AVAILABLE);
      });
    });

    it('should respect the limit parameter', async () => {
      (db.query as jest.Mock).mockResolvedValue({ rows: [] });

      await service.getSearchSuggestions('test', 5);

      const calls = (db.query as jest.Mock).mock.calls;
      calls.forEach((call) => {
        expect(call[1][2]).toBe(5);
      });
    });
  });

  // ─── updateListing ─────────────────────────────────────────────────────────

  describe('updateListing', () => {
    it('should update a listing with valid data', async () => {
      // getListing
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [mockDbRow] });
      // UPDATE
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ ...mockDbRow, title: 'Updated Title' }],
      });

      const result = await service.updateListing(MOCK_LISTING_ID, MOCK_USER_ID, {
        title: 'Updated Title',
      });
      expect(result.title).toBe('Updated Title');
    });

    it('should reject update by non-owner', async () => {
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [mockDbRow] });

      await expect(
        service.updateListing(MOCK_LISTING_ID, 'different-user-id', { title: 'Hack' })
      ).rejects.toThrow('Unauthorized');
    });

    it('should reject update for non-existent listing', async () => {
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      await expect(
        service.updateListing('non-existent', MOCK_USER_ID, { title: 'X' })
      ).rejects.toThrow('not found');
    });

    it('should reject invalid property type in update', async () => {
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [mockDbRow] });

      await expect(
        service.updateListing(MOCK_LISTING_ID, MOCK_USER_ID, {
          propertyType: 'INVALID' as PropertyType,
        })
      ).rejects.toThrow('Invalid property type');
    });

    it('should reject negative price in update', async () => {
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [mockDbRow] });

      await expect(
        service.updateListing(MOCK_LISTING_ID, MOCK_USER_ID, { price: -500 })
      ).rejects.toThrow('Price must be greater than 0');
    });

    it('should allow marking listing as SOLD', async () => {
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [mockDbRow] });
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ ...mockDbRow, status: PropertyStatus.SOLD }],
      });

      const result = await service.updateListing(MOCK_LISTING_ID, MOCK_USER_ID, {
        status: PropertyStatus.SOLD,
      });
      expect(result.status).toBe(PropertyStatus.SOLD);
    });
  });

  // ─── deleteListing ─────────────────────────────────────────────────────────

  describe('deleteListing', () => {
    it('should mark listing as UNAVAILABLE', async () => {
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [mockDbRow] });
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ ...mockDbRow, status: PropertyStatus.UNAVAILABLE }],
      });

      const result = await service.deleteListing(MOCK_LISTING_ID, MOCK_USER_ID);
      expect(result.status).toBe(PropertyStatus.UNAVAILABLE);
    });

    it('should reject deletion by non-owner', async () => {
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [mockDbRow] });

      await expect(
        service.deleteListing(MOCK_LISTING_ID, 'different-user-id')
      ).rejects.toThrow('Unauthorized');
    });

    it('should reject deletion of non-existent listing', async () => {
      (db.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      await expect(
        service.deleteListing('non-existent', MOCK_USER_ID)
      ).rejects.toThrow('not found');
    });
  });

  // ─── incrementViewCount ────────────────────────────────────────────────────

  describe('incrementViewCount', () => {
    it('should call db.query to increment view count', async () => {
      (db.query as jest.Mock).mockResolvedValueOnce({ rowCount: 1 });

      await expect(service.incrementViewCount(MOCK_LISTING_ID)).resolves.not.toThrow();
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('view_count = view_count + 1'),
        [MOCK_LISTING_ID]
      );
    });
  });

  // ─── Image Methods ─────────────────────────────────────────────────────────

  describe('Image methods', () => {
    const MOCK_IMAGE_ID = '789e4567-e89b-12d3-a456-426614174002';
    const mockImageBuffer = Buffer.from('fake-image-data');
    const mockImageRow = {
      id: MOCK_IMAGE_ID,
      property_id: MOCK_LISTING_ID,
      file_id: 'abc123fileId',
      url: 'https://storage.example.com/property_images/abc123fileId/photo.jpg',
      thumbnail_url: 'https://storage.example.com/property_images/abc123fileId/thumbnails/thumb_photo.jpg',
      display_order: 0,
      created_at: new Date(),
    };

    // ─── getImageCount ────────────────────────────────────────────────────

    describe('getImageCount', () => {
      it('should return the count of images for a listing', async () => {
        (db.query as jest.Mock).mockResolvedValueOnce({ rows: [{ count: '3' }] });

        const count = await service.getImageCount(MOCK_LISTING_ID);
        expect(count).toBe(3);
      });

      it('should return 0 when no images exist', async () => {
        (db.query as jest.Mock).mockResolvedValueOnce({ rows: [{ count: '0' }] });

        const count = await service.getImageCount(MOCK_LISTING_ID);
        expect(count).toBe(0);
      });
    });

    // ─── getImages ────────────────────────────────────────────────────────

    describe('getImages', () => {
      it('should return images ordered by display_order', async () => {
        const rows = [
          { ...mockImageRow, display_order: 0 },
          { ...mockImageRow, id: 'img2', display_order: 1 },
        ];
        (db.query as jest.Mock).mockResolvedValueOnce({ rows });

        const images = await service.getImages(MOCK_LISTING_ID);
        expect(images).toHaveLength(2);
        expect(images[0].displayOrder).toBe(0);
        expect(images[1].displayOrder).toBe(1);
      });

      it('should return empty array when no images', async () => {
        (db.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

        const images = await service.getImages(MOCK_LISTING_ID);
        expect(images).toHaveLength(0);
      });

      it('should map db row fields correctly', async () => {
        (db.query as jest.Mock).mockResolvedValueOnce({ rows: [mockImageRow] });

        const images = await service.getImages(MOCK_LISTING_ID);
        expect(images[0]).toMatchObject({
          id: MOCK_IMAGE_ID,
          propertyId: MOCK_LISTING_ID,
          fileId: 'abc123fileId',
          url: mockImageRow.url,
          thumbnailUrl: mockImageRow.thumbnail_url,
          displayOrder: 0,
        });
      });
    });

    // ─── addImage ─────────────────────────────────────────────────────────

    describe('addImage', () => {
      it('should reject when listing does not exist', async () => {
        (db.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

        await expect(
          service.addImage(MOCK_LISTING_ID, MOCK_USER_ID, mockImageBuffer, 'image/jpeg', 'photo.jpg')
        ).rejects.toThrow('Property listing not found');
      });

      it('should reject when max images (20) already reached', async () => {
        // getListing
        (db.query as jest.Mock).mockResolvedValueOnce({ rows: [mockDbRow] });
        // getImageCount returns 20
        (db.query as jest.Mock).mockResolvedValueOnce({ rows: [{ count: '20' }] });

        await expect(
          service.addImage(MOCK_LISTING_ID, MOCK_USER_ID, mockImageBuffer, 'image/jpeg', 'photo.jpg')
        ).rejects.toThrow('Maximum of 20 images allowed per listing');
      });
    });

    // ─── deleteImage ──────────────────────────────────────────────────────

    describe('deleteImage', () => {
      it('should throw when image not found', async () => {
        (db.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

        await expect(
          service.deleteImage(MOCK_IMAGE_ID, MOCK_LISTING_ID, MOCK_USER_ID)
        ).rejects.toThrow('Image not found');
      });

      it('should delete image from DB when found', async () => {
        // SELECT image
        (db.query as jest.Mock).mockResolvedValueOnce({ rows: [mockImageRow] });
        // DELETE
        (db.query as jest.Mock).mockResolvedValueOnce({ rowCount: 1 });

        await expect(
          service.deleteImage(MOCK_IMAGE_ID, MOCK_LISTING_ID, MOCK_USER_ID)
        ).resolves.not.toThrow();

        expect(db.query).toHaveBeenCalledWith(
          expect.stringContaining('DELETE FROM property_images'),
          [MOCK_IMAGE_ID]
        );
      });
    });

    // ─── reorderImages ────────────────────────────────────────────────────

    describe('reorderImages', () => {
      it('should reject when listing does not exist', async () => {
        (db.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

        await expect(
          service.reorderImages(MOCK_LISTING_ID, MOCK_USER_ID, [MOCK_IMAGE_ID])
        ).rejects.toThrow('Property listing not found');
      });

      it('should reject when user does not own the listing', async () => {
        (db.query as jest.Mock).mockResolvedValueOnce({ rows: [mockDbRow] });

        await expect(
          service.reorderImages(MOCK_LISTING_ID, 'other-user-id', [MOCK_IMAGE_ID])
        ).rejects.toThrow('Unauthorized');
      });

      it('should reject when imageId does not belong to listing', async () => {
        // getListing
        (db.query as jest.Mock).mockResolvedValueOnce({ rows: [mockDbRow] });
        // getImages (for existing check)
        (db.query as jest.Mock).mockResolvedValueOnce({ rows: [mockImageRow] });

        await expect(
          service.reorderImages(MOCK_LISTING_ID, MOCK_USER_ID, ['non-existent-image-id'])
        ).rejects.toThrow('does not belong to listing');
      });

      it('should update display_order for each image', async () => {
        const img2Id = '999e4567-e89b-12d3-a456-426614174099';
        const img2Row = { ...mockImageRow, id: img2Id, display_order: 1 };

        // getListing
        (db.query as jest.Mock).mockResolvedValueOnce({ rows: [mockDbRow] });
        // getImages (existing)
        (db.query as jest.Mock).mockResolvedValueOnce({ rows: [mockImageRow, img2Row] });
        // UPDATE for img2 (new order 0)
        (db.query as jest.Mock).mockResolvedValueOnce({ rowCount: 1 });
        // UPDATE for MOCK_IMAGE_ID (new order 1)
        (db.query as jest.Mock).mockResolvedValueOnce({ rowCount: 1 });
        // getImages (final result)
        (db.query as jest.Mock).mockResolvedValueOnce({
          rows: [
            { ...img2Row, display_order: 0 },
            { ...mockImageRow, display_order: 1 },
          ],
        });

        const result = await service.reorderImages(MOCK_LISTING_ID, MOCK_USER_ID, [img2Id, MOCK_IMAGE_ID]);
        expect(result).toHaveLength(2);
        expect(result[0].id).toBe(img2Id);
        expect(result[0].displayOrder).toBe(0);
      });
    });
  });
});
