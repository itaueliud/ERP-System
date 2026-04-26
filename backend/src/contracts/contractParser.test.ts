import { ContractParser, ContractAST } from './contractParser';

describe('ContractParser', () => {
  let parser: ContractParser;

  beforeEach(() => {
    parser = new ContractParser();
  });

  describe('tokenization', () => {
    it('should tokenize simple variable', () => {
      const template = 'Hello {{name}}!';
      const ast = parser.parse(template);

      expect(ast.children).toHaveLength(3);
      expect(ast.children[0].type).toBe('TEXT');
      expect(ast.children[0].value).toBe('Hello ');
      expect(ast.children[1].type).toBe('VARIABLE');
      expect(ast.children[1].name).toBe('name');
      expect(ast.children[2].type).toBe('TEXT');
      expect(ast.children[2].value).toBe('!');
    });

    it('should tokenize multiple variables', () => {
      const template = '{{client_name}} - {{client_email}} - {{client_phone}}';
      const ast = parser.parse(template);

      expect(ast.children).toHaveLength(5);
      expect(ast.children[0].type).toBe('VARIABLE');
      expect(ast.children[0].name).toBe('client_name');
      expect(ast.children[2].type).toBe('VARIABLE');
      expect(ast.children[2].name).toBe('client_email');
      expect(ast.children[4].type).toBe('VARIABLE');
      expect(ast.children[4].name).toBe('client_phone');
    });

    it('should handle variables with spaces', () => {
      const template = '{{ variable_name }}';
      const ast = parser.parse(template);

      expect(ast.children).toHaveLength(1);
      expect(ast.children[0].type).toBe('VARIABLE');
      expect(ast.children[0].name).toBe('variable_name');
    });
  });

  describe('loop parsing', () => {
    it('should parse simple loop', () => {
      const template = '{{#each items}}Item: {{this}}{{/each}}';
      const ast = parser.parse(template);

      expect(ast.children).toHaveLength(1);
      expect(ast.children[0].type).toBe('LOOP');
      expect(ast.children[0].collection).toBe('items');
      expect(ast.children[0].children).toHaveLength(2);
    });

    it('should parse loop with multiple variables', () => {
      const template = '{{#each payment_schedule}}Amount: {{this.amount}}, Due: {{this.due_date}}{{/each}}';
      const ast = parser.parse(template);

      expect(ast.children).toHaveLength(1);
      expect(ast.children[0].type).toBe('LOOP');
      expect(ast.children[0].collection).toBe('payment_schedule');
      expect(ast.children[0].children.length).toBeGreaterThan(0);
    });

    it('should parse nested loops', () => {
      const template = '{{#each outer}}{{#each inner}}{{value}}{{/each}}{{/each}}';
      const ast = parser.parse(template);

      expect(ast.children).toHaveLength(1);
      expect(ast.children[0].type).toBe('LOOP');
      expect(ast.children[0].collection).toBe('outer');
      expect(ast.children[0].children[0].type).toBe('LOOP');
      expect(ast.children[0].children[0].collection).toBe('inner');
    });

    it('should throw error for unclosed loop', () => {
      const template = '{{#each items}}Item: {{this}}';
      expect(() => parser.parse(template)).toThrow('Unclosed block detected');
    });

    it('should throw error for unmatched loop end', () => {
      const template = 'Item: {{this}}{{/each}}';
      expect(() => parser.parse(template)).toThrow('Unexpected {{/each}} without matching {{#each}}');
    });
  });

  describe('conditional parsing', () => {
    it('should parse simple conditional', () => {
      const template = '{{#if has_discount}}Discount applied{{/if}}';
      const ast = parser.parse(template);

      expect(ast.children).toHaveLength(1);
      expect(ast.children[0].type).toBe('CONDITION');
      expect(ast.children[0].expression).toBe('has_discount');
      expect(ast.children[0].children).toHaveLength(1);
    });

    it('should parse conditional with variables inside', () => {
      const template = '{{#if show_details}}Name: {{name}}, Email: {{email}}{{/if}}';
      const ast = parser.parse(template);

      expect(ast.children).toHaveLength(1);
      expect(ast.children[0].type).toBe('CONDITION');
      expect(ast.children[0].children.length).toBeGreaterThan(0);
    });

    it('should parse nested conditionals', () => {
      const template = '{{#if outer}}{{#if inner}}Content{{/if}}{{/if}}';
      const ast = parser.parse(template);

      expect(ast.children).toHaveLength(1);
      expect(ast.children[0].type).toBe('CONDITION');
      expect(ast.children[0].expression).toBe('outer');
      expect(ast.children[0].children[0].type).toBe('CONDITION');
      expect(ast.children[0].children[0].expression).toBe('inner');
    });

    it('should throw error for unclosed conditional', () => {
      const template = '{{#if condition}}Content';
      expect(() => parser.parse(template)).toThrow('Unclosed block detected');
    });

    it('should throw error for unmatched conditional end', () => {
      const template = 'Content{{/if}}';
      expect(() => parser.parse(template)).toThrow('Unexpected {{/if}} without matching {{#if}}');
    });
  });

  describe('complex templates', () => {
    it('should parse contract template with all features', () => {
      const template = `
# SERVICE AGREEMENT

**Contract Reference:** {{contract_reference}}
**Date:** {{contract_date}}

## PARTIES

**Client:**
{{client_name}}
Email: {{client_email}}
Phone: {{client_phone}}

## FINANCIAL TERMS

**Total Service Amount:** {{currency}} {{service_amount}}

**Payment Schedule:**
{{#each payment_schedule}}
- {{this.description}}: {{this.currency}} {{this.amount}} (Due: {{this.due_date}})
{{/each}}

{{#if has_transactions}}
**Transaction References:**
{{#each transaction_ids}}
- {{this}}
{{/each}}
{{/if}}

## TERMS AND CONDITIONS

{{terms_and_conditions}}
`;

      const ast = parser.parse(template);

      expect(ast.type).toBe('CONTRACT');
      expect(ast.children.length).toBeGreaterThan(0);

      // Verify variables are extracted
      const variables = parser.extractVariables(ast);
      expect(variables).toContain('contract_reference');
      expect(variables).toContain('client_name');
      expect(variables).toContain('service_amount');
      expect(variables).toContain('payment_schedule');
      expect(variables).toContain('has_transactions');
      expect(variables).toContain('transaction_ids');
    });

    it('should handle mixed loops and conditionals', () => {
      const template = `{{#each items}}{{#if this.active}}Item: {{this.name}} - {{this.price}}{{/if}}{{/each}}`;

      const ast = parser.parse(template);

      expect(ast.children[0].type).toBe('LOOP');
      expect(ast.children[0].children.some((child: ContractAST) => child.type === 'CONDITION')).toBe(true);
    });
  });

  describe('variable extraction', () => {
    it('should extract all variables from template', () => {
      const template = 'Hello {{name}}, your email is {{email}} and phone is {{phone}}';
      const variables = parser.getRequiredVariables(template);

      expect(variables).toHaveLength(3);
      expect(variables).toContain('name');
      expect(variables).toContain('email');
      expect(variables).toContain('phone');
    });

    it('should extract variables from loops', () => {
      const template = '{{#each items}}{{this.name}}{{/each}}';
      const variables = parser.getRequiredVariables(template);

      expect(variables).toContain('items');
      expect(variables).toContain('this.name');
    });

    it('should extract variables from conditionals', () => {
      const template = '{{#if show_name}}{{name}}{{/if}}';
      const variables = parser.getRequiredVariables(template);

      expect(variables).toContain('show_name');
      expect(variables).toContain('name');
    });

    it('should handle duplicate variables', () => {
      const template = '{{name}} and {{name}} again';
      const variables = parser.getRequiredVariables(template);

      expect(variables.filter((v) => v === 'name')).toHaveLength(2);
    });
  });

  describe('template validation', () => {
    it('should validate correct template', () => {
      const template = 'Hello {{name}}!';
      const result = parser.validateTemplate(template);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect unclosed loop', () => {
      const template = '{{#each items}}Item{{name}}';
      const result = parser.validateTemplate(template);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('Unclosed block');
    });

    it('should detect unmatched closing tag', () => {
      const template = 'Content{{/each}}';
      const result = parser.validateTemplate(template);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should detect unclosed conditional', () => {
      const template = '{{#if condition}}Content';
      const result = parser.validateTemplate(template);

      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('Unclosed block');
    });

    it('should reject template without variables', () => {
      const template = 'Just plain text';
      const result = parser.validateTemplate(template);

      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('at least one variable');
    });
  });

  describe('edge cases', () => {
    it('should handle empty template', () => {
      const template = '';
      expect(() => parser.parse(template)).toThrow('at least one variable');
    });

    it('should handle template with only variables', () => {
      const template = '{{var1}}{{var2}}{{var3}}';
      const ast = parser.parse(template);

      expect(ast.children).toHaveLength(3);
      expect(ast.children.every((child) => child.type === 'VARIABLE')).toBe(true);
    });

    it('should handle consecutive loops', () => {
      const template = '{{#each list1}}{{this}}{{/each}}{{#each list2}}{{this}}{{/each}}';
      const ast = parser.parse(template);

      expect(ast.children).toHaveLength(2);
      expect(ast.children[0].type).toBe('LOOP');
      expect(ast.children[1].type).toBe('LOOP');
    });

    it('should handle consecutive conditionals', () => {
      const template = '{{#if cond1}}A{{/if}}{{#if cond2}}B{{/if}}';
      const ast = parser.parse(template);

      expect(ast.children).toHaveLength(2);
      expect(ast.children[0].type).toBe('CONDITION');
      expect(ast.children[1].type).toBe('CONDITION');
    });

    it('should handle variables with underscores and numbers', () => {
      const template = '{{var_1}} {{var_2_test}} {{var123}}';
      const variables = parser.getRequiredVariables(template);

      expect(variables).toContain('var_1');
      expect(variables).toContain('var_2_test');
      expect(variables).toContain('var123');
    });

    it('should handle multiline templates', () => {
      const template = `Line 1: {{var1}}
Line 2: {{var2}}
Line 3: {{var3}}`;
      const ast = parser.parse(template);

      const variables = parser.extractVariables(ast);
      expect(variables).toContain('var1');
      expect(variables).toContain('var2');
      expect(variables).toContain('var3');
    });
  });

  describe('real-world contract template', () => {
    it('should parse complete service agreement template', () => {
      const template = `
# SERVICE AGREEMENT

**Contract Reference:** {{contract_reference}}
**Date:** {{contract_date}}

## PARTIES

This agreement is entered into between:

**Service Provider:**
TechSwiftTrix Limited
Registration Number: {{provider_registration}}

**Client:**
{{client_name}}
Email: {{client_email}}
Phone: {{client_phone}}
Country: {{client_country}}

## SERVICE DESCRIPTION

{{service_description}}

## FINANCIAL TERMS

**Total Service Amount:** {{currency}} {{service_amount}}

**Payment Schedule:**
{{#each payment_schedule}}
- {{this.description}}: {{this.currency}} {{this.amount}} (Due: {{this.due_date}})
{{/each}}

**Transaction References:**
{{#each transaction_ids}}
- {{this}}
{{/each}}

## PROJECT TIMELINE

**Start Date:** {{start_date}}
**Expected Completion:** {{end_date}}
**Duration:** {{duration_days}} days

## TERMS AND CONDITIONS

{{terms_and_conditions}}

## SIGNATURES

**For TechSwiftTrix Limited:**
_________________________
Authorized Signatory
Date: {{signature_date}}

**For {{client_name}}:**
_________________________
Authorized Signatory
Date: {{signature_date}}
`;

      const result = parser.validateTemplate(template);
      expect(result.valid).toBe(true);

      const ast = parser.parse(template);
      expect(ast.type).toBe('CONTRACT');

      const variables = parser.extractVariables(ast);
      
      // Check for key variables
      expect(variables).toContain('contract_reference');
      expect(variables).toContain('contract_date');
      expect(variables).toContain('client_name');
      expect(variables).toContain('client_email');
      expect(variables).toContain('service_description');
      expect(variables).toContain('service_amount');
      expect(variables).toContain('payment_schedule');
      expect(variables).toContain('transaction_ids');
      expect(variables).toContain('start_date');
      expect(variables).toContain('end_date');
      expect(variables).toContain('terms_and_conditions');
    });
  });
});
