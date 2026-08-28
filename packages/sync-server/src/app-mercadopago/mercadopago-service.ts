import { SecretName, secretsService } from '#services/secrets-service';

import type {
  MercadoPagoAccount,
  MercadoPagoMovement,
  MercadoPagoMovementsResponse,
  MercadoPagoUser,
} from './types';

const MP_API_BASE_URL = 'https://api.mercadopago.com';

function hasCredentials(fileId: string | null = null): boolean {
  return !!secretsService.get(SecretName.mercadopago_accessToken, fileId);
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
    credentialFileId,
  );

  if (!token) {
    throw new Error('Mercado Pago access token is not configured');
  }

  return token;
}

function getStoredUserId(fileId: string | null = null): string | null {
  const source = getCredentialSource(fileId);
  const credentialFileId = source === 'per-budget-file' ? fileId : null;
  return secretsService.get(SecretName.mercadopago_userId, credentialFileId);
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

export function isDebitMovement(movement: MercadoPagoMovement): boolean {
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

  validateAccessToken: async (accessToken: string): Promise<MercadoPagoUser> => {
    const response = await fetch(`${MP_API_BASE_URL}/users/me`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Falha ao autenticar com o Mercado Pago (${response.status}): ${errorText}`,
      );
    }

    const userData = (await response.json()) as MercadoPagoUser;
    return userData;
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

    return [
      {
        account_id: 'mp_account_checking',
        name: `${userName} - Saldo Principal`,
        type: 'checking',
        currency: 'BRL',
      },
      {
        account_id: 'mp_account_credit',
        name: `${userName} - Cartão de Crédito`,
        type: 'credit',
        currency: 'BRL',
      },
      {
        account_id: 'mp_account_savings',
        name: `${userName} - Reservas e Cofrinhos`,
        type: 'savings',
        currency: 'BRL',
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

    do {
      const paymentParams = new URLSearchParams();
      paymentParams.append('limit', String(limit));
      paymentParams.append('offset', String(offset));
      paymentParams.append('status', 'approved');
      paymentParams.append('sort', 'date_created');
      paymentParams.append('criteria', 'desc');

      if (beginDate) paymentParams.append('begin_date', beginDate);
      if (endDate) paymentParams.append('end_date', endDate);

      const response = await fetch(
        `${MP_API_BASE_URL}/v1/payments/search?${paymentParams.toString()}`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Erro ao consultar pagamentos no Mercado Pago (${response.status}): ${errorText}`,
        );
      }

      const data = (await response.json()) as MercadoPagoMovementsResponse;
      total = data.paging?.total || 0;

      if (data.results && data.results.length > 0) {
        allMovements.push(...data.results);
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

    for (const mov of filteredMovements) {
      const rawNum = mov.amount ?? mov.transaction_amount ?? 0;
      const rawAbsoluteAmount = Math.abs(rawNum);
      const isDebit = isDebitMovement(mov);
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

    return {
      transactions: {
        all,
        booked,
        pending,
      },
      balances: [
        {
          balanceAmount: {
            amount: '0.00',
            currency: 'BRL',
          },
          balanceType: 'expected',
          referenceDate: new Date().toISOString().split('T')[0],
        },
      ],
      startingBalance: 0,
    };
  },
};

