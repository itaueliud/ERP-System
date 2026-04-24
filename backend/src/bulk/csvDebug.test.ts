import { CSVParser } from './csvParser';

jest.mock('../utils/logger', () => ({
  __esModule: true,
  default: { debug: jest.fn(), warn: jest.fn(), error: jest.fn(), info: jest.fn() },
}));

describe('CSV debug', () => {
  const p = new CSVParser() as any;

  it('trailing comma bug - tokenizer output', () => {
    const csv = 'a,b\n1,2\n3,';
    const errors: any[] = [];
    const result = p._tokenize(csv, ',', errors);
    console.log('tokenize records:', JSON.stringify(result.records));
    console.log('tokenize lineNumbers:', JSON.stringify(result.lineNumbers));
  });

  it('trailing comma bug - parse output', () => {
    const csv = 'a,b\n1,2\n3,';
    const result = p.parse(csv, { delimiter: ',' });
    console.log('rows:', result.rows.length, JSON.stringify(result.rows));
  });
});
