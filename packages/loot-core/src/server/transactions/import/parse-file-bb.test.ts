import path from 'path';

import { describe, expect, it } from 'vitest';

import { parseFile } from './parse-file';

describe('BB Credit Card OFX Import and Installment Detection', () => {
  const examplesDir = path.resolve(
    __dirname,
    '../../../../../../examples-import-CCard',
  );

  it('parses OUROCARD_INTERN._VISA-UNIV.-Ago_26.ofx with installments and charge_date', async () => {
    const filePath = path.join(
      examplesDir,
      'OUROCARD_INTERN._VISA-UNIV.-Ago_26.ofx',
    );
    const result = await parseFile(filePath, { importNotes: true });

    expect(result.errors).toEqual([]);
    expect(result.transactions?.length).toBe(66);

    // Check transactions with installments
    const shein = result.transactions?.find(t =>
      // @ts-expect-error - structured transaction
      t.notes?.includes('[2/3] SHEIN'),
    );
    expect(shein).toBeDefined();
    // @ts-expect-error - structured transaction
    expect(shein.notes).toBe('[2/3] SHEIN *SHEIN Vila OlimpiaBR');
    // @ts-expect-error - structured transaction
    expect(shein.payee_name).toBe('SHEIN *SHEIN Vila OlimpiaBR');
    // @ts-expect-error - structured transaction
    expect(shein.charge_date).toBe('2026-08-11');
    // @ts-expect-error - structured transaction
    expect(shein.date).toBe('2026-06-21');

    const amazon = result.transactions?.find(t =>
      // @ts-expect-error - structured transaction
      t.notes?.includes('[2/2]'),
    );
    expect(amazon).toBeDefined();
    // @ts-expect-error - structured transaction
    expect(amazon.notes).toBe('[2/2] AMAZONMKTPLC*LB BELOBR');
    // @ts-expect-error - structured transaction
    expect(amazon.payee_name).toBe('AMAZONMKTPLC*LB BELOBR');
    // @ts-expect-error - structured transaction
    expect(amazon.charge_date).toBe('2026-08-11');

    const olx = result.transactions?.find(t =>
      // @ts-expect-error - structured transaction
      t.notes?.includes('[1/10]'),
    );
    expect(olx).toBeDefined();
    // @ts-expect-error - structured transaction
    expect(olx.notes).toBe('[1/10] ZP *OLX ALVAR Guarulhos BR');
    // @ts-expect-error - structured transaction
    expect(olx.charge_date).toBe('2026-08-11');

    // Single transactions (no installments) should have clean notes & charge_date
    const uber = result.transactions?.find(t =>
      // @ts-expect-error - structured transaction
      t.payee_name?.includes('UberRides'),
    );
    expect(uber).toBeDefined();
    // @ts-expect-error - structured transaction
    expect(uber.notes).toBe('DL *UberRides Sao Paulo BR');
    // @ts-expect-error - structured transaction
    expect(uber.charge_date).toBe('2026-08-11');
  });

  it('parses OUROCARD_INTERN._VISA-UNIV.-Próxima_Fatura.ofx with automatic future and past installment expansion', async () => {
    const filePath = path.join(
      examplesDir,
      'OUROCARD_INTERN._VISA-UNIV.-Próxima_Fatura.ofx',
    );
    const result = await parseFile(filePath, { importNotes: true });

    expect(result.errors).toEqual([]);
    // 43 transactions in OFX expand into all past and future installments
    expect(result.transactions?.length).toBeGreaterThan(43);

    // KAZA MIX [1/3] expands into [1/3] (current month: Sept), [2/3] (Oct), [3/3] (Nov)
    const kazaMix1 = result.transactions?.find(t =>
      // @ts-expect-error - structured transaction
      t.notes?.includes('[1/3] KAZA MIX'),
    );
    expect(kazaMix1).toBeDefined();
    // @ts-expect-error - structured transaction
    expect(kazaMix1.charge_date).toBe('2026-09-27');

    const kazaMix2 = result.transactions?.find(t =>
      // @ts-expect-error - structured transaction
      t.notes?.includes('[2/3] KAZA MIX'),
    );
    expect(kazaMix2).toBeDefined();
    // @ts-expect-error - structured transaction
    expect(kazaMix2.charge_date).toBe('2026-10-27');
    // @ts-expect-error - structured transaction
    expect(kazaMix2.amount).toBe(kazaMix1.amount);
    // @ts-expect-error - structured transaction
    expect(kazaMix2.cleared).toBe(false);

    const kazaMix3 = result.transactions?.find(t =>
      // @ts-expect-error - structured transaction
      t.notes?.includes('[3/3] KAZA MIX'),
    );
    expect(kazaMix3).toBeDefined();
    // @ts-expect-error - structured transaction
    expect(kazaMix3.charge_date).toBe('2026-11-27');

    // ZP * OLX ALVAR [2/10] in September expands into [2/10] in Sept, and [3/10]..[10/10] in future months
    const olx2 = result.transactions?.find(t =>
      // @ts-expect-error - structured transaction
      t.notes?.includes('[2/10] ZP *OLX ALVAR'),
    );
    expect(olx2).toBeDefined();
    // @ts-expect-error - structured transaction
    expect(olx2.charge_date).toBe('2026-09-27');

    const olx10 = result.transactions?.find(t =>
      // @ts-expect-error - structured transaction
      t.notes?.includes('[10/10] ZP *OLX ALVAR'),
    );
    expect(olx10).toBeDefined();
    // @ts-expect-error - structured transaction
    expect(olx10.charge_date).toBe('2027-05-27');
  });

  it('imports Ago_26.ofx and then Próxima_Fatura.ofx sequentially without duplicates or errors', async () => {
    await global.emptyDatabase()();

    const db = await import('#server/db');
    const prefs = await import('#server/prefs');
    const { reconcileTransactions } = await import('#server/accounts/sync');
    const { amountToInteger } = await import('#shared/util');

    await prefs.loadPrefs();
    await db.insertAccount({ id: 'cc-acct', name: 'Credit Card' });

    // Step 1: Import August
    const file1 = path.join(
      examplesDir,
      'OUROCARD_INTERN._VISA-UNIV.-Ago_26.ofx',
    );
    const parsed1 = await parseFile(file1, { importNotes: true });
    expect(parsed1.errors).toEqual([]);

    const trans1 = (
      parsed1.transactions as unknown as Array<{ amount: number }>
    ).map(t => ({
      ...t,
      amount: amountToInteger(t.amount),
    }));

    const res1 = await reconcileTransactions('cc-acct', trans1);
    console.log(
      'Import 1: added:',
      res1.added.length,
      'updated:',
      res1.updated.length,
    );

    type DbRow = {
      id: string;
      date: number;
      charge_date: number | null;
      amount: number;
      notes: string | null;
      imported_id: string | null;
      category?: string | null;
    };

    const dbTransAfter1 = await db.all<DbRow>(
      'SELECT id, date, charge_date, amount, notes, imported_id FROM v_transactions WHERE account = ?',
      ['cc-acct'],
    );
    console.log(
      'After import 1, total transactions in DB:',
      dbTransAfter1.length,
    );

    // Step 2: Import Next Month (Próxima Fatura)
    const file2 = path.join(
      examplesDir,
      'OUROCARD_INTERN._VISA-UNIV.-Próxima_Fatura.ofx',
    );
    const parsed2 = await parseFile(file2, { importNotes: true });
    expect(parsed2.errors).toEqual([]);

    const trans2 = (
      parsed2.transactions as unknown as Array<{ amount: number }>
    ).map(t => ({
      ...t,
      amount: amountToInteger(t.amount),
    }));

    const res2 = await reconcileTransactions('cc-acct', trans2);
    console.log(
      'Import 2 result: added:',
      res2.added.length,
      'updated:',
      res2.updated.length,
    );

    const dbTransAfter2 = await db.all<DbRow>(
      'SELECT id, date, charge_date, amount, notes, imported_id FROM v_transactions WHERE account = ?',
      ['cc-acct'],
    );
    console.log(
      'After import 2, total transactions in DB:',
      dbTransAfter2.length,
    );

    // Check that all imported transactions have distinct imported_ids
    const importedIds = dbTransAfter2.map(t => t.imported_id).filter(Boolean);
    const uniqueImportedIds = new Set(importedIds);
    expect(importedIds.length).toBe(uniqueImportedIds.size);

    // Monthly breakdown by charge_date
    const byMonth = new Map<
      string,
      { total: number; trans: typeof dbTransAfter2 }
    >();
    for (const t of dbTransAfter2) {
      const cdStr = t.charge_date ? String(t.charge_date) : String(t.date);
      const m = `${cdStr.slice(0, 4)}-${cdStr.slice(4, 6)}`;
      const current = byMonth.get(m) || { total: 0, trans: [] };
      current.total += t.amount;
      current.trans.push(t);
      byMonth.set(m, current);
    }

    // August has exactly 40 transactions with pure August statement expenses (R$ 2180.74 including refunds)
    const aug = byMonth.get('2026-08');
    expect(aug).toBeDefined();
    expect(aug!.trans.length).toBe(40);
    const augExpenses = aug!.trans
      .filter(t => t.amount < 0)
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);
    expect(augExpenses).toBe(217783);

    // September has exactly 43 transactions (including invoice payment and next installments)
    const sep = byMonth.get('2026-09');
    expect(sep).toBeDefined();
    expect(sep!.trans.length).toBe(43);

    // No duplicate installments exist in any month
    const installmentNotes = new Map<string, number>();
    for (const t of dbTransAfter2) {
      if (t.notes && /^\[\d+\/\d+\]/.test(t.notes)) {
        const cdStr = t.charge_date ? String(t.charge_date) : String(t.date);
        const m = `${cdStr.slice(0, 4)}-${cdStr.slice(4, 6)}`;
        const key = `${m}_${t.amount}_${t.notes}`;
        installmentNotes.set(key, (installmentNotes.get(key) || 0) + 1);
      }
    }
    const duplicateInstallments = Array.from(installmentNotes.entries()).filter(
      ([_, count]) => count > 1,
    );
    expect(duplicateInstallments).toEqual([]);

    // Step 3: Test Category Synchronization Across Installments
    const { batchUpdateTransactions } = await import('#server/transactions');
    await db.insertCategory({
      id: 'cat-clothing',
      name: 'Clothing',
      cat_group: 'group-1',
    });
    await db.insertCategory({
      id: 'cat-fashion',
      name: 'Fashion',
      cat_group: 'group-1',
    });

    // Find SHEIN installment 2
    const shein2 = dbTransAfter2.find(
      t => t.notes && t.notes.includes('[2/3] SHEIN'),
    );
    expect(shein2).toBeDefined();

    // Update category on installment 2
    await batchUpdateTransactions({
      updated: [{ id: shein2!.id, category: 'cat-clothing' }],
    });

    // Verify that ALL installments of this SHEIN purchase now have category 'cat-clothing'
    const sheinTxs = await db.all<DbRow>(
      `SELECT id, date, charge_date, amount, notes, category, imported_id
       FROM v_transactions
       WHERE notes LIKE '%SHEIN *SHEIN Vila OlimpiaBR%' AND amount = ?`,
      [shein2!.amount],
    );
    expect(sheinTxs.length).toBe(2);
    for (const tx of sheinTxs) {
      expect(tx.category).toBe('cat-clothing');
    }

    // Now update category from installment 3 to 'cat-fashion'
    const shein3 = sheinTxs.find(
      t => t.notes && t.notes.includes('[3/3] SHEIN'),
    );
    expect(shein3).toBeDefined();
    await batchUpdateTransactions({
      updated: [{ id: shein3!.id, category: 'cat-fashion' }],
    });

    const sheinTxsAfter = await db.all<DbRow>(
      `SELECT id, category FROM v_transactions
       WHERE notes LIKE '%SHEIN *SHEIN Vila OlimpiaBR%' AND amount = ?`,
      [shein2!.amount],
    );
    for (const tx of sheinTxsAfter) {
      expect(tx.category).toBe('cat-fashion');
    }

    // Test manual note-tagged installments (without imported_id)
    await db.insertTransaction({
      id: 'manual-inst-1',
      account: 'cc-acct',
      date: '2026-08-01',
      charge_date: '2026-08-11',
      amount: -10000,
      notes: '[1/3] Curso Online',
    });
    await db.insertTransaction({
      id: 'manual-inst-2',
      account: 'cc-acct',
      date: '2026-08-01',
      charge_date: '2026-09-11',
      amount: -10000,
      notes: '[2/3] Curso Online',
    });
    await db.insertTransaction({
      id: 'manual-inst-3',
      account: 'cc-acct',
      date: '2026-08-01',
      charge_date: '2026-10-11',
      amount: -10000,
      notes: '[3/3] Curso Online',
    });

    await batchUpdateTransactions({
      updated: [{ id: 'manual-inst-1', category: 'cat-fashion' }],
    });

    const manualTxs = await db.all<DbRow>(
      `SELECT id, category FROM v_transactions WHERE notes LIKE '%Curso Online%'`,
    );
    expect(manualTxs.length).toBe(3);
    for (const tx of manualTxs) {
      expect(tx.category).toBe('cat-fashion');
    }
  });
});
