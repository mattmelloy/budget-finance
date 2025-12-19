import { ParsedTransaction } from '../types';

// Finds the best column index for a given set of keywords.
const findColumnIndex = (header: string[], keywords: string[]): number => {
    for (const keyword of keywords) {
        const index = header.findIndex(h => h.includes(keyword));
        if (index !== -1) return index;
    }
    return -1;
};

 // More robust date parsing logic.
 // dateFormatHint: 'auto' | 'DMY' | 'MDY'
const parseDate = (dateStr: string, dateFormatHint: 'auto' | 'DMY' | 'MDY' = 'auto'): Date | null => {
    if (!dateStr) return null;

    // Normalize whitespace
    const raw = dateStr.trim();

    // If the string is clearly ISO-like (YYYY- or YYYY/), prefer standard parse
    if (/^\d{4}[-/]/.test(raw)) {
        const timestamp = Date.parse(raw);
        if (!isNaN(timestamp)) return new Date(timestamp);
    }

    // If formatHint provided (DMY or MDY), try to parse numeric ambiguous formats accordingly first
    const numericSlashOrDash = raw.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
    if (numericSlashOrDash) {
        const p1 = parseInt(numericSlashOrDash[1], 10);
        const p2 = parseInt(numericSlashOrDash[2], 10);
        let p3 = parseInt(numericSlashOrDash[3], 10);
        // Normalize two-digit years
        if (p3 < 100) {
            p3 += 2000;
        }

        if (dateFormatHint === 'DMY') {
            return new Date(p3, p2 - 1, p1);
        } else if (dateFormatHint === 'MDY') {
            return new Date(p3, p1 - 1, p2);
        }
        // else fallthrough to auto detection below
    }

    // Try standard parsing as fallback (covers MM/DD/YYYY in many environments)
    let timestamp = Date.parse(raw);
    if (!isNaN(timestamp)) {
        // If it parsed and looks reasonable, return it
        const d = new Date(timestamp);
        // basic sanity check: parsed year should not be absurd (e.g., > 2100)
        const year = d.getFullYear();
        if (year > 1900 && year < 2100) return d;
    }

    // Handle numeric formats like DD/MM/YYYY or MM/DD/YYYY with locale detection
    const parts = raw.match(/(\d+)/g);
    if (parts && parts.length === 3) {
        const [p1, p2, p3] = parts.map(p => parseInt(p, 10));

        // If one part is the 4-digit year, handle accordingly
        if (p3 > 1000) { // could be DD/MM/YYYY or MM/DD/YYYY
            if (p1 > 12) { // Day > 12 -> DD/MM/YYYY
                return new Date(p3, p2 - 1, p1);
            }

            // Ambiguous: decide MM/DD or DD/MM based on user's locale (detect via Intl)
            let dayFirst = false;
            try {
                const fmt = new Intl.DateTimeFormat(undefined);
                const partsTest = fmt.formatToParts(new Date(2020, 11, 31)); // 31 Dec 2020
                const order = partsTest
                    .filter(p => p.type === 'day' || p.type === 'month' || p.type === 'year')
                    .map(p => p.type);
                if (order.length > 0) {
                    dayFirst = order[0] === 'day';
                }
            } catch {
                // If detection fails, fall back to MDY
                dayFirst = false;
            }

            if (dayFirst) {
                // Interpret as DD/MM/YYYY
                return new Date(p3, p2 - 1, p1);
            } else {
                // Interpret as MM/DD/YYYY
                return new Date(p3, p1 - 1, p2);
            }
        }

        if (p1 > 1000) { // YYYY/MM/DD
            return new Date(p1, p2 - 1, p3);
        }
    }

    return null; // Could not parse
}

