import express from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SecretName, secretsService } from '#services/secrets-service';

vi.mock('#util/middlewares', () => ({
  requestLoggerMiddleware: (_req: unknown, _res: unknown, next: () => void) =>
    next(),
  validateSessionMiddleware: (
    _req: unknown,
    res: { locals: { user_id: string } },
    next: () => void,
  ) => {
    res.locals = { user_id: 'test-user-id' };
    next();
  },
}));

const { handlers } = await import('./app-mercadopago');

const app = express();
app.use('/', handlers);

const MOCK_USER_ME = {
  id: 283066001,
  nickname: 'TEST_USER_BR',
  first_name: 'Maria',
  last_name: 'Silva',
  email: 'maria.silva@example.com',
};

const MOCK_PAYMENTS_PAGE = {
  paging: {
    total: 3,
    limit: 50,
    offset: 0,
  },
  results: [
    {
      id: 101,
      date_created: '2026-08-25T10:00:00.000-03:00',
      operation_type: 'regular_payment',
      payment_method_id: 'account_money',
      payment_type_id: 'account_money',
      status: 'approved',
      description: 'Supermercado Central',
      financial_entity: 'Supermercado Central LTDA',
      transaction_amount: 150.75,
    },
    {
      id: 102,
      date_created: '2026-08-26T14:30:00.000-03:00',
      operation_type: 'regular_payment',
      payment_method_id: 'visa',
      payment_type_id: 'credit_card',
      status: 'approved',
      description: 'Compra no Cartão - Loja XYZ',
      transaction_amount: 89.9,
    },
    {
      id: 103,
      date_created: '2026-08-27T08:00:00.000-03:00',
      operation_type: 'partition_transfer',
      payment_method_id: 'account_money',
      status: 'approved',
      point_of_interaction: {
        business_info: {
          branch: 'AM-to-POT - Partition Transfer',
        },
      },
      amounts: {
        collector: {
          transaction_destination: {
            subpartition: {
              name: 'Reserva Emergência',
            },
          },
        },
      },
      transaction_amount: 50.0,
    },
  ],
};

const post = (path: string) =>
  request(app).post(path).set('x-actual-token', 'valid-session-token');

describe('app-mercadopago', () => {
  beforeEach(() => {
    secretsService.set(SecretName.mercadopago_accessToken, null);
    secretsService.set(SecretName.mercadopago_userId, null);
    vi.spyOn(console, 'log').mockImplementation(vi.fn());
    vi.spyOn(console, 'error').mockImplementation(vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('POST /status', () => {
    it('reports not configured when no token is present', async () => {
      const res = await post('/status');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(res.body.data.configured).toBe(false);
      expect(res.body.data.source).toBeNull();
    });

    it('reports configured when global token is present', async () => {
      secretsService.set(
        SecretName.mercadopago_accessToken,
        'APP_USR-test-token',
      );

      const res = await post('/status');

      expect(res.status).toBe(200);
      expect(res.body.data.configured).toBe(true);
      expect(res.body.data.source).toBe('global');
    });
  });

  describe('POST /config', () => {
    it('returns error when accessToken is missing', async () => {
      const res = await post('/config').send({});

      expect(res.status).toBe(400);
      expect(res.body.status).toBe('error');
      expect(res.body.reason).toBe('invalid-access-token');
    });

    it('validates token with Mercado Pago API and saves credentials', async () => {
      global.fetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes('/users/me')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve(MOCK_USER_ME),
          });
        }
        return Promise.resolve({ ok: false, status: 404 });
      });

      const res = await post('/config').send({
        accessToken: 'APP_USR-valid-token-123',
      });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(res.body.data.user.id).toBe(283066001);
      expect(res.body.data.user.first_name).toBe('Maria');

      // Verify secrets were persisted
      expect(secretsService.get(SecretName.mercadopago_accessToken)).toBe(
        'APP_USR-valid-token-123',
      );
      expect(secretsService.get(SecretName.mercadopago_userId)).toBe(
        '283066001',
      );
    });

    it('returns error when Mercado Pago rejects the token', async () => {
      global.fetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes('/users/me')) {
          return Promise.resolve({
            ok: false,
            status: 401,
            text: () => Promise.resolve('Unauthorized'),
          });
        }
        return Promise.resolve({ ok: false, status: 404 });
      });

      const res = await post('/config').send({
        accessToken: 'invalid-token',
      });

      expect(res.status).toBe(400);
      expect(res.body.status).toBe('error');
      expect(res.body.reason).toBe('authentication-failed');
    });
  });

  describe('POST /accounts', () => {
    it('returns not-configured error when token is absent', async () => {
      const res = await post('/accounts');

      expect(res.status).toBe(400);
      expect(res.body.reason).toBe('not-configured');
    });

    it('returns virtual Mercado Pago accounts when configured', async () => {
      secretsService.set(
        SecretName.mercadopago_accessToken,
        'APP_USR-valid-token',
      );

      global.fetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes('/users/me')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve(MOCK_USER_ME),
          });
        }
        return Promise.resolve({ ok: false, status: 404 });
      });

      const res = await post('/accounts');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(res.body.data.accounts).toHaveLength(3);
      expect(res.body.data.accounts[0]).toMatchObject({
        account_id: 'mp_account_checking',
        name: 'Maria Silva - Saldo Principal',
        type: 'checking',
        currency: 'BRL',
      });
      expect(res.body.data.accounts[1]).toMatchObject({
        account_id: 'mp_account_credit',
        name: 'Maria Silva - Cartão de Crédito',
        type: 'credit',
        currency: 'BRL',
      });
    });
  });

  describe('POST /transactions', () => {
    it('returns normalized transactions in BankSyncResponse format', async () => {
      secretsService.set(
        SecretName.mercadopago_accessToken,
        'APP_USR-valid-token',
      );

      global.fetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes('/v1/payments/search')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve(MOCK_PAYMENTS_PAGE),
          });
        }
        return Promise.resolve({ ok: false, status: 404 });
      });

      const res = await post('/transactions').send({
        startDate: '2026-08-01',
      });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(res.body.data.transactions).toBeDefined();

      const { all, booked } = res.body.data.transactions;
      expect(all).toHaveLength(3);
      expect(booked).toHaveLength(3);

      // Check first transaction (Checking debit)
      expect(all[0]).toMatchObject({
        transactionId: 'mp_101',
        bookingDate: '2026-08-25',
        transactionAmount: {
          amount: '-150.75',
          currency: 'BRL',
        },
        debtorName: 'Supermercado Central LTDA',
        booked: true,
      });

      // Check third transaction (Pot transfer)
      expect(all[2]).toMatchObject({
        transactionId: 'mp_103',
        bookingDate: '2026-08-27',
        transactionAmount: {
          amount: '-50.00',
          currency: 'BRL',
        },
        debtorName: 'Reserva: Reserva Emergência',
        booked: true,
      });
    });

    it('filters transactions when accountId is mp_account_credit', async () => {
      secretsService.set(
        SecretName.mercadopago_accessToken,
        'APP_USR-valid-token',
      );

      global.fetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes('/v1/payments/search')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve(MOCK_PAYMENTS_PAGE),
          });
        }
        return Promise.resolve({ ok: false, status: 404 });
      });

      const res = await post('/transactions').send({
        accountId: 'mp_account_credit',
        startDate: '2026-08-01',
      });

      expect(res.status).toBe(200);
      const { all } = res.body.data.transactions;
      expect(all).toHaveLength(1);
      expect(all[0].transactionId).toBe('mp_102');
    });
  });
});

