// Mock logger to avoid file system / config dependencies in tests
jest.mock('../utils/logger', () => {
  const mock = { debug: jest.fn(), warn: jest.fn(), error: jest.fn(), info: jest.fn() };
  return { __esModule: true, default: mock };
});

import { SanitizationService } from './sanitizationService';

describe('SanitizationService', () => {
  let service: SanitizationService;

  beforeEach(() => {
    service = new SanitizationService();
  });

  // ─── sanitizeText ────────────────────────────────────────────────────────────

  describe('sanitizeText', () => {
    it('strips HTML tags', () => {
      expect(service.sanitizeText('<b>hello</b>')).not.toContain('<b>');
      expect(service.sanitizeText('<b>hello</b>')).toContain('hello');
    });

    it('encodes & character', () => {
      expect(service.sanitizeText('a & b')).toContain('&amp;');
    });

    it('encodes < and > characters', () => {
      const result = service.sanitizeText('1 < 2 > 0');
      expect(result).toContain('&lt;');
      expect(result).toContain('&gt;');
    });

    it('encodes double quotes', () => {
      expect(service.sanitizeText('"quoted"')).toContain('&quot;');
    });

    it('encodes single quotes', () => {
      expect(service.sanitizeText("it's")).toContain('&#x27;');
    });

    it('strips script tags', () => {
      const result = service.sanitizeText('<script>alert("xss")</script>');
      expect(result).not.toContain('<script>');
      expect(result).not.toContain('</script>');
    });

    it('returns plain text unchanged (except encoding)', () => {
      expect(service.sanitizeText('hello world')).toBe('hello world');
    });

    it('handles empty string', () => {
      expect(service.sanitizeText('')).toBe('');
    });

    it('handles non-string input gracefully', () => {
      expect(() => service.sanitizeText(null as any)).not.toThrow();
      expect(() => service.sanitizeText(undefined as any)).not.toThrow();
    });
  });

  // ─── sanitizeHtml ────────────────────────────────────────────────────────────

  describe('sanitizeHtml', () => {
    it('strips all tags when no allowed tags specified', () => {
      const result = service.sanitizeHtml('<p>hello <b>world</b></p>');
      expect(result).not.toContain('<p>');
      expect(result).not.toContain('<b>');
      expect(result).toContain('hello');
      expect(result).toContain('world');
    });

    it('keeps allowed tags', () => {
      const result = service.sanitizeHtml('<p>hello <b>world</b></p>', ['p', 'b']);
      expect(result).toContain('<p>');
      expect(result).toContain('<b>');
    });

    it('strips script tags and their content', () => {
      const result = service.sanitizeHtml('<script>alert("xss")</script><p>safe</p>', ['p']);
      expect(result).not.toContain('<script>');
      expect(result).not.toContain('alert');
      expect(result).toContain('safe');
    });

    it('strips iframe tags', () => {
      const result = service.sanitizeHtml('<iframe src="evil.com"></iframe>text', ['p']);
      expect(result).not.toContain('<iframe>');
      expect(result).not.toContain('iframe');
    });

    it('strips event handler attributes', () => {
      const result = service.sanitizeHtml('<p onclick="evil()">click me</p>', ['p']);
      expect(result).not.toContain('onclick');
    });

    it('strips javascript: protocol', () => {
      const result = service.sanitizeHtml('<a href="javascript:alert(1)">link</a>', ['a']);
      expect(result).not.toContain('javascript:');
    });

    it('handles empty string', () => {
      expect(service.sanitizeHtml('')).toBe('');
    });
  });

  // ─── sanitizeSqlInput ────────────────────────────────────────────────────────

  describe('sanitizeSqlInput', () => {
    it('escapes single quotes', () => {
      expect(service.sanitizeSqlInput("O'Brien")).toContain("\\'");
    });

    it('escapes double quotes', () => {
      expect(service.sanitizeSqlInput('say "hello"')).toContain('\\"');
    });

    it('escapes semicolons', () => {
      expect(service.sanitizeSqlInput('DROP TABLE users;')).toContain('\\;');
    });

    it('escapes backslashes', () => {
      expect(service.sanitizeSqlInput('path\\to\\file')).toContain('\\\\');
    });

    it('leaves safe strings unchanged', () => {
      expect(service.sanitizeSqlInput('hello world 123')).toBe('hello world 123');
    });

    it('handles empty string', () => {
      expect(service.sanitizeSqlInput('')).toBe('');
    });

    it('handles SQL injection attempt', () => {
      const injection = "'; DROP TABLE users; --";
      const result = service.sanitizeSqlInput(injection);
      expect(result).not.toBe(injection);
      expect(result).toContain("\\'");
      expect(result).toContain('\\;');
    });
  });

  // ─── sanitizeObject ──────────────────────────────────────────────────────────

  describe('sanitizeObject', () => {
    it('sanitizes string values in a flat object', () => {
      const obj = { name: '<script>xss</script>', age: 30 };
      const result = service.sanitizeObject(obj);
      expect(result.name).not.toContain('<script>');
      expect(result.age).toBe(30);
    });

    it('recursively sanitizes nested objects', () => {
      const obj = { user: { name: '<b>Bob</b>', email: 'bob@example.com' } };
      const result = service.sanitizeObject(obj);
      expect(result.user.name).not.toContain('<b>');
    });

    it('sanitizes strings inside arrays', () => {
      const obj = { tags: ['<script>bad</script>', 'good'] };
      const result = service.sanitizeObject(obj);
      expect(result.tags[0]).not.toContain('<script>');
      expect(result.tags[1]).toBe('good');
    });

    it('preserves non-string primitive values', () => {
      const obj = { count: 5, active: true, value: null };
      const result = service.sanitizeObject(obj);
      expect(result.count).toBe(5);
      expect(result.active).toBe(true);
      expect(result.value).toBeNull();
    });

    it('handles empty object', () => {
      expect(service.sanitizeObject({})).toEqual({});
    });
  });

  // ─── validateFileUpload ──────────────────────────────────────────────────────

  describe('validateFileUpload', () => {
    const validFile = {
      filename: 'document.pdf',
      mimetype: 'application/pdf',
      size: 1024 * 1024, // 1MB
    };

    it('accepts a valid PDF file', () => {
      const result = service.validateFileUpload(validFile);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('rejects file exceeding default 50MB limit', () => {
      const bigFile = { ...validFile, size: 60 * 1024 * 1024 };
      const result = service.validateFileUpload(bigFile);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field === 'file.size')).toBe(true);
    });

    it('rejects file exceeding custom size limit', () => {
      const file = { ...validFile, size: 2 * 1024 * 1024 };
      const result = service.validateFileUpload(file, { maxSizeBytes: 1024 * 1024 });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field === 'file.size')).toBe(true);
    });

    it('rejects disallowed MIME type', () => {
      const file = { ...validFile, mimetype: 'application/x-executable' };
      const result = service.validateFileUpload(file);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field === 'file.mimetype')).toBe(true);
    });

    it('rejects disallowed file extension', () => {
      const file = { ...validFile, filename: 'malware.exe', mimetype: 'application/pdf' };
      const result = service.validateFileUpload(file);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field === 'file.filename')).toBe(true);
    });

    it('rejects path traversal in filename', () => {
      const file = { ...validFile, filename: '../../../etc/passwd.pdf' };
      const result = service.validateFileUpload(file);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field === 'file.filename')).toBe(true);
    });

    it('accepts custom allowed MIME types', () => {
      const file = { filename: 'data.csv', mimetype: 'text/csv', size: 1024 };
      const result = service.validateFileUpload(file, {
        allowedMimeTypes: ['text/csv'],
        allowedExtensions: ['csv'],
      });
      expect(result.valid).toBe(true);
    });

    it('accepts all default allowed types', () => {
      const files = [
        { filename: 'doc.pdf', mimetype: 'application/pdf', size: 100 },
        { filename: 'doc.docx', mimetype: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', size: 100 },
        { filename: 'sheet.xlsx', mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', size: 100 },
        { filename: 'img.png', mimetype: 'image/png', size: 100 },
        { filename: 'img.jpg', mimetype: 'image/jpeg', size: 100 },
        { filename: 'img.jpeg', mimetype: 'image/jpeg', size: 100 },
        { filename: 'img.gif', mimetype: 'image/gif', size: 100 },
      ];
      for (const file of files) {
        const result = service.validateFileUpload(file);
        expect(result.valid).toBe(true);
      }
    });

    it('returns specific error messages for each failure', () => {
      const file = { filename: 'bad.exe', mimetype: 'application/x-executable', size: 100 * 1024 * 1024 };
      const result = service.validateFileUpload(file);
      expect(result.valid).toBe(false);
      // Should have errors for size, mimetype, and extension
      expect(result.errors.length).toBeGreaterThanOrEqual(2);
      expect(result.errors.every((e) => typeof e.message === 'string' && e.message.length > 0)).toBe(true);
    });
  });

  // ─── sanitizeFilename ────────────────────────────────────────────────────────

  describe('sanitizeFilename', () => {
    it('preserves safe filenames', () => {
      expect(service.sanitizeFilename('document.pdf')).toBe('document.pdf');
    });

    it('replaces spaces with underscores', () => {
      expect(service.sanitizeFilename('my document.pdf')).toBe('my_document.pdf');
    });

    it('removes special characters', () => {
      const result = service.sanitizeFilename('file<>:"/\\|?*.pdf');
      expect(result).not.toMatch(/[<>:"/\\|?*]/);
    });

    it('handles path traversal attempts', () => {
      const result = service.sanitizeFilename('../../../etc/passwd');
      expect(result).not.toContain('..');
      expect(result).not.toContain('/');
    });

    it('handles empty string', () => {
      expect(service.sanitizeFilename('')).toBe('');
    });

    it('preserves file extension', () => {
      const result = service.sanitizeFilename('my-file.pdf');
      expect(result.endsWith('.pdf')).toBe(true);
    });

    it('handles non-string input gracefully', () => {
      expect(() => service.sanitizeFilename(null as any)).not.toThrow();
    });
  });
});
