import logger from '../utils/logger';
import { ValidationResult } from './validationService';

export interface FileValidationOptions {
  maxSizeBytes?: number;
  allowedMimeTypes?: string[];
  allowedExtensions?: string[];
}

export interface FileInput {
  filename: string;
  mimetype: string;
  size: number;
}

const DEFAULT_MAX_SIZE_BYTES = 52428800; // 50MB

const DEFAULT_ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/png',
  'image/jpeg',
  'image/gif',
];

const DEFAULT_ALLOWED_EXTENSIONS = ['pdf', 'docx', 'xlsx', 'png', 'jpg', 'jpeg', 'gif'];

// HTML entities map for encoding special characters
const HTML_ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
  '/': '&#x2F;',
  '`': '&#x60;',
  '=': '&#x3D;',
};

// SQL special characters that need escaping
const SQL_SPECIAL_CHARS_REGEX = /['";\\]/g;

// Dangerous filename characters — allow only alphanumeric, dot, dash, underscore
const DANGEROUS_FILENAME_CHARS_REGEX = /[^a-zA-Z0-9.\-]/g;

// HTML tag regex — matches valid HTML tags (tag name must start with a letter)
const HTML_TAG_REGEX = /<\/?[a-zA-Z][^>]*>/g;

// Dangerous HTML tags (always stripped even in sanitizeHtml)
const DANGEROUS_TAGS = [
  'script',
  'iframe',
  'object',
  'embed',
  'form',
  'input',
  'button',
  'link',
  'meta',
  'style',
  'base',
  'applet',
  'frame',
  'frameset',
];

// Dangerous attributes (event handlers and javascript: hrefs)
const DANGEROUS_ATTR_REGEX = /\s*(on\w+|javascript\s*:)[^>]*/gi;

export class SanitizationService {
  /**
   * Strips all HTML tags and encodes special characters to prevent XSS.
   * Requirement 44.9
   */
  sanitizeText(input: string): string {
    if (typeof input !== 'string') {
      return String(input ?? '');
    }

    // Strip complete HTML tags (e.g. <b>, <script>, </div>)
    const stripped = input.replace(HTML_TAG_REGEX, '');

    // Encode all remaining special HTML characters (including stray < > & etc.)
    const encoded = stripped.replace(/[&<>"'`=/]/g, (char) => HTML_ENTITIES[char] ?? char);

    logger.debug('Text sanitized', { original: input.length, sanitized: encoded.length });
    return encoded;
  }

  /**
   * Strips dangerous HTML while keeping safe tags.
   * Requirement 44.9
   */
  sanitizeHtml(input: string, allowedTags: string[] = []): string {
    if (typeof input !== 'string') {
      return String(input ?? '');
    }

    let result = input;

    // Remove dangerous event handler attributes and javascript: protocols
    result = result.replace(DANGEROUS_ATTR_REGEX, '');

    // Remove dangerous tags entirely (including their content for script/style)
    for (const tag of DANGEROUS_TAGS) {
      // Remove tag with content for script and style
      if (tag === 'script' || tag === 'style') {
        const contentRegex = new RegExp(`<${tag}[^>]*>[\\s\\S]*?<\\/${tag}>`, 'gi');
        result = result.replace(contentRegex, '');
      }
      // Remove opening and closing tags
      const openTagRegex = new RegExp(`<${tag}(\\s[^>]*)?>`, 'gi');
      const closeTagRegex = new RegExp(`<\\/${tag}>`, 'gi');
      result = result.replace(openTagRegex, '');
      result = result.replace(closeTagRegex, '');
    }

    // If no allowed tags, strip all remaining HTML
    if (allowedTags.length === 0) {
      result = result.replace(HTML_TAG_REGEX, '');
    } else {
      // Strip tags not in the allowed list
      result = result.replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/g, (match, tagName) => {
        if (allowedTags.includes(tagName.toLowerCase())) {
          // Keep the tag but strip any remaining dangerous attributes
          return match.replace(/\s+on\w+\s*=\s*["'][^"']*["']/gi, '');
        }
        return '';
      });
    }

    logger.debug('HTML sanitized', { allowedTags, original: input.length, sanitized: result.length });
    return result;
  }

  /**
   * Escapes SQL special characters to prevent SQL injection.
   * Requirement 44.9
   */
  sanitizeSqlInput(input: string): string {
    if (typeof input !== 'string') {
      return String(input ?? '');
    }

    const sanitized = input.replace(SQL_SPECIAL_CHARS_REGEX, (char) => `\\${char}`);

    logger.debug('SQL input sanitized', { original: input.length, sanitized: sanitized.length });
    return sanitized;
  }

  /**
   * Recursively sanitizes all string values in an object.
   * Requirement 44.9
   */
  sanitizeObject(obj: Record<string, any>): Record<string, any> {
    const result: Record<string, any> = {};

    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string') {
        result[key] = this.sanitizeText(value);
      } else if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        result[key] = this.sanitizeObject(value as Record<string, any>);
      } else if (Array.isArray(value)) {
        result[key] = value.map((item) => {
          if (typeof item === 'string') return this.sanitizeText(item);
          if (item !== null && typeof item === 'object') return this.sanitizeObject(item as Record<string, any>);
          return item;
        });
      } else {
        result[key] = value;
      }
    }

    return result;
  }

  /**
   * Validates a file upload for size, type, and content.
   * Requirements 44.10, 44.11
   */
  validateFileUpload(file: FileInput, options: FileValidationOptions = {}): ValidationResult {
    const errors: Array<{ field: string; message: string }> = [];

    const maxSizeBytes = options.maxSizeBytes ?? DEFAULT_MAX_SIZE_BYTES;
    const allowedMimeTypes = options.allowedMimeTypes ?? DEFAULT_ALLOWED_MIME_TYPES;
    const allowedExtensions = options.allowedExtensions ?? DEFAULT_ALLOWED_EXTENSIONS;

    // Validate file size
    if (file.size > maxSizeBytes) {
      const maxMB = (maxSizeBytes / 1024 / 1024).toFixed(0);
      errors.push({
        field: 'file.size',
        message: `File size exceeds maximum allowed size of ${maxMB}MB`,
      });
    }

    // Validate MIME type
    if (!allowedMimeTypes.includes(file.mimetype)) {
      errors.push({
        field: 'file.mimetype',
        message: `File type '${file.mimetype}' is not allowed. Allowed types: ${allowedMimeTypes.join(', ')}`,
      });
    }

    // Validate file extension
    const ext = file.filename.split('.').pop()?.toLowerCase() ?? '';
    if (!allowedExtensions.includes(ext)) {
      errors.push({
        field: 'file.filename',
        message: `File extension '.${ext}' is not allowed. Allowed extensions: ${allowedExtensions.join(', ')}`,
      });
    }

    // Check for path traversal in filename
    if (file.filename.includes('..') || file.filename.includes('/') || file.filename.includes('\\')) {
      errors.push({
        field: 'file.filename',
        message: 'Filename contains invalid path characters',
      });
    }

    if (errors.length > 0) {
      logger.warn('File upload validation failed', { filename: file.filename, errors });
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Removes dangerous characters from filenames.
   */
  sanitizeFilename(filename: string): string {
    if (typeof filename !== 'string') {
      return '';
    }

    // Split extension from name
    const lastDot = filename.lastIndexOf('.');
    const name = lastDot >= 0 ? filename.slice(0, lastDot) : filename;
    const ext = lastDot >= 0 ? filename.slice(lastDot + 1) : '';

    // Remove path separators and dots from name (prevents path traversal)
    const safeName = name
      .replace(/[/\\]/g, '_')   // replace path separators
      .replace(/\./g, '_')       // replace dots (prevents ..)
      .replace(DANGEROUS_FILENAME_CHARS_REGEX, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');

    // Remove dangerous characters from extension
    const safeExt = ext.replace(/[^a-zA-Z0-9]/g, '');

    const sanitized = safeExt ? `${safeName}.${safeExt}` : safeName;

    logger.debug('Filename sanitized', { original: filename, sanitized });
    return sanitized;
  }
}

export const sanitizationService = new SanitizationService();
