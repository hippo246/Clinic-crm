/**
 * File Format Service
 * Handles file format validation, parsing, and generation
 */

import { logger } from '../utils/logger';
import {
  ALLOWED_IMPORT_FORMATS,
  ALLOWED_EXPORT_FORMATS,
  CSV_FORMULA_PATTERNS,
  PROTOTYPE_POLLUTION_KEYS,
  MAX_IMPORT_ROWS,
} from './dataExchange.constants';

export class FileFormatService {
  /**
   * Validate import file format
   */
  validateImportFormat(format: string): boolean {
    return ALLOWED_IMPORT_FORMATS.includes(format as any);
  }

  /**
   * Validate export file format
   */
  validateExportFormat(format: string): boolean {
    return ALLOWED_EXPORT_FORMATS.includes(format as any);
  }

  /**
   * Parse JSON file
   */
  parseJSON(buffer: Buffer): any[] {
    try {
      const content = buffer.toString('utf-8');
      const data = JSON.parse(content);
      
      if (!Array.isArray(data)) {
        throw new Error('JSON must be an array of objects');
      }

      if (data.length > MAX_IMPORT_ROWS) {
        throw new Error(`File exceeds maximum row count of ${MAX_IMPORT_ROWS}`);
      }

      // Check for prototype pollution
      this.checkPrototypePollution(data);

      return data;
    } catch (error) {
      logger.error('Failed to parse JSON file', { error: error instanceof Error ? error.message : 'Unknown error' });
      throw new Error('Invalid JSON file format');
    }
  }

  /**
   * Parse CSV file
   */
  parseCSV(buffer: Buffer): any[] {
    try {
      const content = buffer.toString('utf-8');
      const lines = content.split('\n').filter((line) => line.trim());
      
      if (lines.length === 0) {
        throw new Error('CSV file is empty');
      }

      if (lines.length > MAX_IMPORT_ROWS + 1) { // +1 for header
        throw new Error(`File exceeds maximum row count of ${MAX_IMPORT_ROWS}`);
      }

      const headers = this.parseCSVLine(lines[0]);
      const data: any[] = [];

      for (let i = 1; i < lines.length; i++) {
        const values = this.parseCSVLine(lines[i]);
        const row: any = {};

        for (let j = 0; j < headers.length; j++) {
          const header = headers[j];
          const value = values[j];

          // Check for CSV formula injection
          if (typeof value === 'string' && CSV_FORMULA_PATTERNS.some((pattern) => pattern.test(value))) {
            row[header] = ''; // Sanitize formula injection
          } else {
            row[header] = value;
          }
        }

        data.push(row);
      }

      // Check for prototype pollution
      this.checkPrototypePollution(data);

      return data;
    } catch (error) {
      logger.error('Failed to parse CSV file', { error: error instanceof Error ? error.message : 'Unknown error' });
      throw new Error('Invalid CSV file format');
    }
  }

  /**
   * Parse a single CSV line
   */
  private parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }

    result.push(current.trim());
    return result;
  }

  /**
   * Check for prototype pollution
   */
  private checkPrototypePollution(data: any[]): void {
    for (const item of data) {
      if (typeof item !== 'object' || item === null) {
        continue;
      }

      for (const key of Object.keys(item)) {
        if (PROTOTYPE_POLLUTION_KEYS.includes(key)) {
          throw new Error('Invalid key detected: prototype pollution attempt');
        }
      }
    }
  }

  /**
   * Generate JSON export
   */
  generateJSON(data: any[]): string {
    return JSON.stringify(data, null, 2);
  }

  /**
   * Generate CSV export
   */
  generateCSV(data: any[]): string {
    if (data.length === 0) {
      return '';
    }

    const headers = Object.keys(data[0]);
    const csvRows: string[] = [];

    // Add header row
    csvRows.push(headers.join(','));

    // Add data rows
    for (const row of data) {
      const values = headers.map((header) => {
        const value = row[header];
        
        // Escape values that could be formula injection
        if (typeof value === 'string' && CSV_FORMULA_PATTERNS.some((pattern) => pattern.test(value))) {
          return `'${value}`; // Prefix with single quote to prevent formula execution
        }

        // Escape CSV special characters
        if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }

        return value ?? '';
      });

      csvRows.push(values.join(','));
    }

    return csvRows.join('\n');
  }
}

export const fileFormatService = new FileFormatService();
