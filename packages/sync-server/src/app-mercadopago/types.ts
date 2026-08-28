export type MercadoPagoUser = {
  id: number | string;
  nickname?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  site_id?: string;
};

export type MercadoPagoAccount = {
  account_id: string;
  name: string;
  type: 'checking' | 'credit' | 'savings';
  currency: string;
  balance?: number;
};

export type MercadoPagoMovement = {
  id: string | number;
  date_created: string;
  date_released?: string;
  date_approved?: string;
  type?: string;
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

