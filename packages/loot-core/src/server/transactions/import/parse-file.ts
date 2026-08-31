// @ts-strict-ignore
import { parse as csv2json } from 'csv-parse/sync';

import * as fs from '#platform/server/fs';
import { logger } from '#platform/server/log';
import { looselyParseAmount } from '#shared/util';

import {
  expandInstallments,
  formatInstallmentNote,
  parseInstallmentInfo,
} from './installments';
import { ofx2json } from './ofx2json';
import { qif2json } from './qif2json';
import { xmlCAMT2json } from './xmlcamt2json';

/**
 * Parse OFX amount strings to numbers.
 * Handles various OFX amount formats including currency symbols, parentheses, and multiple decimal places.
 * Returns null for invalid amounts instead of NaN.
 */
function parseOfxAmount(amount: string): number | null {
  if (!amount || typeof amount !== 'string') {
    return null;
  }

  // Handle parentheses for negative amounts (e.g., "(30.00)" -> "-30.00")
  let cleaned = amount.trim();
  if (cleaned.startsWith('(') && cleaned.endsWith(')')) {
    cleaned = '-' + cleaned.slice(1, -1);
  }

  // Remove currency symbols and other non-numeric characters except decimal point and minus sign
  cleaned = cleaned.replace(/[^\d.-]/g, '');

  // Handle multiple decimal points by keeping only the first one
  const decimalIndex = cleaned.indexOf('.');
  if (decimalIndex !== -1) {
    const beforeDecimal = cleaned.slice(0, decimalIndex);
    const afterDecimal = cleaned.slice(decimalIndex + 1).replace(/\./g, '');
    cleaned = beforeDecimal + '.' + afterDecimal;
  }

  // Ensure we have a valid number format
  if (!cleaned || cleaned === '-' || cleaned === '.') {
    return null;
  }

  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? null : parsed;
}

type StructuredTransaction = {
  amount: number;
  date: string;
  charge_date?: string | null;
  payee_name: string;
  imported_payee: string;
  notes: string;
  category?: string | null;
};

// CSV files return raw data that are not guaranteed to be StructuredTransactions
type CsvTransaction = Record<string, string> | string[];

type Transaction = StructuredTransaction | CsvTransaction;

type ParseError = { message: string; internal: string };
export type ParseFileResult = {
  errors: ParseError[];
  transactions?: Transaction[];
};

export type ParseFileOptions = {
  hasHeaderRow?: boolean;
  delimiter?: string;
  fallbackMissingPayeeToMemo?: boolean;
  swapPayeeAndMemo?: boolean;
  skipStartLines?: number;
  skipEndLines?: number;
  importNotes?: boolean;
  expandInstallments?: boolean;
};

export async function parseFile(
  filepath: string,
  options: ParseFileOptions = {},
): Promise<ParseFileResult> {
  const errors = Array<ParseError>();
  const m = filepath.match(/\.[^.]*$/);

  let result: ParseFileResult | null = null;
  if (m) {
    const ext = m[0];

    switch (ext.toLowerCase()) {
      case '.qif':
        result = await parseQIF(filepath, options);
        break;
      case '.csv':
      case '.tsv':
        result = await parseCSV(filepath, options);
        break;
      case '.ofx':
      case '.qfx':
        result = await parseOFX(filepath, options);
        break;
      case '.xml':
        result = await parseCAMT(filepath, options);
        break;
      default:
    }
  }

  if (!result) {
    errors.push({
      message: 'Invalid file type',
      internal: '',
    });
    return { errors, transactions: [] };
  }

  if (
    result.transactions &&
    options.expandInstallments !== false &&
    !Array.isArray(result.transactions[0]) &&
    result.transactions[0] != null &&
    'amount' in result.transactions[0]
  ) {
    result.transactions = expandInstallments(
      result.transactions as StructuredTransaction[],
    );
  }

  return result;
}

async function parseCSV(
  filepath: string,
  options: ParseFileOptions,
): Promise<ParseFileResult> {
  const errors = Array<ParseError>();
  let contents = await fs.readFile(filepath);

  const skipStart = Math.max(0, options.skipStartLines || 0);
  const skipEnd = Math.max(0, options.skipEndLines || 0);

  if (skipStart > 0 || skipEnd > 0) {
    const lines = contents.split(/\r?\n/);

    if (skipStart + skipEnd >= lines.length) {
      errors.push({
        message: 'Cannot skip more lines than exist in the file',
        internal: `Attempted to skip ${skipStart} start + ${skipEnd} end lines from ${lines.length} total lines`,
      });
      return { errors, transactions: [] };
    }

    const startLine = skipStart;
    const endLine = skipEnd > 0 ? lines.length - skipEnd : lines.length;
    contents = lines.slice(startLine, endLine).join('\r\n');
  }

  let data: ReturnType<typeof csv2json>;
  try {
    data = csv2json(contents, {
      columns: options?.hasHeaderRow,
      bom: true,
      delimiter: options?.delimiter || ',',

      quote: '"',
      trim: true,
      relax_column_count: true,
      skip_empty_lines: true,
    });
  } catch (err) {
    errors.push({
      message: 'Failed parsing: ' + err.message,
      internal: err.message,
    });
    return { errors, transactions: [] };
  }

  return { errors, transactions: data };
}

