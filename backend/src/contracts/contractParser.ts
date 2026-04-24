/**
 * Contract Template Parser
 * Parses contract templates with Handlebars-like syntax
 * Supports variables {{variable_name}}, conditionals {{#if}}, and loops {{#each}}
 * Requirements: 64.1-64.10
 */

export interface Token {
  type: 'TEXT' | 'VARIABLE' | 'LOOP_START' | 'LOOP_END' | 'CONDITION_START' | 'CONDITION_END';
  value?: string;
}

export interface ContractAST {
  type: 'CONTRACT' | 'TEXT' | 'VARIABLE' | 'LOOP' | 'CONDITION';
  value?: string;
  name?: string;
  collection?: string;
  expression?: string;
  children: ContractAST[];
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * ContractParser class
 * Parses contract templates into Abstract Syntax Trees (AST)
 * Requirement 64.1: Parse contract templates into Contract_Object
 * Requirement 64.9: Support template variables
 */
export class ContractParser {
  /**
   * Parse contract template into AST
   * Requirement 64.1: Parse contract template into Contract_Object
   */
  parse(template: string): ContractAST {
    // Tokenize template
    const tokens = this.tokenize(template);

    // Build AST
    const ast = this.buildAST(tokens);

    // Validate AST
    this.validate(ast);

    return ast;
  }

  /**
   * Tokenize template string into tokens
   * Requirement 64.9: Support template variables {{variable_name}}
   */
  private tokenize(template: string): Token[] {
    const tokens: Token[] = [];
    const regex = /\{\{([^}]+)\}\}/g;
    let match;
    let lastIndex = 0;

    while ((match = regex.exec(template)) !== null) {
      // Add text before variable
      if (match.index > lastIndex) {
        tokens.push({
          type: 'TEXT',
          value: template.substring(lastIndex, match.index),
        });
      }

      // Add variable token
      const variable = match[1].trim();
      if (variable.startsWith('#each ')) {
        tokens.push({ type: 'LOOP_START', value: variable.substring(6).trim() });
      } else if (variable === '/each') {
        tokens.push({ type: 'LOOP_END' });
      } else if (variable.startsWith('#if ')) {
        tokens.push({ type: 'CONDITION_START', value: variable.substring(4).trim() });
      } else if (variable === '/if') {
        tokens.push({ type: 'CONDITION_END' });
      } else {
        tokens.push({ type: 'VARIABLE', value: variable });
      }

      lastIndex = regex.lastIndex;
    }

    // Add remaining text
    if (lastIndex < template.length) {
      tokens.push({
        type: 'TEXT',
        value: template.substring(lastIndex),
      });
    }

    return tokens;
  }

  /**
   * Build Abstract Syntax Tree from tokens
   * Requirement 64.2: Extract contract fields
   */
  private buildAST(tokens: Token[]): ContractAST {
    const ast: ContractAST = {
      type: 'CONTRACT',
      children: [],
    };

    let current = ast;
    const stack: ContractAST[] = [ast];

    for (const token of tokens) {
      switch (token.type) {
        case 'TEXT':
          current.children.push({
            type: 'TEXT',
            value: token.value,
            children: [],
          });
          break;

        case 'VARIABLE':
          current.children.push({
            type: 'VARIABLE',
            name: token.value,
            children: [],
          });
          break;

        case 'LOOP_START':
          const loopNode: ContractAST = {
            type: 'LOOP',
            collection: token.value,
            children: [],
          };
          current.children.push(loopNode);
          stack.push(loopNode);
          current = loopNode;
          break;

        case 'LOOP_END':
          if (stack.length <= 1) {
            throw new Error('Unexpected {{/each}} without matching {{#each}}');
          }
          stack.pop();
          current = stack[stack.length - 1];
          break;

        case 'CONDITION_START':
          const conditionNode: ContractAST = {
            type: 'CONDITION',
            expression: token.value,
            children: [],
          };
          current.children.push(conditionNode);
          stack.push(conditionNode);
          current = conditionNode;
          break;

        case 'CONDITION_END':
          if (stack.length <= 1) {
            throw new Error('Unexpected {{/if}} without matching {{#if}}');
          }
          stack.pop();
          current = stack[stack.length - 1];
          break;
      }
    }

    // Check for unclosed blocks
    if (stack.length > 1) {
      throw new Error('Unclosed block detected. Missing {{/each}} or {{/if}}');
    }

    return ast;
  }

  /**
   * Validate AST structure
   * Requirement 64.3: Return descriptive parsing errors for invalid syntax
   */
  private validate(ast: ContractAST): void {
    // Extract all variables from AST
    const variables = this.extractVariables(ast);

    // Check for required variables (basic validation)
    // Note: Specific required variables depend on contract type
    // This is a minimal validation - more specific validation can be added
    if (variables.length === 0) {
      throw new Error('Template must contain at least one variable');
    }
  }

  /**
   * Extract all variable names from AST
   * Requirement 64.2: Extract contract fields
   */
  extractVariables(ast: ContractAST): string[] {
    const variables: string[] = [];

    const traverse = (node: ContractAST) => {
      if (node.type === 'VARIABLE' && node.name) {
        variables.push(node.name);
      }

      if (node.type === 'LOOP' && node.collection) {
        variables.push(node.collection);
      }

      if (node.type === 'CONDITION' && node.expression) {
        variables.push(node.expression);
      }

      for (const child of node.children) {
        traverse(child);
      }
    };

    traverse(ast);
    return variables;
  }

  /**
   * Validate template syntax without parsing
   * Requirement 64.3: Return descriptive parsing errors for invalid syntax
   */
  validateTemplate(template: string): ValidationResult {
    const errors: string[] = [];

    try {
      // Try to parse the template
      this.parse(template);
      return { valid: true, errors: [] };
    } catch (error) {
      if (error instanceof Error) {
        errors.push(error.message);
      } else {
        errors.push('Unknown parsing error');
      }
      return { valid: false, errors };
    }
  }

  /**
   * Extract required variables from template
   * Used for validation before rendering
   */
  getRequiredVariables(template: string): string[] {
    try {
      const ast = this.parse(template);
      return this.extractVariables(ast);
    } catch (error) {
      throw new Error(`Failed to extract variables: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

export const contractParser = new ContractParser();
export default contractParser;
