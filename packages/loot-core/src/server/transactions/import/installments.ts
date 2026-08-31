import * as d from 'date-fns';

import type * as db from '#server/db';
import { _parse } from '#shared/months';

export type ParsedInstallmentInfo = {
  current: number;
  total: number;
  cleanedText: string;
  noteTag: string;
  isAntecipacao: boolean;
};

/**
 * Parses installment metadata from a transaction memo or description.
 * Supports Brazilian and international formats:
 * - ANTEC 02/02-
 * - PARC 02/03, PARCELA 01/10, PARC. 03/12
 * - [02/03], (02/03)
 * - 02/03 (isolated or hyphenated)
 */
export function parseInstallmentInfo(
  text: string | null | undefined,
): ParsedInstallmentInfo | null {
  if (!text || typeof text !== 'string') {
    return null;
  }

  const cleanSpacing = (s: string) => s.replace(/\s+/g, ' ').trim();

  // Pattern 1: ANTEC 02/02- or ANTEC 02/02
  const antecMatch = text.match(/\bANTEC\s*(\d{1,2})\s*[/]\s*(\d{1,2})\b[-]?/i);
  if (antecMatch) {
    const current = parseInt(antecMatch[1], 10);
    const total = parseInt(antecMatch[2], 10);
    if (current > 0 && total >= current && total <= 99) {
      const cleaned = cleanSpacing(text.replace(antecMatch[0], ' '));
      return {
        current,
        total,
        cleanedText: cleaned,
        noteTag: `[${current}/${total}]`,
        isAntecipacao: true,
      };
    }
  }

  // Pattern 2: PARC 02/03, PARCELA 01/10, PARC. 03/12, PARC02/03
  const parcMatch = text.match(
    /\b(?:PARC|PARCELA|PARC\.|PARCELAS?)\s*(\d{1,2})\s*[/]\s*(\d{1,2})\b/i,
  );
  if (parcMatch) {
    const current = parseInt(parcMatch[1], 10);
    const total = parseInt(parcMatch[2], 10);
    if (current > 0 && total >= current && total <= 99) {
      const cleaned = cleanSpacing(text.replace(parcMatch[0], ' '));
      return {
        current,
        total,
        cleanedText: cleaned,
        noteTag: `[${current}/${total}]`,
        isAntecipacao: false,
      };
    }
  }

  // Pattern 3: [02/03] or (02/03)
  const bracketMatch = text.match(
    /(?:\[|\()(\d{1,2})\s*[/]\s*(\d{1,2})(?:\]|\))/,
  );
  if (bracketMatch) {
    const current = parseInt(bracketMatch[1], 10);
    const total = parseInt(bracketMatch[2], 10);
    if (current > 0 && total >= current && total <= 99) {
      const cleaned = cleanSpacing(text.replace(bracketMatch[0], ' '));
      return {
        current,
        total,
        cleanedText: cleaned,
        noteTag: `[${current}/${total}]`,
        isAntecipacao: false,
      };
    }
  }

  // Pattern 4: 01 DE 10 or 02 de 03
  const deMatch = text.match(/\b(\d{1,2})\s*(?:DE|de)\s*(\d{1,2})\b/);
  if (deMatch) {
    const current = parseInt(deMatch[1], 10);
    const total = parseInt(deMatch[2], 10);
    if (current > 0 && total >= current && total <= 99) {
      const cleaned = cleanSpacing(text.replace(deMatch[0], ' '));
      return {
        current,
        total,
        cleanedText: cleaned,
        noteTag: `[${current}/${total}]`,
        isAntecipacao: false,
      };
    }
  }

  return null;
}

/**
 * Format notes with installment tag ([i/n]) without duplicate prefixes
 */
export function formatInstallmentNote(
  existingNote: string | null | undefined,
  installment: ParsedInstallmentInfo,
  fallbackText?: string | null,
): string {
  const noteTag = installment.noteTag;
  let rawBase = existingNote?.trim() || fallbackText?.trim() || '';

  // If rawBase contains an installment pattern (e.g. PARC 01/03), use its cleanedText
  const parsedInBase = parseInstallmentInfo(rawBase);
  if (parsedInBase) {
    rawBase = parsedInBase.cleanedText;
  }

  if (rawBase.startsWith(noteTag)) {
    return rawBase;
  }

  return rawBase ? `${noteTag} ${rawBase}` : noteTag;
}

export function addMonthsToDay(dateStr: string, n: number): string {
  return d.format(d.addMonths(_parse(dateStr), n), 'yyyy-MM-dd');
}

export type ExpandableTransaction = {
  amount: number;
  date: string;
  charge_date?: string | null;
  payee_name?: string | null;
  imported_payee?: string | null;
  notes?: string | null;
  imported_id?: string | null;
  category?: string | null;
  cleared?: boolean;
} & Record<string, unknown>;

