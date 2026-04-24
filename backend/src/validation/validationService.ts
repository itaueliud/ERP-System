import logger from '../utils/logger';

export interface FieldError {
  field: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: FieldError[];
}

export interface RuleConfig {
  type: 'required' | 'email' | 'phone' | 'amount' | 'dateRange' | 'maxLength' | 'enum';
  allowNegative?: boolean;
  maxLength?: number;
  allowedValues?: string[];
  endDate?: Date;
}

export interface ValidationRule {
  field: string;
  value: any;
  rules: RuleConfig[];
}

export class ValidationService {
  /**
   * Validate email using RFC 5322 standard pattern.
   */
  validateEmail(email: string): ValidationResult {
    const errors: FieldError[] = [];

    if (typeof email !== 'string' || email.trim() === '') {
      errors.push({ field: 'email', message: 'Email is required' });
      return { valid: false, errors };
    }

    // RFC 5322 compliant regex (simplified but covers the standard)
    const rfc5322Regex =
      /^[a-zA-Z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-zA-Z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;

    if (!rfc5322Regex.test(email)) {
      errors.push({ field: 'email', message: 'Invalid email address format (RFC 5322)' });
    }

    if (errors.length > 0) {
      logger.debug('Email validation failed', { email, errors });
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Validate phone number using E.164 international format (+[country][number]).
   */
  validatePhone(phone: string): ValidationResult {
    const errors: FieldError[] = [];

    if (typeof phone !== 'string' || phone.trim() === '') {
      errors.push({ field: 'phone', message: 'Phone number is required' });
      return { valid: false, errors };
    }

    // E.164: + followed by 7 to 15 digits
    const e164Regex = /^\+[1-9]\d{6,14}$/;

    if (!e164Regex.test(phone)) {
      errors.push({
        field: 'phone',
        message: 'Invalid phone number format. Must be E.164 format (e.g. +12025551234)',
      });
    }

    if (errors.length > 0) {
      logger.debug('Phone validation failed', { phone, errors });
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Validate a monetary amount.
   * By default negative values are not allowed.
   */
  validateAmount(amount: number, allowNegative = false): ValidationResult {
    const errors: FieldError[] = [];

    if (typeof amount !== 'number' || isNaN(amount)) {
      errors.push({ field: 'amount', message: 'Amount must be a valid number' });
      return { valid: false, errors };
    }

    if (!isFinite(amount)) {
      errors.push({ field: 'amount', message: 'Amount must be a finite number' });
      return { valid: false, errors };
    }

    if (!allowNegative && amount < 0) {
      errors.push({ field: 'amount', message: 'Amount must not be negative' });
    }

    if (errors.length > 0) {
      logger.debug('Amount validation failed', { amount, allowNegative, errors });
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Validate that startDate is not after endDate.
   */
  validateDateRange(startDate: Date, endDate: Date): ValidationResult {
    const errors: FieldError[] = [];

    if (!(startDate instanceof Date) || isNaN(startDate.getTime())) {
      errors.push({ field: 'startDate', message: 'Start date must be a valid date' });
    }

    if (!(endDate instanceof Date) || isNaN(endDate.getTime())) {
      errors.push({ field: 'endDate', message: 'End date must be a valid date' });
    }

    if (errors.length === 0 && startDate > endDate) {
      errors.push({
        field: 'dateRange',
        message: 'Start date must be less than or equal to end date',
      });
    }

    if (errors.length > 0) {
      logger.debug('Date range validation failed', { startDate, endDate, errors });
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Validate that a required field has a non-empty value.
   */
  validateRequired(value: any, fieldName: string): ValidationResult {
    const errors: FieldError[] = [];

    const isEmpty =
      value === null ||
      value === undefined ||
      (typeof value === 'string' && value.trim() === '') ||
      (Array.isArray(value) && value.length === 0);

    if (isEmpty) {
      errors.push({ field: fieldName, message: `${fieldName} is required` });
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Validate that a string does not exceed a maximum length.
   */
  validateMaxLength(value: string, maxLength: number, fieldName: string): ValidationResult {
    const errors: FieldError[] = [];

    if (typeof value !== 'string') {
      errors.push({ field: fieldName, message: `${fieldName} must be a string` });
      return { valid: false, errors };
    }

    if (value.length > maxLength) {
      errors.push({
        field: fieldName,
        message: `${fieldName} must not exceed ${maxLength} characters`,
      });
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Validate that a value is one of the allowed enum values.
   */
  validateEnum(value: string, allowedValues: string[], fieldName: string): ValidationResult {
    const errors: FieldError[] = [];

    if (!allowedValues.includes(value)) {
      errors.push({
        field: fieldName,
        message: `${fieldName} must be one of: ${allowedValues.join(', ')}`,
      });
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Run multiple validation rules and collect all errors.
   */
  validateAll(rules: ValidationRule[]): ValidationResult {
    const allErrors: FieldError[] = [];

    for (const rule of rules) {
      for (const ruleConfig of rule.rules) {
        let result: ValidationResult;

        switch (ruleConfig.type) {
          case 'required':
            result = this.validateRequired(rule.value, rule.field);
            break;

          case 'email':
            result = this.validateEmail(rule.value);
            // Remap field name to match the rule's field
            result = {
              ...result,
              errors: result.errors.map((e) => ({ ...e, field: rule.field })),
            };
            break;

          case 'phone':
            result = this.validatePhone(rule.value);
            result = {
              ...result,
              errors: result.errors.map((e) => ({ ...e, field: rule.field })),
            };
            break;

          case 'amount':
            result = this.validateAmount(rule.value, ruleConfig.allowNegative);
            result = {
              ...result,
              errors: result.errors.map((e) => ({ ...e, field: rule.field })),
            };
            break;

          case 'dateRange':
            result = this.validateDateRange(rule.value, ruleConfig.endDate as Date);
            break;

          case 'maxLength':
            result = this.validateMaxLength(rule.value, ruleConfig.maxLength as number, rule.field);
            break;

          case 'enum':
            result = this.validateEnum(rule.value, ruleConfig.allowedValues as string[], rule.field);
            break;

          default:
            logger.warn('Unknown validation rule type', { type: (ruleConfig as any).type });
            continue;
        }

        allErrors.push(...result.errors);
      }
    }

    return { valid: allErrors.length === 0, errors: allErrors };
  }
}

export const validationService = new ValidationService();
