import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MercadoPagoClient } from './client';
import {
  amountToInteger,
  extractNotes,
  extractPayeeName,
  isDebitMovement,
  isYieldMovement,
  normalizeMovement,
  normalizeMovements,
} from './normalizer';
import type { MercadoPagoMovement } from './types';

describe('Mercado Pago Normalizer', () => {
  const samplePixIn: MercadoPagoMovement = {
    id: 'mov_1001',
    date_created: '2026-08-25T10:15:00.000Z',
    type: 'pix_transfer_in',
    status: 'approved',
    detail: 'Transferência recebida via PIX',
    financial_entity: 'Maria Silva',
    amount: 150.75,
    reference_id: 'PIX-REQ-987123',
  };

  const sampleBillPayment: MercadoPagoMovement = {
    id: 'mov_1002',
    date_created: '2026-08-25T14:30:00.000Z',
    type: 'bill_payment',
    status: 'approved',
    detail: 'Pagamento de conta de luz',
    description: 'Enel Distribuição SP',
    financial_entity: 'Enel SP',
    amount: 124.5,
    reference_id: 'BOL-882319',
  };

  const sampleYield1: MercadoPagoMovement = {
    id: 'mov_1003',
    date_created: '2026-08-26T08:00:00.000Z',
    type: 'yield',
    status: 'approved',
    detail: 'Rendimento de saldo 100% CDI',
    amount: 0.35,
    reference_id: 'YIELD-20260826',
  };

  const sampleYield2: MercadoPagoMovement = {
    id: 'mov_1004',
    date_created: '2026-08-26T12:00:00.000Z',
    type: 'investment_yield',
    status: 'approved',
    detail: 'Rendimento Reserva CDI',
    amount: 0.65,
    reference_id: 'YIELD-RES-20260826',
  };

  it('correctly converts decimal amounts to integer cents', () => {
    expect(amountToInteger(150.75)).toBe(15075);
    expect(amountToInteger(0.35)).toBe(35);
    expect(amountToInteger(-124.5)).toBe(-12450);
  });

  it('correctly identifies yield movements', () => {
    expect(isYieldMovement(sampleYield1)).toBe(true);
    expect(isYieldMovement(sampleYield2)).toBe(true);
    expect(isYieldMovement(samplePixIn)).toBe(false);
    expect(isYieldMovement(sampleBillPayment)).toBe(false);
  });

  it('correctly identifies debit vs credit movements', () => {
    expect(isDebitMovement(sampleBillPayment)).toBe(true);
    expect(isDebitMovement(samplePixIn)).toBe(false);
    expect(isDebitMovement({ ...samplePixIn, type: 'pix_transfer_out' })).toBe(
      true,
    );
    expect(isDebitMovement({ ...samplePixIn, type: 'card_payment' })).toBe(
      true,
    );
    expect(isDebitMovement({ ...samplePixIn, type: 'atm_withdrawal' })).toBe(
      true,
    );
    expect(
      isDebitMovement({ ...samplePixIn, type: 'custom', amount: -50 }),
    ).toBe(true);
  });

  it('extracts payee names with fallback hierarchy', () => {
    expect(extractPayeeName(samplePixIn)).toBe('Maria Silva');
    expect(extractPayeeName(sampleBillPayment)).toBe('Enel SP');
    expect(extractPayeeName(sampleYield1)).toBe(
      'Mercado Pago - Rendimento CDI',
    );
  });

  it('extracts formatted notes from movement attributes', () => {
    const notes = extractNotes(sampleBillPayment);
    expect(notes).toContain('Ref: BOL-882319');
    expect(notes).toContain('Tipo: bill_payment');
  });

  it('normalizes single movement into Actual transaction format', () => {
    const normalized = normalizeMovement(samplePixIn, 'acc_checking_123');

    expect(normalized).toEqual({
      account: 'acc_checking_123',
      date: '2026-08-25',
      amount: 15075,
      payee_name: 'Maria Silva',
      notes: expect.stringContaining('PIX-REQ-987123'),
      imported_id: 'mp_mov_1001',
      cleared: true,
    });
  });

  it('normalizes bill payment as negative amount (outflow)', () => {
    const normalized = normalizeMovement(sampleBillPayment, 'acc_checking_123');
    expect(normalized.amount).toBe(-12450);
  });

  it('ignores yield movements when yieldHandling is set to ignore', () => {
    const movements = [
      samplePixIn,
      sampleYield1,
      sampleYield2,
      sampleBillPayment,
    ];
    const result = normalizeMovements(movements, {
      actualAccountId: 'acc_1',
      yieldHandling: 'ignore',
    });

    expect(result).toHaveLength(2);
    expect(result.find(t => t.imported_id === 'mp_mov_1003')).toBeUndefined();
  });

  it('imports yield movements when yieldHandling is set to import', () => {
    const movements = [samplePixIn, sampleYield1, sampleBillPayment];
    const result = normalizeMovements(movements, {
      actualAccountId: 'acc_1',
      yieldHandling: 'import',
    });

    expect(result).toHaveLength(3);
    const yieldTx = result.find(t => t.imported_id === 'mp_mov_1003');
    expect(yieldTx).toBeDefined();
    expect(yieldTx?.amount).toBe(35);
    expect(yieldTx?.payee_name).toBe('Mercado Pago - Rendimento CDI');
  });

  it('consolidates daily yield movements when yieldHandling is group_daily', () => {
    const movements = [
      samplePixIn,
      sampleYield1,
      sampleYield2,
      sampleBillPayment,
    ];
    const result = normalizeMovements(movements, {
      actualAccountId: 'acc_1',
      yieldHandling: 'group_daily',
    });

    // 2 regular txs + 1 consolidated yield on 2026-08-26 (0.35 + 0.65 = 1.00 -> 100 cents)
    expect(result).toHaveLength(3);
    const groupedYield = result.find(
      t => t.imported_id === 'mp_yield_grouped_2026-08-26',
    );
    expect(groupedYield).toBeDefined();
    expect(groupedYield?.amount).toBe(100);
    expect(groupedYield?.notes).toContain(
      'Rendimento consolidado do dia (2 lançamentos)',
    );
  });
});

