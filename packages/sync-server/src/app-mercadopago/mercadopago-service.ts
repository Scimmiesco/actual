import { MercadoPagoConfig, Payment, User } from 'mercadopago';

import { SecretName, secretsService } from '#services/secrets-service';

import type {
  MercadoPagoAccount,
  MercadoPagoMovement,
  MercadoPagoMovementsResponse,
  MercadoPagoUser,
} from './types';

const MP_API_BASE_URL = 'https://api.mercadopago.com';

function getMpClient(accessToken: string) {
  const config = new MercadoPagoConfig({ accessToken });
  return {
    config,
    userClient: new User(config),
    paymentClient: new Payment(config),
  };
}

function hasCredentials(fileId: string | null = null): boolean {
  return !!secretsService.get(
    SecretName.mercadopago_accessToken,
    fileId ?? undefined,
  );
}

function getCredentialSource(
  fileId: string | null = null,
): 'per-budget-file' | 'global' | null {
  if (fileId && hasCredentials(fileId)) {
    return 'per-budget-file';
  }

  if (hasCredentials(null)) {
    return 'global';
  }

  return null;
}

function getAccessToken(fileId: string | null = null): string {
  const source = getCredentialSource(fileId);
  if (!source) {
    throw new Error('Mercado Pago access token is not configured');
  }

  const credentialFileId = source === 'per-budget-file' ? fileId : null;
  const token = secretsService.get(
    SecretName.mercadopago_accessToken,
    credentialFileId ?? undefined,
  );

  if (!token) {
    throw new Error('Mercado Pago access token is not configured');
  }

  return token;
}

function getStoredUserId(fileId: string | null = null): string | null {
  const source = getCredentialSource(fileId);
  const credentialFileId = source === 'per-budget-file' ? fileId : null;
  return secretsService.get(
    SecretName.mercadopago_userId,
    credentialFileId ?? undefined,
  );
}

export function isYieldMovement(movement: MercadoPagoMovement): boolean {
  const type = (movement.type || movement.operation_type || '').toLowerCase();
  const desc = (movement.description || '').toLowerCase();
  const detail = (movement.detail || '').toLowerCase();

  return (
    type === 'yield' ||
    type === 'investment_yield' ||
    desc.includes('rendimento') ||
    desc.includes('cdi') ||
    detail.includes('rendimento') ||
    detail.includes('cdi')
  );
}

export function isDebitMovement(
  movement: MercadoPagoMovement,
  userId?: string | number | null,
): boolean {
  const type = (movement.type || movement.operation_type || '').toLowerCase();
  const branch = (
    movement.point_of_interaction?.business_info?.branch || ''
  ).toLowerCase();

  if (type === 'partition_transfer') {
    if (branch.includes('am-to-pot')) {
      return true;
    }
    if (branch.includes('pot-to-am')) {
      return false;
    }
    return true;
  }

  // Se o usuário é explicitamente o recebedor (collector) da transação, é uma ENTRADA (crédito).
  // Exceção: se for categorizado como 'fee' (tarifa cobrada do usuário).
  if (
    userId &&
    movement.collector_id &&
    String(movement.collector_id) === String(userId)
  ) {
    if (type === 'fee') {
      return true;
    }
    return false;
  }

  // Se o usuário é explicitamente o pagador, é um DÉBITO.
  if (
    userId &&
    movement.payer?.id &&
    String(movement.payer.id) === String(userId)
  ) {
    return true;
  }

  const debitTypes = [
    'pix_transfer_out',
    'bill_payment',
    'card_payment',
    'fee',
    'ted_transfer_out',
    'doc_transfer_out',
    'atm_withdrawal',
    'pos_payment',
    'qr_code_payment',
    'account_debit',
    'regular_payment',
    'recurring_payment',
    'cellphone_recharge',
    'money_transfer',
  ];

  if (debitTypes.includes(type)) {
    return true;
  }

  const rawAmount = movement.amount ?? movement.transaction_amount ?? 0;
  return rawAmount < 0;
}

export function extractPayeeName(movement: MercadoPagoMovement): string {
  if (isYieldMovement(movement)) {
    return 'Mercado Pago - Rendimento CDI';
  }

  const potName =
    movement.amounts?.collector?.transaction_destination?.subpartition?.name;
  if (potName && potName.trim().length > 0) {
    return `Reserva: ${potName.trim()}`;
  }

  if (
    movement.financial_entity &&
    movement.financial_entity.trim().length > 0
  ) {
    return movement.financial_entity.trim();
  }

  if (movement.description && movement.description.trim().length > 0) {
    return movement.description.trim();
  }

  if (movement.detail && movement.detail.trim().length > 0) {
    return movement.detail.trim();
  }

  if (movement.payer?.first_name || movement.payer?.last_name) {
    return `${movement.payer.first_name || ''} ${movement.payer.last_name || ''}`.trim();
  }

  if (movement.payer?.email) {
    return movement.payer.email;
  }

  const typeLabels: Record<string, string> = {
    pix_transfer_in: 'Transferência PIX Recebida',
    pix_transfer_out: 'Transferência PIX Enviada',
    bill_payment: 'Pagamento de Boleto',
    card_payment: 'Compra no Cartão',
    ted_transfer_in: 'Transferência TED Recebida',
    ted_transfer_out: 'Transferência TED Enviada',
    fee: 'Tarifa Mercado Pago',
    atm_withdrawal: 'Saque Banco24Horas',
    regular_payment: 'Pagamento Mercado Pago',
    recurring_payment: 'Assinatura Recorrente',
    money_transfer: 'Transferência PIX',
    cellphone_recharge: 'Recarga de Celular',
    partition_transfer: 'Transferência para Reserva',
  };

  const key = movement.type || movement.operation_type || 'transaction';
  return typeLabels[key] || `Mercado Pago (${key})`;
}

