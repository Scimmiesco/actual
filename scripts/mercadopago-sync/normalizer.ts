import type {
  MercadoPagoMovement,
  NormalizedTransaction,
  SyncConfig,
  YieldHandlingStrategy,
} from './types';

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

  // Partition transfers: moving money to a cofrinho/pot is an outflow from checking
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

export function amountToInteger(amount: number): number {
  return Math.round(amount * 100);
}

export function extractPayeeName(
  movement: MercadoPagoMovement,
  yieldPayeeName?: string,
): string {
  if (isYieldMovement(movement)) {
    return yieldPayeeName || 'Mercado Pago - Rendimento CDI';
  }

  // Handle cofrinho/pot transfers with custom name
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

export function normalizeMovement(
  movement: MercadoPagoMovement,
  accountId: string,
  yieldPayeeName?: string,
): NormalizedTransaction {
  // Normalize date to YYYY-MM-DD
  const rawDate =
    movement.date_created || movement.date_approved || new Date().toISOString();
  const dateStr = rawDate.split('T')[0];

  // In Actual Budget:
  // Income (inflow) is positive
  // Expense (outflow) is negative
  const rawNum = movement.amount ?? movement.transaction_amount ?? 0;
  const rawAbsoluteAmount = Math.abs(rawNum);
  const isDebit = isDebitMovement(movement);
  const finalAmount = isDebit ? -rawAbsoluteAmount : rawAbsoluteAmount;

  return {
    account: accountId,
    date: dateStr,
    amount: amountToInteger(finalAmount),
    payee_name: extractPayeeName(movement, yieldPayeeName),
    notes: extractNotes(movement),
    imported_id: `mp_${movement.id}`,
    cleared: true,
  };
}

export function normalizeMovements(
  movements: MercadoPagoMovement[],
  config: Pick<
    SyncConfig,
    'actualAccountId' | 'yieldHandling' | 'yieldPayeeName'
  >,
): NormalizedTransaction[] {
  const yieldStrategy: YieldHandlingStrategy = config.yieldHandling || 'ignore';
  const yieldPayeeName =
    config.yieldPayeeName || 'Mercado Pago - Rendimento CDI';
  const accountId = config.actualAccountId;

  const standardTransactions: NormalizedTransaction[] = [];
  const dailyYields = new Map<
    string,
    { totalAmount: number; movementIds: (string | number)[] }
  >();

  for (const movement of movements) {
    const isYield = isYieldMovement(movement);

    if (isYield) {
      if (yieldStrategy === 'ignore') {
        continue;
      }

      if (yieldStrategy === 'group_daily') {
        const rawDate =
          movement.date_created ||
          movement.date_approved ||
          new Date().toISOString();
        const dateStr = rawDate.split('T')[0];
        const current = dailyYields.get(dateStr) || {
          totalAmount: 0,
          movementIds: [],
        };
        const rawNum = movement.amount ?? movement.transaction_amount ?? 0;
        current.totalAmount += Math.abs(rawNum);
        current.movementIds.push(movement.id);
        dailyYields.set(dateStr, current);
        continue;
      }
    }

    standardTransactions.push(
      normalizeMovement(movement, accountId, yieldPayeeName),
    );
  }

  // If grouped daily yields are enabled, create one consolidated transaction per day
  if (yieldStrategy === 'group_daily') {
    for (const [dateStr, yieldData] of dailyYields.entries()) {
      if (yieldData.totalAmount <= 0) continue;

      standardTransactions.push({
        account: accountId,
        date: dateStr,
        amount: amountToInteger(yieldData.totalAmount),
        payee_name: yieldPayeeName,
        notes: `Rendimento consolidado do dia (${yieldData.movementIds.length} lançamentos)`,
        imported_id: `mp_yield_grouped_${dateStr}`,
        cleared: true,
      });
    }
  }

  // Sort by date ascending
  return standardTransactions.sort((a, b) => a.date.localeCompare(b.date));
}
