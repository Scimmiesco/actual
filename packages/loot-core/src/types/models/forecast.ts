export type ForecastSource = 'schedules' | 'tracking-budget';

export type ForecastDataPoint = {
  date: string;
  balance: number;
  accountId: string;
  accountName: string;
  transactions: ForecastTransaction[];
};

export type ForecastTransaction = {
  amount: number;
  payee: string | null;
  /** Category selected by the same rule engine used when posting the schedule. */
  category?: string | null;
  scheduleId?: string | null;
  scheduleName?: string | null;
};

export type BalanceForecastConfig = {
  id: string;
  name: string;
  forecastMonths: number;
  selectedAccounts: string[];
  showCombined: boolean;
  showIndividual: boolean;
  source?: ForecastSource;
  tombstone?: boolean;
};

export type ForecastResult = {
  dataPoints: ForecastDataPoint[];
  lowestBalance: {
    date: string;
    balance: number;
    accountId: string;
    accountName: string;
  };
  forecastStartDate: string;
  forecastEndDate: string;
};