export function extractNotes(movement: MercadoPagoMovement): string {
  const parts: string[] = [];

  if (movement.reference_id) {
    parts.push(`Ref: ${movement.reference_id}`);
  }

  if (movement.type || movement.operation_type) {
    parts.push(`Tipo: ${movement.type || movement.operation_type}`);
  }

  if (movement.payment_method_id) {
    parts.push(`Método: ${movement.payment_method_id}`);
  }

  if (movement.status && movement.status !== 'approved') {
    parts.push(`Status: ${movement.status}`);
  }

  if (movement.description && movement.financial_entity) {
    parts.push(`Detalhes: ${movement.description}`);
  }

  return parts.join(' | ');
}

export const mercadopagoService = {
  isConfigured: (fileId: string | null = null) =>
    getCredentialSource(fileId) != null,

  getCredentialSource,

  getStoredUserId,

  validateAccessToken: async (
    accessToken: string,
  ): Promise<MercadoPagoUser> => {
    const { userClient } = getMpClient(accessToken);
    const userData = await userClient.get();
    return userData as unknown as MercadoPagoUser;
  },

  saveCredentials: async ({
    accessToken,
    fileId = null,
  }: {
    accessToken: string;
    fileId?: string | null;
  }) => {
    const user = await mercadopagoService.validateAccessToken(accessToken);

    secretsService.set(
      SecretName.mercadopago_accessToken,
      accessToken,
      fileId ?? undefined,
    );
    if (user.id) {
      secretsService.set(
        SecretName.mercadopago_userId,
        String(user.id),
        fileId ?? undefined,
      );
    }

    return {
      user,
      fileId,
    };
  },

  fetchBalance: async (
    userId?: string | number | null,
    fileId: string | null = null,
  ): Promise<{
    total_amount: number;
    available_amount: number;
    unavailable_amount: number;
  }> => {
    const token = getAccessToken(fileId);
    let uid = userId;
    if (!uid) {
      uid = getStoredUserId(fileId);
    }
    if (!uid) {
      try {
        const user = await mercadopagoService.validateAccessToken(token);
        uid = user.id;
      } catch {
        // ignore
      }
    }

    const endpoints = [
      ...(uid
        ? [
            `${MP_API_BASE_URL}/users/${uid}/mercadopago_account/balance`,
            `${MP_API_BASE_URL}/users/${uid}/balance`,
          ]
        : []),
      `${MP_API_BASE_URL}/users/me/mercadopago_account/balance`,
      `${MP_API_BASE_URL}/users/me/balance`,
      `${MP_API_BASE_URL}/account/balance`,
      `${MP_API_BASE_URL}/v1/account/balance`,
    ];

    for (const endpoint of endpoints) {
      try {
        const response = await fetch(endpoint, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          const data = (await response.json()) as Record<string, unknown>;
          console.log(
            `[MercadoPago] Balance response from ${endpoint}:`,
            JSON.stringify(data),
          );

          const total = Number(
            data.total_amount ??
              data.total ??
              data.available_amount ??
              data.available_balance ??
              data.balance ??
              data.amount ??
              0,
          );
          const available = Number(
            data.available_amount ??
              data.available_balance ??
              data.total_amount ??
              data.balance ??
              0,
          );
          const unavailable = Number(
            data.unavailable_amount ?? data.unavailable_balance ?? 0,
          );

          return {
            total_amount: total,
            available_amount: available,
            unavailable_amount: unavailable,
          };
        } else {
          console.log(
            `[MercadoPago] Balance check at ${endpoint} returned status ${response.status}`,
          );
        }
      } catch (e) {
        console.log(`[MercadoPago] Balance check at ${endpoint} failed:`, e);
      }
    }

    return { total_amount: 0, available_amount: 0, unavailable_amount: 0 };
  },

  getAccounts: async (
    fileId: string | null = null,
  ): Promise<MercadoPagoAccount[]> => {
    const token = getAccessToken(fileId);
    // Validate token
    const user = await mercadopagoService.validateAccessToken(token);

    const userName =
      user.first_name && user.last_name
        ? `${user.first_name} ${user.last_name}`
        : user.nickname || 'Mercado Pago';

    let checkingBalance = 0;
    try {
      const balanceData = await mercadopagoService.fetchBalance(
        user.id,
        fileId,
      );
      checkingBalance = Math.round(balanceData.total_amount * 100);
    } catch {
      // ignore
    }

    return [
      {
        account_id: 'mp_account_checking',
        name: `${userName} - Saldo Principal`,
        type: 'checking',
        currency: 'BRL',
        balance: checkingBalance,
      },
      {
        account_id: 'mp_account_credit',
        name: `${userName} - Cartão de Crédito`,
        type: 'credit',
        currency: 'BRL',
        balance: 0,
      },
      {
        account_id: 'mp_account_savings',
        name: `${userName} - Reservas e Cofrinhos`,
        type: 'savings',
        currency: 'BRL',
        balance: 0,
      },
    ];
  },

  fetchMovements: async ({
    beginDate,
    endDate,
    fileId = null,
  }: {
    beginDate?: string;
    endDate?: string;
    fileId?: string | null;
  }): Promise<MercadoPagoMovement[]> => {
    const token = getAccessToken(fileId);
    const allMovements: MercadoPagoMovement[] = [];
    const limit = 50;
    let offset = 0;
    let total = 0;
    const { paymentClient } = getMpClient(token);

    do {
      const searchResult = await paymentClient.search({
        options: {
          limit,
          offset,
          sort: 'date_created',
          criteria: 'desc',
          ...(beginDate ? { begin_date: beginDate } : {}),
          ...(endDate ? { end_date: endDate } : {}),
        },
      });

      total = searchResult.paging?.total || 0;

      if (searchResult.results && searchResult.results.length > 0) {
        allMovements.push(
          ...(searchResult.results as unknown as MercadoPagoMovement[]),
        );
      }

      offset += limit;
    } while (offset < total && offset < 500);

    return allMovements;
  },

  getTransactionsByAccountId: async ({
    accountId,
    startDate,
    endDate,
    fileId = null,
  }: {
    accountId?: string;
    startDate?: string;
    endDate?: string;
    fileId?: string | null;
  }) => {
    const beginDateIso = startDate
      ? new Date(startDate).toISOString()
      : undefined;
    const endDateIso = endDate ? new Date(endDate).toISOString() : undefined;

    const rawMovements = await mercadopagoService.fetchMovements({
      beginDate: beginDateIso,
      endDate: endDateIso,
      fileId,
    });

    // Filter movements by account category if specified
    const filteredMovements = rawMovements.filter(mov => {
      const isCreditPurchase =
        mov.payment_type_id === 'credit_card' ||
        mov.payment_method_id === 'visa' ||
        mov.payment_method_id === 'master';
      const isPotTransfer = mov.operation_type === 'partition_transfer';

      if (accountId === 'mp_account_credit') {
        return isCreditPurchase;
      }
      if (accountId === 'mp_account_savings') {
        return isPotTransfer;
      }
      if (accountId === 'mp_account_checking') {
        // Exclude credit card purchases from checking if mapped to separate credit account
        return !isCreditPurchase;
      }
      return true;
    });

    const booked = [];
    const pending = [];
    const all = [];

    const userId = getStoredUserId(fileId);

    for (const mov of filteredMovements) {
      const rawNum = mov.amount ?? mov.transaction_amount ?? 0;
      const rawAbsoluteAmount = Math.abs(rawNum);
      const isDebit = isDebitMovement(mov, userId);
      const finalAmount = isDebit ? -rawAbsoluteAmount : rawAbsoluteAmount;

      const dateStr = (
        mov.date_created ||
        mov.date_approved ||
        new Date().toISOString()
      ).split('T')[0];

      const payeeName = extractPayeeName(mov);
      const notes = extractNotes(mov);

      const isPending = mov.status === 'in_process' || mov.status === 'pending';

      const trans = {
        transactionId: `mp_${mov.id}`,
        bookingDate: dateStr,
        date: dateStr,
        transactionAmount: {
          amount: finalAmount.toFixed(2),
          currency: 'BRL',
        },
        creditorName: !isDebit ? payeeName : undefined,
        debtorName: isDebit ? payeeName : undefined,
        remittanceInformationUnstructured: notes,
        payeeName,
        notes,
        booked: !isPending,
      };

      all.push(trans);
      if (isPending) {
        pending.push(trans);
      } else {
        booked.push(trans);
      }
    }

    let liveBalance = 0;
    if (accountId === 'mp_account_checking' || !accountId) {
      try {
        const storedUid = getStoredUserId(fileId);
        const balanceData = await mercadopagoService.fetchBalance(
          storedUid,
          fileId,
        );
        liveBalance = Number(
          balanceData.total_amount ?? balanceData.available_amount ?? 0,
        );
      } catch {
        // ignore
      }
    }

    return {
      transactions: {
        all,
        booked,
        pending,
      },
      balances: [
        {
          balanceAmount: {
            amount: liveBalance.toFixed(2),
            currency: 'BRL',
          },
          balanceType: 'expected',
          referenceDate: new Date().toISOString().split('T')[0],
        },
      ],
      startingBalance: Math.round(liveBalance * 100),
    };
  },
};
