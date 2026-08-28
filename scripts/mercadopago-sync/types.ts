export type MercadoPagoMovementType =
  | 'pix_transfer_in'
  | 'pix_transfer_out'
  | 'bill_payment'
  | 'card_payment'
  | 'yield'
  | 'fee'
  | 'ted_transfer_in'
  | 'ted_transfer_out'
  | 'doc_transfer_in'
  | 'doc_transfer_out'
  | 'atm_withdrawal'
  | 'pos_payment'
  | 'qr_code_payment'
  | 'account_credit'
  | 'account_debit'
  | 'regular_payment'
  | 'money_transfer'
  | string;

export type MercadoPagoMovement = {
  id: string | number;
  date_created: string;
  date_released?: string;
  date_approved?: string;
  type?: MercadoPagoMovementType;
  operation_type?: string;
  payment_type_id?: string;
  payment_method_id?: string;
  status?: string;
  status_detail?: string;
  detail?: string;
  description?: string;
  amount?: number;
  transaction_amount?: number;
  financial_entity?: string;
  reference_id?: string | number;
  collector_id?: number | string;
  payer?: {
    id?: string | number;
    email?: string;
    first_name?: string;
    last_name?: string;
    identification?: {
      type?: string;
      number?: string;
    };
  };
  point_of_interaction?: {
    type?: string;
    business_info?: {
      unit?: string;
      sub_unit?: string;
      branch?: string;
    };
  };
  amounts?: {
    collector?: {
      transaction_destination?: {
        fund_partition?: string;
        subpartition?: {
          id?: string;
          name?: string;
        };
      };
    };
  };
};

export type MercadoPagoMovementsResponse = {
  paging: {
    total: number;
    limit: number;
    offset: number;
  };
  results: MercadoPagoMovement[];
};

export type MercadoPagoSearchOptions = {
  beginDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
  range?: string;
  sort?: string;
  criteria?: string;
};

export type YieldHandlingStrategy = 'ignore' | 'import' | 'group_daily';

export type SyncConfig = {
  mercadopagoAccessToken: string;
  actualServerUrl?: string;
  actualPassword?: string;
  actualSyncId?: string;
  actualAccountId: string;
  dataDir?: string;
  yieldHandling?: YieldHandlingStrategy;
  yieldPayeeName?: string;
  daysToSync?: number;
};

export type NormalizedTransaction = {
  account: string;
  date: string;
  amount: number; // in cents
  payee_name: string;
  notes: string;
  imported_id: string;
  cleared: boolean;
};
