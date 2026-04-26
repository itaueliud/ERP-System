/**
 * Contract Pretty Printer
 * Formats contracts with variable substitution and generates PDFs
 * Requirements: 64.4-64.6, 9.5
 */

import puppeteer from 'puppeteer';
import { ContractAST, ContractParser } from './contractParser';

export interface ContractData {
  [key: string]: any;
}

export interface PrettyPrintOptions {
  format?: 'html' | 'pdf';
  styling?: StyleOptions;
}

export interface StyleOptions {
  fontFamily?: string;
  fontSize?: string;
  lineHeight?: string;
  color?: string;
  maxWidth?: string;
  padding?: string;
}

export interface PDFOptions {
  format?: 'A4' | 'Letter';
  margin?: {
    top?: string;
    right?: string;
    bottom?: string;
    left?: string;
  };
}

/**
 * ContractPrettyPrinter class
 * Renders contract AST with data substitution and generates formatted output
 * Requirement 64.4: Format Contract_Objects into valid contract documents
 * Requirement 64.5: Apply consistent formatting
 * Requirement 64.6: Generate contracts in PDF format
 */
export class ContractPrettyPrinter {
  private parser: ContractParser;

  constructor() {
    this.parser = new ContractParser();
  }

  /**
   * Render contract template with data
   * Requirement 64.10: Replace template variables with actual values
   */
  render(template: string, data: ContractData, options: PrettyPrintOptions = {}): string {
    // Parse template to AST
    const ast = this.parser.parse(template);

    // Render AST with data substitution
    const content = this.renderAST(ast, data);

    // Apply styling if HTML format
    if (options.format === 'html' || !options.format) {
      return this.applyStyles(content, options.styling);
    }

    return content;
  }

  /**
   * Render AST node with data substitution
   * Requirement 64.10: Replace template variables with actual values
   */
  private renderAST(node: ContractAST, data: ContractData, loopContext?: any): string {
    switch (node.type) {
      case 'CONTRACT':
        return node.children.map((child) => this.renderAST(child, data)).join('');

      case 'TEXT':
        return node.value || '';

      case 'VARIABLE':
        return this.resolveVariable(node.name || '', data, loopContext);

      case 'LOOP':
        return this.renderLoop(node, data, loopContext);

      case 'CONDITION':
        return this.renderCondition(node, data);

      default:
        return '';
    }
  }

  /**
   * Resolve variable value from data
   * Supports nested properties like "this.amount"
   */
  private resolveVariable(name: string, data: ContractData, loopContext?: any): string {
    // Handle loop context variables (this.property)
    if (name.startsWith('this.') && loopContext !== undefined) {
      const property = name.substring(5);
      const value = loopContext[property];
      return value !== undefined ? String(value) : '';
    }

    // Handle simple "this" reference
    if (name === 'this' && loopContext !== undefined) {
      return String(loopContext);
    }

    // Handle nested properties (e.g., "client.name")
    if (name.includes('.')) {
      const parts = name.split('.');
      let value: any = data;
      for (const part of parts) {
        if (value && typeof value === 'object') {
          value = value[part];
        } else {
          return '';
        }
      }
      return value !== undefined ? String(value) : '';
    }

    // Handle simple variables
    const value = data[name];
    return value !== undefined ? String(value) : '';
  }

  /**
   * Render loop node
   * Requirement 64.10: Process template loops
   */
  private renderLoop(node: ContractAST, data: ContractData, parentContext?: any): string {
    const collectionName = node.collection || '';
    
    // Check if collection is a nested property (e.g., "this.items")
    let collection: any;
    if (collectionName.startsWith('this.') && parentContext !== undefined) {
      const property = collectionName.substring(5);
      collection = parentContext[property];
    } else {
      collection = data[collectionName];
    }

    if (!Array.isArray(collection)) {
      return '';
    }

    return collection
      .map((item) => {
        return node.children.map((child) => this.renderAST(child, data, item)).join('');
      })
      .join('');
  }

  /**
   * Render conditional node
   * Requirement 64.10: Process template conditionals
   */
  private renderCondition(node: ContractAST, data: ContractData): string {
    const expression = node.expression || '';
    const value = this.resolveVariable(expression, data);

    // Evaluate truthiness
    const isTruthy = value && value !== 'false' && value !== '0' && value !== 'undefined';

    if (isTruthy) {
      return node.children.map((child) => this.renderAST(child, data)).join('');
    }

    return '';
  }

