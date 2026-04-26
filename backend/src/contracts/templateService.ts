/**
 * Contract Template Management Service
 * Handles CRUD for contract templates, validation, and diff/comparison
 */

import { db } from '../database/connection';
import logger from '../utils/logger';

export interface ContractTemplate {
  id: string;
  name: string;
  description?: string;
  content: string;          // HTML/Handlebars template
  variables: string[];      // Extracted variable names e.g. ['clientName', 'serviceAmount']
  isDefault: boolean;
  isActive: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateTemplateInput {
  name: string;
  description?: string;
  content: string;
  isDefault?: boolean;
}

export interface UpdateTemplateInput {
  name?: string;
  description?: string;
  content?: string;
  isDefault?: boolean;
  isActive?: boolean;
}

export interface TemplateValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  extractedVariables: string[];
  missingRequiredVariables: string[];
}

export interface TemplateDiff {
  templateAId: string;
  templateBId: string;
  changes: DiffChange[];
  addedLines: number;
  removedLines: number;
  unchangedLines: number;
}

export interface DiffChange {
  type: 'added' | 'removed' | 'unchanged';
  lineNumber: number;
  content: string;
}

// Required variables every contract template must include
const REQUIRED_VARIABLES = [
  'referenceNumber',
  'clientName',
  'clientEmail',
  'serviceDescription',
  'serviceAmount',
  'currency',
];

