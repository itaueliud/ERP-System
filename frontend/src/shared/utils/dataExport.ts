/**
 * Data Export Utilities
 * Export data to CSV and XLSX formats
 */

/**
 * Export data to CSV format
 */
export function exportToCSV(data: any[], filename: string): void {
  if (!data || data.length === 0) {
    alert('No data to export');
    return;
  }

  const keys = Object.keys(data[0]);
  const header = keys.join(',');
  
  const rows = data.map(row => 
    keys.map(key => {
      const value = row[key] ?? '';
      const stringValue = String(value).replace(/"/g, '""');
      return stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')
        ? `"${stringValue}"`
        : stringValue;
    }).join(',')
  );

  const csv = [header, ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  downloadBlob(blob, filename.endsWith('.csv') ? filename : `${filename}.csv`);
}

/**
 * Export data to XLSX format (requires SheetJS library)
 * For now, falls back to CSV
 */
export function exportToXLSX(data: any[], filename: string): void {
  // TODO: Implement XLSX export using SheetJS when library is added
  // For now, export as CSV
  console.warn('XLSX export not yet implemented, falling back to CSV');
  exportToCSV(data, filename.replace('.xlsx', '.csv'));
}

/**
 * Export data to JSON format
 */
export function exportToJSON(data: any[], filename: string): void {
  if (!data || data.length === 0) {
    alert('No data to export');
    return;
  }

  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  downloadBlob(blob, filename.endsWith('.json') ? filename : `${filename}.json`);
}

/**
 * Helper function to trigger file download
 */
function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Format data for export (flatten nested objects, format dates)
 */
export function formatDataForExport(data: any[]): any[] {
  return data.map(row => {
    const formatted: any = {};
    
    Object.entries(row).forEach(([key, value]) => {
      // Format dates
      if (value instanceof Date) {
        formatted[key] = value.toISOString();
      }
      // Flatten nested objects
      else if (value && typeof value === 'object' && !Array.isArray(value)) {
        Object.entries(value).forEach(([nestedKey, nestedValue]) => {
          formatted[`${key}_${nestedKey}`] = nestedValue;
        });
      }
      // Convert arrays to strings
      else if (Array.isArray(value)) {
        formatted[key] = value.join('; ');
      }
      // Keep primitive values as-is
      else {
        formatted[key] = value;
      }
    });
    
    return formatted;
  });
}

/**
 * Export with custom column selection
 */
export function exportWithColumns(
  data: any[],
  columns: string[],
  filename: string,
  format: 'csv' | 'json' = 'csv'
): void {
  if (!data || data.length === 0) {
    alert('No data to export');
    return;
  }

  const filteredData = data.map(row => {
    const filtered: any = {};
    columns.forEach(col => {
      if (col in row) {
        filtered[col] = row[col];
      }
    });
    return filtered;
  });

  if (format === 'json') {
    exportToJSON(filteredData, filename);
  } else {
    exportToCSV(filteredData, filename);
  }
}