  /**
   * Apply HTML/CSS styling to content
   * Requirement 64.5: Apply consistent formatting (fonts, spacing, margins, headers, footers)
   */
  private applyStyles(content: string, customStyles?: StyleOptions): string {
    const styles = {
      fontFamily: customStyles?.fontFamily || "'Arial', 'Helvetica', sans-serif",
      fontSize: customStyles?.fontSize || '12pt',
      lineHeight: customStyles?.lineHeight || '1.6',
      color: customStyles?.color || '#333',
      maxWidth: customStyles?.maxWidth || '800px',
      padding: customStyles?.padding || '40px',
    };

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Contract Document</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: ${styles.fontFamily};
      font-size: ${styles.fontSize};
      line-height: ${styles.lineHeight};
      color: ${styles.color};
      max-width: ${styles.maxWidth};
      margin: 0 auto;
      padding: ${styles.padding};
    }
    .tst-header {
      display: flex; align-items: center; gap: 16px;
      padding: 20px 0 20px; margin-bottom: 28px;
      border-bottom: 3px solid #1e90ff;
    }
    .tst-emblem {
      width: 56px; height: 56px; border-radius: 12px;
      background: linear-gradient(135deg, #0a1628 0%, #0d2040 100%);
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0; border: 2px solid #1e90ff33;
    }
    .tst-emblem-text {
      font-family: Arial Black, Arial, sans-serif;
      font-weight: 900; font-size: 18px;
      background: linear-gradient(90deg, #1e90ff, #00d4ff, #84cc16);
      -webkit-background-clip: text; -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    .tst-brand { flex: 1; }
    .tst-brand-name {
      font-size: 20px; font-weight: 900; letter-spacing: -0.5px;
      background: linear-gradient(90deg, #1e90ff, #00d4ff, #84cc16);
      -webkit-background-clip: text; -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    .tst-brand-sub { font-size: 10px; color: #888; letter-spacing: 2px; text-transform: uppercase; margin-top: 2px; }
    .tst-doc-title { text-align: right; }
    .tst-doc-title h2 { font-size: 14px; color: #1e90ff; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; }
    .tst-doc-title p { font-size: 10px; color: #999; margin-top: 2px; }
    h1 { color: #0a1628; font-size: 20pt; font-weight: bold; margin-bottom: 20px; padding-bottom: 10px; border-bottom: 2px solid #1e90ff; text-align: center; }
    h2 { color: #0a1628; font-size: 14pt; font-weight: bold; margin-top: 28px; margin-bottom: 12px; padding-bottom: 5px; border-bottom: 1px solid #00d4ff44; }
    h3 { color: #1e90ff; font-size: 12pt; font-weight: bold; margin-top: 18px; margin-bottom: 8px; }
    p { margin-bottom: 10px; text-align: justify; }
    strong { font-weight: bold; color: #0a1628; }
    ul, ol { margin-left: 20px; margin-bottom: 15px; }
    li { margin-bottom: 5px; }
    .signature-block { margin-top: 60px; page-break-inside: avoid; }
    .signature-line { border-top: 1px solid #333; width: 250px; margin-top: 40px; margin-bottom: 5px; }
    .party-section { margin-bottom: 20px; padding: 15px; background-color: #f0f9ff; border-left: 4px solid #1e90ff; }
    .financial-terms { margin: 20px 0; padding: 15px; background-color: #fefce8; border: 1px solid #eab308; border-radius: 4px; }
    .terms-section { margin-top: 30px; padding: 20px; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px; }
    .tst-footer { margin-top: 48px; padding-top: 16px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 9px; color: #aaa; }
    @media print {
      body { padding: 20mm; }
      .signature-block { page-break-inside: avoid; }
      h1, h2, h3 { page-break-after: avoid; }
    }
  </style>
</head>
<body>
  <div class="tst-header">
    <div class="tst-emblem"><span class="tst-emblem-text">TST</span></div>
    <div class="tst-brand">
      <div class="tst-brand-name">TechSwiftTrix</div>
      <div class="tst-brand-sub">Web · Mobile · Solutions</div>
    </div>
    <div class="tst-doc-title">
      <h2>Contract Document</h2>
      <p>Confidential &amp; Legally Binding</p>
    </div>
  </div>
${content}
  <div class="tst-footer">
    TechSwiftTrix ERP System &nbsp;·&nbsp; Generated ${new Date().toLocaleDateString('en-KE', { year: 'numeric', month: 'long', day: 'numeric' })} &nbsp;·&nbsp; Confidential
  </div>
</body>
</html>`;
  }

  /**
   * Generate PDF from HTML content
   * Requirement 64.6: Generate contracts in PDF format
   * Requirement 9.5: Generate contracts as PDF documents using Puppeteer
   */
  async generatePDF(html: string, options: PDFOptions = {}): Promise<Buffer> {
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    try {
      const page = await browser.newPage();
      await page.setContent(html, {
        waitUntil: 'networkidle0',
      });

      const pdfBuffer = await page.pdf({
        format: options.format || 'A4',
        margin: {
          top: options.margin?.top || '20mm',
          right: options.margin?.right || '20mm',
          bottom: options.margin?.bottom || '20mm',
          left: options.margin?.left || '20mm',
        },
        printBackground: true,
      });

      return pdfBuffer;
    } finally {
      await browser.close();
    }
  }

  /**
   * Render template and generate PDF in one step
   * Convenience method combining render and generatePDF
   */
  async renderToPDF(
    template: string,
    data: ContractData,
    options: { styling?: StyleOptions; pdf?: PDFOptions } = {}
  ): Promise<Buffer> {
    const html = this.render(template, data, {
      format: 'html',
      styling: options.styling,
    });

    return this.generatePDF(html, options.pdf);
  }

  /**
   * Validate that all required variables are present in data
   * Throws error if any required variables are missing
   */
  validateData(template: string, data: ContractData): void {
    const variables = this.parser.getRequiredVariables(template);
    const missing: string[] = [];

    for (const variable of variables) {
      // Skip loop and conditional expressions
      if (variable.startsWith('this.') || variable === 'this') {
        continue;
      }

      // Check if variable exists in data
      if (variable.includes('.')) {
        const parts = variable.split('.');
        let value: any = data;
        for (const part of parts) {
          if (value && typeof value === 'object') {
            value = value[part];
          } else {
            value = undefined;
            break;
          }
        }
        if (value === undefined) {
          missing.push(variable);
        }
      } else {
        if (!(variable in data)) {
          missing.push(variable);
        }
      }
    }

    if (missing.length > 0) {
      throw new Error(`Missing required variables: ${missing.join(', ')}`);
    }
  }
}

export const contractPrettyPrinter = new ContractPrettyPrinter();
export default contractPrettyPrinter;
