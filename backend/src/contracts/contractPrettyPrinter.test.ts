import { ContractPrettyPrinter, ContractData } from './contractPrettyPrinter';

describe('ContractPrettyPrinter', () => {
  let printer: ContractPrettyPrinter;

  beforeEach(() => {
    printer = new ContractPrettyPrinter();
  });

  describe('variable substitution', () => {
    it('should substitute simple variables', () => {
      const template = 'Hello {{name}}!';
      const data: ContractData = { name: 'John Doe' };

      const result = printer.render(template, data, { format: 'html' });

      expect(result).toContain('Hello John Doe!');
    });

    it('should substitute multiple variables', () => {
      const template = '{{client_name}} - {{client_email}} - {{client_phone}}';
      const data: ContractData = {
        client_name: 'Acme Corp',
        client_email: 'contact@acme.com',
        client_phone: '+254700000000',
      };

      const result = printer.render(template, data, { format: 'html' });

      expect(result).toContain('Acme Corp');
      expect(result).toContain('contact@acme.com');
      expect(result).toContain('+254700000000');
    });

    it('should handle missing variables gracefully', () => {
      const template = 'Hello {{name}}!';
      const data: ContractData = {};

      const result = printer.render(template, data, { format: 'html' });

      expect(result).toContain('Hello !');
    });

    it('should substitute nested properties', () => {
      const template = 'Client: {{client.name}}, Email: {{client.email}}';
      const data: ContractData = {
        client: {
          name: 'John Doe',
          email: 'john@example.com',
        },
      };

      const result = printer.render(template, data, { format: 'html' });

      expect(result).toContain('Client: John Doe');
      expect(result).toContain('Email: john@example.com');
    });

    it('should handle numeric values', () => {
      const template = 'Amount: {{amount}}, Quantity: {{quantity}}';
      const data: ContractData = {
        amount: 1500.50,
        quantity: 10,
      };

      const result = printer.render(template, data, { format: 'html' });

      expect(result).toContain('Amount: 1500.5');
      expect(result).toContain('Quantity: 10');
    });
  });

  describe('loop rendering', () => {
    it('should render simple loop', () => {
      const template = '{{#each items}}Item: {{this}}\n{{/each}}';
      const data: ContractData = {
        items: ['Apple', 'Banana', 'Cherry'],
      };

      const result = printer.render(template, data, { format: 'html' });

      expect(result).toContain('Item: Apple');
      expect(result).toContain('Item: Banana');
      expect(result).toContain('Item: Cherry');
    });

    it('should render loop with object properties', () => {
      const template = '{{#each payment_schedule}}Amount: {{this.amount}}, Due: {{this.due_date}}\n{{/each}}';
      const data: ContractData = {
        payment_schedule: [
          { amount: 1000, due_date: '2024-01-15' },
          { amount: 2000, due_date: '2024-02-15' },
        ],
      };

      const result = printer.render(template, data, { format: 'html' });

      expect(result).toContain('Amount: 1000, Due: 2024-01-15');
      expect(result).toContain('Amount: 2000, Due: 2024-02-15');
    });

    it('should handle empty arrays', () => {
      const template = '{{#each items}}Item: {{this}}{{/each}}';
      const data: ContractData = {
        items: [],
      };

      const result = printer.render(template, data, { format: 'html' });

      expect(result).not.toContain('Item:');
    });

    it('should handle missing array', () => {
      const template = '{{#each items}}Item: {{this}}{{/each}}';
      const data: ContractData = {};

      const result = printer.render(template, data, { format: 'html' });

      expect(result).not.toContain('Item:');
    });

    it('should render nested loops', () => {
      const template = '{{#each categories}}Category: {{this.name}}\n{{#each this.items}}  - {{this}}\n{{/each}}{{/each}}';
      const data: ContractData = {
        categories: [
          { name: 'Fruits', items: ['Apple', 'Banana'] },
          { name: 'Vegetables', items: ['Carrot', 'Lettuce'] },
        ],
      };

      const result = printer.render(template, data, { format: 'html' });

      expect(result).toContain('Category: Fruits');
      expect(result).toContain('- Apple');
      expect(result).toContain('Category: Vegetables');
      expect(result).toContain('- Carrot');
    });
  });

  describe('conditional rendering', () => {
    it('should render content when condition is true', () => {
      const template = '{{#if has_discount}}Discount applied!{{/if}}';
      const data: ContractData = {
        has_discount: true,
      };

      const result = printer.render(template, data, { format: 'html' });

      expect(result).toContain('Discount applied!');
    });

    it('should not render content when condition is false', () => {
      const template = '{{#if has_discount}}Discount applied!{{/if}}';
      const data: ContractData = {
        has_discount: false,
      };

      const result = printer.render(template, data, { format: 'html' });

      expect(result).not.toContain('Discount applied!');
    });

    it('should handle missing condition variable', () => {
      const template = '{{#if has_discount}}Discount applied!{{/if}}';
      const data: ContractData = {};

      const result = printer.render(template, data, { format: 'html' });

      expect(result).not.toContain('Discount applied!');
    });

    it('should handle truthy string values', () => {
      const template = '{{#if status}}Status: Active{{/if}}';
      const data: ContractData = {
        status: 'active',
      };

      const result = printer.render(template, data, { format: 'html' });

      expect(result).toContain('Status: Active');
    });

    it('should handle nested conditionals', () => {
      const template = '{{#if outer}}Outer{{#if inner}} Inner{{/if}}{{/if}}';
      const data: ContractData = {
        outer: true,
        inner: true,
      };

      const result = printer.render(template, data, { format: 'html' });

      expect(result).toContain('Outer Inner');
    });
  });

  describe('HTML styling', () => {
    it('should apply default styles', () => {
      const template = 'Hello {{name}}!';
      const data: ContractData = { name: 'World' };

      const result = printer.render(template, data, { format: 'html' });

      expect(result).toContain('<!DOCTYPE html>');
      expect(result).toContain('<html');
      expect(result).toContain('<style>');
      expect(result).toContain('font-family:');
      expect(result).toContain('Hello World!');
    });

    it('should apply custom styles', () => {
      const template = 'Hello {{name}}!';
      const data: ContractData = { name: 'World' };

      const result = printer.render(template, data, {
        format: 'html',
        styling: {
          fontFamily: "'Times New Roman', serif",
          fontSize: '14pt',
          color: '#000000',
        },
      });

      expect(result).toContain("'Times New Roman', serif");
      expect(result).toContain('14pt');
      expect(result).toContain('#000000');
    });

    it('should include responsive styles', () => {
      const template = '{{content}}';
      const data: ContractData = { content: 'Content' };

      const result = printer.render(template, data, { format: 'html' });

      expect(result).toContain('@media print');
      expect(result).toContain('page-break-inside: avoid');
    });

    it('should include heading styles', () => {
      const template = '{{heading}}';
      const data: ContractData = { heading: '# Heading' };

      const result = printer.render(template, data, { format: 'html' });

      expect(result).toContain('h1 {');
      expect(result).toContain('h2 {');
      expect(result).toContain('h3 {');
    });
  });

  describe('PDF generation', () => {
    it.skip('should generate PDF from HTML', async () => {
      const html = '<html><body><h1>Test Contract</h1><p>This is a test.</p></body></html>';

      const pdf = await printer.generatePDF(html);

      expect(pdf).toBeInstanceOf(Buffer);
      expect(pdf.length).toBeGreaterThan(0);
      // PDF files start with %PDF
      expect(pdf.toString('utf8', 0, 4)).toBe('%PDF');
    });

    it.skip('should generate PDF with custom options', async () => {
      const html = '<html><body><h1>Test</h1></body></html>';

      const pdf = await printer.generatePDF(html, {
        format: 'Letter',
        margin: {
          top: '10mm',
          right: '10mm',
          bottom: '10mm',
          left: '10mm',
        },
      });

      expect(pdf).toBeInstanceOf(Buffer);
      expect(pdf.length).toBeGreaterThan(0);
    });

    it.skip('should handle complex HTML in PDF', async () => {
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial; }
            h1 { color: blue; }
          </style>
        </head>
        <body>
          <h1>Contract</h1>
          <p>This is a <strong>test</strong> contract.</p>
          <ul>
            <li>Item 1</li>
            <li>Item 2</li>
          </ul>
        </body>
        </html>
      `;

      const pdf = await printer.generatePDF(html);

      expect(pdf).toBeInstanceOf(Buffer);
      expect(pdf.length).toBeGreaterThan(0);
    });
  });

  describe('renderToPDF', () => {
    it.skip('should render template and generate PDF', async () => {
      const template = '# Contract\n\nClient: {{client_name}}\nAmount: {{amount}}';
      const data: ContractData = {
        client_name: 'Acme Corp',
        amount: 5000,
      };

      const pdf = await printer.renderToPDF(template, data);

      expect(pdf).toBeInstanceOf(Buffer);
      expect(pdf.length).toBeGreaterThan(0);
      expect(pdf.toString('utf8', 0, 4)).toBe('%PDF');
    });

    it.skip('should apply custom styling in PDF', async () => {
      const template = 'Hello {{name}}!';
      const data: ContractData = { name: 'World' };

      const pdf = await printer.renderToPDF(template, data, {
        styling: {
          fontFamily: "'Courier New', monospace",
          fontSize: '10pt',
        },
        pdf: {
          format: 'A4',
        },
      });

      expect(pdf).toBeInstanceOf(Buffer);
      expect(pdf.length).toBeGreaterThan(0);
    });
  });

  describe('data validation', () => {
    it('should validate that all required variables are present', () => {
      const template = 'Hello {{name}}, your email is {{email}}';
      const data: ContractData = {
        name: 'John',
        email: 'john@example.com',
      };

      expect(() => printer.validateData(template, data)).not.toThrow();
    });

    it('should throw error for missing variables', () => {
      const template = 'Hello {{name}}, your email is {{email}}';
      const data: ContractData = {
        name: 'John',
      };

      expect(() => printer.validateData(template, data)).toThrow('Missing required variables: email');
    });

    it('should validate nested properties', () => {
      const template = 'Client: {{client.name}}, Email: {{client.email}}';
      const data: ContractData = {
        client: {
          name: 'John',
          email: 'john@example.com',
        },
      };

      expect(() => printer.validateData(template, data)).not.toThrow();
    });

    it('should throw error for missing nested properties', () => {
      const template = 'Client: {{client.name}}, Email: {{client.email}}';
      const data: ContractData = {
        client: {
          name: 'John',
        },
      };

      expect(() => printer.validateData(template, data)).toThrow('Missing required variables: client.email');
    });

    it('should skip loop context variables in validation', () => {
      const template = '{{#each items}}Item: {{this.name}}{{/each}}';
      const data: ContractData = {
        items: [{ name: 'Item 1' }],
      };

      expect(() => printer.validateData(template, data)).not.toThrow();
    });
  });

  describe('complete contract rendering', () => {
    it('should render complete service agreement', () => {
      const template = `
# SERVICE AGREEMENT

**Contract Reference:** {{contract_reference}}
**Date:** {{contract_date}}

## PARTIES

**Service Provider:**
TechSwiftTrix Limited

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

      const data: ContractData = {
        contract_reference: 'TST-CNT-2024-000001',
        contract_date: '2024-01-15',
        client_name: 'Acme Corporation',
        client_email: 'contact@acme.com',
        client_phone: '+254700000000',
        client_country: 'Kenya',
        service_description: 'Development of custom ERP system',
        currency: 'KES',
        service_amount: '500000',
        payment_schedule: [
          {
            description: 'Initial Payment',
            currency: 'KES',
            amount: '150000',
            due_date: '2024-01-20',
          },
          {
            description: 'Milestone 1',
            currency: 'KES',
            amount: '175000',
            due_date: '2024-02-20',
          },
          {
            description: 'Final Payment',
            currency: 'KES',
            amount: '175000',
            due_date: '2024-03-20',
          },
        ],
        transaction_ids: ['TXN-001', 'TXN-002', 'TXN-003'],
        start_date: '2024-01-20',
        end_date: '2024-03-31',
        duration_days: '71',
        terms_and_conditions: 'Standard terms and conditions apply.',
        signature_date: '2024-01-15',
      };

      const result = printer.render(template, data, { format: 'html' });

      // Verify all data is substituted
      expect(result).toContain('TST-CNT-2024-000001');
      expect(result).toContain('Acme Corporation');
      expect(result).toContain('contact@acme.com');
      expect(result).toContain('Development of custom ERP system');
      expect(result).toContain('KES 500000');
      expect(result).toContain('Initial Payment: KES 150000');
      expect(result).toContain('TXN-001');
      expect(result).toContain('TXN-002');
      expect(result).toContain('71 days');
      expect(result).toContain('Standard terms and conditions apply');
    });

    it.skip('should generate PDF for complete contract', async () => {
      const template = `
# SERVICE AGREEMENT

**Contract Reference:** {{contract_reference}}
**Client:** {{client_name}}
**Amount:** {{currency}} {{service_amount}}
`;

      const data: ContractData = {
        contract_reference: 'TST-CNT-2024-000001',
        client_name: 'Acme Corp',
        currency: 'USD',
        service_amount: '10000',
      };

      const pdf = await printer.renderToPDF(template, data);

      expect(pdf).toBeInstanceOf(Buffer);
      expect(pdf.length).toBeGreaterThan(0);
      expect(pdf.toString('utf8', 0, 4)).toBe('%PDF');
    });
  });

  describe('edge cases', () => {
    it('should handle empty template', () => {
      const template = '{{placeholder}}';
      const data: ContractData = { placeholder: '' };

      expect(() => printer.render(template, data)).not.toThrow();
    });

    it('should handle special characters in data', () => {
      const template = 'Name: {{name}}';
      const data: ContractData = {
        name: "O'Brien & Associates <test@example.com>",
      };

      const result = printer.render(template, data, { format: 'html' });

      expect(result).toContain("O'Brien & Associates <test@example.com>");
    });

    it('should handle unicode characters', () => {
      const template = 'Client: {{name}}';
      const data: ContractData = {
        name: 'Société Générale',
      };

      const result = printer.render(template, data, { format: 'html' });

      expect(result).toContain('Société Générale');
    });

    it('should handle large data sets', () => {
      const template = '{{#each items}}{{this.name}}\n{{/each}}';
      const items = Array.from({ length: 1000 }, (_, i) => ({ name: `Item ${i}` }));
      const data: ContractData = { items };

      const result = printer.render(template, data, { format: 'html' });

      expect(result).toContain('Item 0');
      expect(result).toContain('Item 999');
    });
  });
});