const parseCSV = (content: string, dateFormatHint: 'auto'|'DMY'|'MDY' = 'auto'): ParsedTransaction[] => {
  const lines = content.split(/\r?\n/).filter(line => line.trim() !== '');
  if (lines.length < 2) return [];

  const headerLine = lines[0];
  const header = headerLine.split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''));
  const body = lines.slice(1);
  
  // Identify column indices
  const dateIndex = findColumnIndex(header, ['date']);
  const descriptionIndex = findColumnIndex(header, ['description', 'narrative', 'memo', 'details', 'payee']);
  const amountIndex = findColumnIndex(header, ['amount']);
  const creditIndex = findColumnIndex(header, ['credit']);
  const debitIndex = findColumnIndex(header, ['debit']);

  // Validate required columns
  if (dateIndex === -1) {
    throw new Error('Could not automatically detect the "Date" column. Please ensure your CSV has a column containing transaction dates.');
  }
  if (descriptionIndex === -1) {
    throw new Error('Could not automatically detect the "Description" column. Please ensure your CSV has a column for the transaction description, narrative, or memo.');
  }

  const hasAmount = amountIndex !== -1;
  const hasCreditDebit = creditIndex !== -1 && debitIndex !== -1;

  if (!hasAmount && !hasCreditDebit) {
    throw new Error('Could not detect amount columns. Please ensure your CSV has an "Amount" column, or both "Credit" and "Debit" columns.');
  }

  const transactions: ParsedTransaction[] = [];

  body.forEach(line => {
    // Split CSV line while respecting quotes
    const values = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(v => v.trim().replace(/"/g, ''));
    if (values.length < header.length) return; // Skip malformed lines

    let amount = 0;
    if (hasAmount) {
        const amountStr = values[amountIndex] ? values[amountIndex].replace(/[$,\s]/g, '') : '0';
        amount = parseFloat(amountStr) || 0;
    } else { // hasCreditDebit
        const creditStr = values[creditIndex] ? values[creditIndex].replace(/[$,\s]/g, '') : '0';
        const debitStr = values[debitIndex] ? values[debitIndex].replace(/[$,\s]/g, '') : '0';
        const credit = parseFloat(creditStr) || 0;
        const debit = parseFloat(debitStr) || 0;
        amount = credit - Math.abs(debit);
    }
    
    const dateValue = values[dateIndex];

    // Prefer locale-aware parsing for ambiguous numeric dates (e.g., 05/12/2025).
    // If the string matches a numeric DD/MM/YYYY or MM/DD/YYYY pattern, use parseDate with 'auto'
    // to allow Intl-based detection. Otherwise fall back to general parseDate behavior.
    let date: Date | null = null;
    const numericSlashOrDash = String(dateValue).trim().match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
    if (numericSlashOrDash) {
      date = parseDate(dateValue, dateFormatHint);
    } else {
      // Non-numeric or ISO-like formats: still use parseDate which will try ISO before locale logic
      date = parseDate(dateValue, dateFormatHint);
    }

    if (!date) return; // Skip transactions with unparseable dates

    const description = values[descriptionIndex];
    if (description) {
        transactions.push({
            date: date.toISOString(),
            rawDate: dateValue,
            description: description,
            amount,
        });
    }
  });

  if (transactions.length === 0) {
      throw new Error("No valid transactions could be parsed from the file. Please check the file format and content.");
  }
  
  return transactions;
};

// Main exported function remains the same
export const parseFile = (file: File, dateFormatHint: 'auto'|'DMY'|'MDY' = 'auto'): Promise<ParsedTransaction[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const content = reader.result as string;
        if (file.name.toLowerCase().endsWith('.csv')) {
          resolve(parseCSV(content, dateFormatHint));
        } else if (file.name.toLowerCase().endsWith('.ofx')) {
          resolve(parseOFX(content));
        } else {
          reject(new Error('Unsupported file type. Please upload a CSV or OFX file.'));
        }
      } catch (error: any) {
        reject(error);
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file.'));
    reader.readAsText(file);
  });
};

// OFX parser remains unchanged
const parseOFX = (content: string): ParsedTransaction[] => {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(content, "text/xml");
    const transactions = xmlDoc.getElementsByTagName('STMTTRN');
    const results: ParsedTransaction[] = [];

    for (let i = 0; i < transactions.length; i++) {
        const t = transactions[i];
        const dateEl = t.getElementsByTagName('DTPOSTED')[0];
        const amountEl = t.getElementsByTagName('TRNAMT')[0];
        const memoEl = t.getElementsByTagName('MEMO')[0];

            if (dateEl && amountEl && memoEl) {
            const dateStr = dateEl.textContent || '';
            // OFX date format is YYYYMMDDHHMMSS[+/-GMT]
            const date = `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}`;
            results.push({
                date: new Date(date).toISOString(),
                rawDate: dateStr,
                description: memoEl.textContent || '',
                amount: parseFloat(amountEl.textContent || '0'),
            });
        }
    }
    return results;
};