describe('Mercado Pago Client', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('builds proper query parameters and headers', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        paging: { total: 1, limit: 10, offset: 0 },
        results: [
          {
            id: '123',
            date_created: '2026-08-20T00:00:00Z',
            type: 'pix_transfer_in',
            amount: 100,
          },
        ],
      }),
    });
    global.fetch = fetchMock;

    const client = new MercadoPagoClient('TEST_TOKEN');
    const res = await client.searchMovements({
      beginDate: '2026-08-01T00:00:00Z',
      endDate: '2026-08-20T00:00:00Z',
      limit: 10,
      offset: 0,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [callUrl, callOptions] = fetchMock.mock.calls[0];

    expect(callUrl).toContain('/v1/account/movements/search');
    expect(callUrl).toContain('begin_date=2026-08-01T00%3A00%3A00Z');
    expect(callUrl).toContain('end_date=2026-08-20T00%3A00%3A00Z');
    expect(callUrl).toContain('limit=10');
    expect(callUrl).toContain('range=date_created');
    expect(callOptions.headers.Authorization).toBe('Bearer TEST_TOKEN');
    expect(res.results).toHaveLength(1);
  });

  it('handles pagination across multiple pages in fetchAllMovements', async () => {
    const page1 = {
      paging: { total: 3, limit: 2, offset: 0 },
      results: [
        {
          id: '1',
          date_created: '2026-08-01T00:00:00Z',
          type: 'a',
          amount: 10,
        },
        {
          id: '2',
          date_created: '2026-08-02T00:00:00Z',
          type: 'b',
          amount: 20,
        },
      ],
    };

    const page2 = {
      paging: { total: 3, limit: 2, offset: 2 },
      results: [
        {
          id: '3',
          date_created: '2026-08-03T00:00:00Z',
          type: 'c',
          amount: 30,
        },
      ],
    };

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => page1 })
      .mockResolvedValueOnce({ ok: true, json: async () => page2 });
    global.fetch = fetchMock;

    const client = new MercadoPagoClient('TEST_TOKEN');
    const all = await client.fetchAllMovements({ batchSize: 2 });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(all).toHaveLength(3);
    expect(all.map(m => m.id)).toEqual(['1', '2', '3']);
  });

  it('throws informative error on API failure', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      text: async () => 'Invalid access token',
    });
    global.fetch = fetchMock;

    const client = new MercadoPagoClient('INVALID_TOKEN');
    await expect(client.searchMovements()).rejects.toThrow(
      'Mercado Pago API error (401 Unauthorized): Invalid access token',
    );
  });
});
