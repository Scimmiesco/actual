import * as d from 'date-fns';

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

  for (let k = 1; k <= total; k++) {
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
        imported_id: trans.imported_id
          ? `${trans.imported_id}-inst-${k}`
          : null,
        cleared: k < current,
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