async function parseQIF(
  filepath: string,
  options: ParseFileOptions = {},
): Promise<ParseFileResult> {
  const errors = Array<ParseError>();
  const contents = await fs.readFile(filepath);

  let data: ReturnType<typeof qif2json>;
  try {
    data = qif2json(contents);
  } catch (err) {
    errors.push({
      message: "Failed parsing: doesn't look like a valid QIF file.",
      internal: err.stack,
    });
    return { errors, transactions: [] };
  }

  const swap = options.swapPayeeAndMemo;

  return {
    errors: [],
    transactions: data.transactions
      .map(trans => {
        const payeeSource = swap ? trans.memo : trans.payee;
        const memoSource = swap ? trans.payee : trans.memo;
        const fallbackUsed = !payeeSource && swap;

        const effectivePayee =
          payeeSource || (fallbackUsed ? memoSource : null);
        let initialNotes =
          options.importNotes && !fallbackUsed ? memoSource || null : null;

        const textToScan = [memoSource, payeeSource].filter(Boolean).join(' ');
        const installment = parseInstallmentInfo(textToScan);

        let finalPayeeName = effectivePayee;
        if (installment) {
          if (effectivePayee) {
            const payeeInstallment = parseInstallmentInfo(effectivePayee);
            if (payeeInstallment) {
              finalPayeeName = payeeInstallment.cleanedText || effectivePayee;
            }
          }
          initialNotes = formatInstallmentNote(
            initialNotes,
            installment,
            memoSource || effectivePayee,
          );
        }

        return {
          amount:
            trans.amount != null ? looselyParseAmount(trans.amount) : null,
          date: trans.date,
          payee_name: finalPayeeName,
          imported_payee: finalPayeeName,
          category: trans.subcategory || trans.category || null,
          notes: initialNotes,
        };
      })
      .filter(trans => trans.date != null && trans.amount != null),
  };
}

async function parseOFX(
  filepath: string,
  options: ParseFileOptions,
): Promise<ParseFileResult> {
  const errors = Array<ParseError>();
  const contents = await fs.readFile(filepath);

  let data: Awaited<ReturnType<typeof ofx2json>>;
  try {
    data = await ofx2json(contents);
  } catch (err) {
    errors.push({
      message: 'Failed importing file',
      internal: err.stack,
    });
    return { errors };
  }

  // Banks don't always implement the OFX standard properly
  // If no payee is available try and fallback to memo
  const useMemoFallback = options.fallbackMissingPayeeToMemo ?? true;
  const swap = options.swapPayeeAndMemo;

  return {
    errors,
    transactions: data.transactions.map(trans => {
      const parsedAmount = parseOfxAmount(trans.amount);
      if (parsedAmount === null) {
        errors.push({
          message: `Invalid amount format: ${trans.amount}`,
          internal: `Failed to parse amount: ${trans.amount}`,
        });
      }

      const payeeSource = swap ? trans.memo : trans.name;
      const memoSource = swap ? trans.name : trans.memo;
      const fallbackUsed = !payeeSource && useMemoFallback;

      const effectivePayee = payeeSource || (fallbackUsed ? memoSource : null);
      let initialNotes =
        options.importNotes !== false ? memoSource || null : null;

      const textToScan = [memoSource, payeeSource].filter(Boolean).join(' ');
      const installment = parseInstallmentInfo(textToScan);

      let finalPayeeName = effectivePayee;
      if (installment) {
        if (effectivePayee) {
          const payeeInstallment = parseInstallmentInfo(effectivePayee);
          if (payeeInstallment) {
            finalPayeeName = payeeInstallment.cleanedText || effectivePayee;
          }
        }
        initialNotes = formatInstallmentNote(
          initialNotes,
          installment,
          memoSource || effectivePayee,
        );
      }

      const cleanText = (s: string | null | undefined) =>
        s ? s.replace(/\s+/g, ' ').trim() : null;

      const cleanPayee = cleanText(finalPayeeName);
      const cleanNotes = cleanText(initialNotes);

      let importedId = trans.fitId;
      if (installment && importedId) {
        importedId = `${importedId}-inst-${installment.current}`;
      }

      return {
        amount: parsedAmount || 0,
        imported_id: importedId,
        date: trans.date,
        charge_date: trans.charge_date || null,
        payee_name: cleanPayee,
        imported_payee: cleanPayee,
        notes: cleanNotes,
      };
    }),
  };
}

async function parseCAMT(
  filepath: string,
  options: ParseFileOptions = {},
): Promise<ParseFileResult> {
  const errors = Array<ParseError>();
  const contents = await fs.readFile(filepath);

  let data: Awaited<ReturnType<typeof xmlCAMT2json>>;
  try {
    data = await xmlCAMT2json(contents);
  } catch (err) {
    logger.error(err);
    errors.push({
      message: 'Failed importing file',
      internal: err.stack,
    });
    return { errors };
  }

  const swap = options.swapPayeeAndMemo;

  return {
    errors,
    transactions: data.map(trans => {
      const payeeSource = swap ? trans.notes : trans.payee_name;
      const memoSource = swap ? trans.payee_name : trans.notes;
      const fallbackUsed = !payeeSource && swap;

      const effectivePayee = payeeSource || (fallbackUsed ? memoSource : null);
      let initialNotes =
        options.importNotes && !fallbackUsed ? memoSource || null : null;

      const textToScan = [memoSource, payeeSource].filter(Boolean).join(' ');
      const installment = parseInstallmentInfo(textToScan);

      let finalPayeeName = effectivePayee;
      if (installment) {
        if (effectivePayee) {
          const payeeInstallment = parseInstallmentInfo(effectivePayee);
          if (payeeInstallment) {
            finalPayeeName = payeeInstallment.cleanedText || effectivePayee;
          }
        }
        initialNotes = formatInstallmentNote(
          initialNotes,
          installment,
          memoSource || effectivePayee,
        );
      }

      return {
        ...trans,
        payee_name: finalPayeeName,
        imported_payee: finalPayeeName,
        notes: initialNotes,
      };
    }),
  };
}
