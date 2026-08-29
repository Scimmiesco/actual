export type MercadoPagoAccount = {
  account_id: string;
  name: string;
  type?: 'checking' | 'credit' | 'savings';
  currency?: string;
  balance?: number;
};

export type SyncServerMercadoPagoAccount = {
  account_id: string;
  name: string;
  balance: number;
  institution?: string;
  orgDomain?: string | null;
  orgId?: string;
  type?: 'checking' | 'credit' | 'savings';
  currency?: string;
};