export function expandInstallmentTransaction<T extends ExpandableTransaction>(
  trans: T,
): T[] {
  const textToScan = [trans.notes, trans.payee_name, trans.imported_payee]
    .filter(Boolean)
    .join(' ');
  const installment = parseInstallmentInfo(textToScan);

  if (!installment || installment.total <= 1) {
    return [trans];
  }

  const { current, total } = installment;
  const baseChargeDate = trans.charge_date || trans.date;
  const results: T[] = [];

  const baseImportedId = trans.imported_id
    ? trans.imported_id.replace(/-inst-\d+$/, '')
    : null;

  for (let k = current; k <= total; k++) {
    if (k === current) {
      results.push(trans);
    } else {
      const monthOffset = k - current;
      const targetChargeDate = addMonthsToDay(baseChargeDate, monthOffset);
      const noteTag = `[${k}/${total}]`;
      const targetNotes = formatInstallmentNote(
        trans.notes,
        { ...installment, current: k, noteTag },
        trans.payee_name || trans.imported_payee,
      );

      const generatedTrans: T = {
        ...trans,
        charge_date: targetChargeDate,
        notes: targetNotes,
        imported_id: baseImportedId ? `${baseImportedId}-inst-${k}` : null,
        cleared: false,
      };

      results.push(generatedTrans);
    }
  }

  return results;
}

export function expandInstallments<T extends ExpandableTransaction>(
  transactions: T[],
): T[] {
  return transactions.flatMap(expandInstallmentTransaction);
}

export async function findSiblingInstallments(
  dbModule: typeof db,
  tx: {
    id: string;
    account?: string | null;
    notes?: string | null;
    imported_id?: string | null;
    date?: number | string | null;
    amount?: number | null;
    payee?: string | null;
  },
): Promise<{ id: string; category: string | null }[]> {
  if (!tx || !tx.id) {
    return [];
  }

  let fullTx: {
    id: string;
    account: string;
    notes?: string | null;
    imported_id?: string | null;
    date: number;
    amount: number;
    payee?: string | null;
  } | null = null;

  if (!tx.account || (!tx.notes && !tx.imported_id)) {
    const row = await dbModule.first<{
      id: string;
      account: string;
      notes: string | null;
      imported_id: string | null;
      date: number;
      amount: number;
      payee: string | null;
    }>(
      'SELECT id, account, notes, imported_id, date, amount, payee FROM v_transactions WHERE id = ?',
      [tx.id],
    );
    if (!row) {
      return [];
    }
    fullTx = row;
  } else {
    fullTx = {
      id: tx.id,
      account: tx.account,
      notes: tx.notes,
      imported_id: tx.imported_id,
      date:
        typeof tx.date === 'string'
          ? dbModule.toDateRepr(tx.date)
          : tx.date || 0,
      amount: tx.amount || 0,
      payee: tx.payee,
    };
  }

  const accountId = fullTx.account;
  const importedId = fullTx.imported_id;
  const notes = fullTx.notes;
  const targetId = fullTx.id;

  // Method 1: Sibling search by imported_id (e.g. FITID-inst-1, FITID-inst-2)
  if (importedId && importedId.includes('-inst-')) {
    const baseId = importedId.replace(/-inst-\d+$/, '');
    const rows = await dbModule.all<{ id: string; category: string | null }>(
      `SELECT id, category FROM v_transactions
       WHERE account = ?
         AND (imported_id = ? OR imported_id LIKE ? || '-inst-%')
         AND id != ?`,
      [accountId, baseId, baseId, targetId],
    );
    if (rows.length > 0) {
      return rows;
    }
  }

  // Method 2: Sibling search by notes installment tag (e.g. [1/10], [2/10])
  const parsed = parseInstallmentInfo(notes || '');
  if (parsed && parsed.total > 1) {
    const rows = await dbModule.all<{
      id: string;
      category: string | null;
      notes: string | null;
      amount: number;
      payee: string | null;
      date: number;
    }>(
      `SELECT id, category, notes, amount, payee, date FROM v_transactions
       WHERE account = ?
         AND id != ?
         AND notes IS NOT NULL`,
      [accountId, targetId],
    );

    const siblings = rows.filter(row => {
      const rowParsed = parseInstallmentInfo(row.notes || '');
      if (!rowParsed || rowParsed.total !== parsed.total) {
        return false;
      }
      if (parsed.cleanedText && rowParsed.cleanedText) {
        if (
          parsed.cleanedText.toLowerCase() ===
          rowParsed.cleanedText.toLowerCase()
        ) {
          return true;
        }
      }
      if (fullTx.payee && row.payee && fullTx.payee === row.payee) {
        return true;
      }
      if (Math.abs(row.amount - fullTx.amount) <= 100) {
        return true;
      }
      return false;
    });

    return siblings.map(s => ({ id: s.id, category: s.category }));
  }

  return [];
}