export class TemplateService {
  /**
   * Extract {{variable}} placeholders from template content
   */
  extractVariables(content: string): string[] {
    const matches = content.match(/\{\{([^}#/^@!>]+)\}\}/g) ?? [];
    return [...new Set(matches.map((m) => m.replace(/\{\{|\}\}/g, '').trim()))];
  }

  /**
   * Validate a template for required variables and syntax
   */
  validateTemplate(content: string): TemplateValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!content || content.trim().length === 0) {
      errors.push('Template content cannot be empty');
      return { valid: false, errors, warnings, extractedVariables: [], missingRequiredVariables: [] };
    }

    const extractedVariables = this.extractVariables(content);

    // Check for unclosed tags
    const openTags = (content.match(/\{\{#/g) ?? []).length;
    const closeTags = (content.match(/\{\{\//g) ?? []).length;
    if (openTags !== closeTags) {
      errors.push(`Mismatched block tags: ${openTags} opening, ${closeTags} closing`);
    }

    // Check required variables
    const missingRequiredVariables = REQUIRED_VARIABLES.filter(
      (v) => !extractedVariables.includes(v)
    );
    if (missingRequiredVariables.length > 0) {
      errors.push(`Missing required variables: ${missingRequiredVariables.join(', ')}`);
    }

    // Warn about potentially missing common variables
    const commonOptional = ['projectReferenceNumber', 'clientPhone', 'startDate'];
    const missingOptional = commonOptional.filter((v) => !extractedVariables.includes(v));
    if (missingOptional.length > 0) {
      warnings.push(`Consider adding optional variables: ${missingOptional.join(', ')}`);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      extractedVariables,
      missingRequiredVariables,
    };
  }

  /**
   * Create a new contract template
   */
  async createTemplate(input: CreateTemplateInput, createdBy: string): Promise<ContractTemplate> {
    try {
      const validation = this.validateTemplate(input.content);
      if (!validation.valid) {
        throw new Error(`Template validation failed: ${validation.errors.join('; ')}`);
      }

      const variables = this.extractVariables(input.content);

      // If setting as default, unset existing default
      if (input.isDefault) {
        await db.query(`UPDATE contract_templates SET is_default = false WHERE is_default = true`);
      }

      const result = await db.query(
        `INSERT INTO contract_templates (name, description, content, variables, is_default, is_active, created_by)
         VALUES ($1, $2, $3, $4, $5, true, $6)
         RETURNING id, name, description, content, variables, is_default, is_active, created_by, created_at, updated_at`,
        [input.name, input.description ?? null, input.content, JSON.stringify(variables), input.isDefault ?? false, createdBy]
      );

      logger.info('Contract template created', { templateId: result.rows[0].id, name: input.name });
      return this.mapFromDb(result.rows[0]);
    } catch (error) {
      logger.error('Failed to create contract template', { error });
      throw error;
    }
  }

  /**
   * Update an existing template
   */
  async updateTemplate(id: string, input: UpdateTemplateInput): Promise<ContractTemplate> {
    try {
      if (input.content !== undefined) {
        const validation = this.validateTemplate(input.content);
        if (!validation.valid) {
          throw new Error(`Template validation failed: ${validation.errors.join('; ')}`);
        }
      }

      const fields: string[] = [];
      const values: any[] = [];
      let p = 1;

      if (input.name !== undefined) { fields.push(`name = $${p++}`); values.push(input.name); }
      if (input.description !== undefined) { fields.push(`description = $${p++}`); values.push(input.description); }
      if (input.content !== undefined) {
        fields.push(`content = $${p++}`); values.push(input.content);
        fields.push(`variables = $${p++}`); values.push(JSON.stringify(this.extractVariables(input.content)));
      }
      if (input.isDefault !== undefined) {
        if (input.isDefault) {
          await db.query(`UPDATE contract_templates SET is_default = false WHERE is_default = true`);
        }
        fields.push(`is_default = $${p++}`); values.push(input.isDefault);
      }
      if (input.isActive !== undefined) { fields.push(`is_active = $${p++}`); values.push(input.isActive); }

      if (fields.length === 0) throw new Error('No fields to update');
      fields.push(`updated_at = NOW()`);
      values.push(id);

      const result = await db.query(
        `UPDATE contract_templates SET ${fields.join(', ')} WHERE id = $${p}
         RETURNING id, name, description, content, variables, is_default, is_active, created_by, created_at, updated_at`,
        values
      );

      if (result.rows.length === 0) throw new Error('Template not found');
      return this.mapFromDb(result.rows[0]);
    } catch (error) {
      logger.error('Failed to update contract template', { error, id });
      throw error;
    }
  }

  /**
   * Get template by ID
   */
  async getTemplate(id: string): Promise<ContractTemplate | null> {
    const result = await db.query(
      `SELECT id, name, description, content, variables, is_default, is_active, created_by, created_at, updated_at
       FROM contract_templates WHERE id = $1`,
      [id]
    );
    return result.rows.length > 0 ? this.mapFromDb(result.rows[0]) : null;
  }

  /**
   * List all templates
   */
  async listTemplates(activeOnly = true): Promise<ContractTemplate[]> {
    const whereClause = activeOnly ? 'WHERE is_active = true' : '';
    const result = await db.query(
      `SELECT id, name, description, content, variables, is_default, is_active, created_by, created_at, updated_at
       FROM contract_templates ${whereClause} ORDER BY is_default DESC, name ASC`
    );
    return result.rows.map((r) => this.mapFromDb(r));
  }

  /**
   * Get the default template
   */
  async getDefaultTemplate(): Promise<ContractTemplate | null> {
    const result = await db.query(
      `SELECT id, name, description, content, variables, is_default, is_active, created_by, created_at, updated_at
       FROM contract_templates WHERE is_default = true AND is_active = true LIMIT 1`
    );
    return result.rows.length > 0 ? this.mapFromDb(result.rows[0]) : null;
  }

  /**
   * Compare two templates and return a line-by-line diff
   */
  async compareTemplates(templateAId: string, templateBId: string): Promise<TemplateDiff> {
    const [a, b] = await Promise.all([this.getTemplate(templateAId), this.getTemplate(templateBId)]);
    if (!a) throw new Error(`Template ${templateAId} not found`);
    if (!b) throw new Error(`Template ${templateBId} not found`);

    return this.diffContent(templateAId, templateBId, a.content, b.content);
  }

  /**
   * Produce a line-by-line diff between two content strings (LCS-based)
   */
  diffContent(aId: string, bId: string, contentA: string, contentB: string): TemplateDiff {
    const linesA = contentA.split('\n');
    const linesB = contentB.split('\n');
    const m = linesA.length;
    const n = linesB.length;

    const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        dp[i][j] = linesA[i - 1] === linesB[j - 1]
          ? dp[i - 1][j - 1] + 1
          : Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }

    const backtrack = (i: number, j: number): DiffChange[] => {
      if (i === 0 && j === 0) return [];
      if (i === 0) return [...backtrack(0, j - 1), { type: 'added', lineNumber: j, content: linesB[j - 1] }];
      if (j === 0) return [...backtrack(i - 1, 0), { type: 'removed', lineNumber: i, content: linesA[i - 1] }];
      if (linesA[i - 1] === linesB[j - 1]) {
        return [...backtrack(i - 1, j - 1), { type: 'unchanged', lineNumber: i, content: linesA[i - 1] }];
      }
      if (dp[i - 1][j] >= dp[i][j - 1]) {
        return [...backtrack(i - 1, j), { type: 'removed', lineNumber: i, content: linesA[i - 1] }];
      }
      return [...backtrack(i, j - 1), { type: 'added', lineNumber: j, content: linesB[j - 1] }];
    };

    const allChanges = backtrack(m, n);
    return {
      templateAId: aId,
      templateBId: bId,
      changes: allChanges,
      addedLines: allChanges.filter((c) => c.type === 'added').length,
      removedLines: allChanges.filter((c) => c.type === 'removed').length,
      unchangedLines: allChanges.filter((c) => c.type === 'unchanged').length,
    };
  }

  private mapFromDb(row: any): ContractTemplate {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      content: row.content,
      variables: typeof row.variables === 'string' ? JSON.parse(row.variables) : (row.variables ?? []),
      isDefault: row.is_default,
      isActive: row.is_active,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

export const templateService = new TemplateService();
export default templateService;
