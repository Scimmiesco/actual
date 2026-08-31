import { describe, expect, it } from 'vitest';

import type { TransactionEntity } from '#types/models';

import type { AccountWithComputedBalance } from './forecast-accounts';
import type { ForecastFilterInfo } from './forecast-filters';
import { projectForecastData } from './forecast-projection';
import type { ForecastDateContext } from './forecast-projection';
import type { ForecastScheduleOccurrence } from './forecast-schedules';

describe('forecast projection', () => {
  it('combines posted and scheduled deltas into running balances', () => {
    const accounts: AccountWithComputedBalance[] = [
      {
        id: 'acct-1',
        name: 'Checking',
        closed: 0,
        offbudget: 0,
        balance_current: 70,
      },
    ];
    const transactions: TransactionEntity[] = [
      {
        id: 'starting-balance',
        account: 'acct-1',
        amount: 100,
        date: '2024-03-01',
      },
      {
        id: 'posted-spend',
        account: 'acct-1',
        amount: -40,
        date: '2024-03-03',
      },
    ];
    const futureOccurrences: ForecastScheduleOccurrence[] = [
      {
        transaction: {
          id: 'occurrence-1',
          account: 'acct-1',
          amount: 10,
          date: '2024-03-02',
        },
        filterObject: {
          id: 'occurrence-1',
          amount: 10,
          date: '2024-03-02',
          notes: null,
          cleared: false,
          reconciled: false,
          transfer_id: null,
          is_parent: false,
          imported_payee: null,
          account: accounts[0],
          payee: null,
          category: null,
        },
        amount: 10,
        payee: 'Paycheck',
        scheduleId: 'sched-1',
        scheduleName: 'Paycheck',
      },
    ];
    const filterInfo: ForecastFilterInfo = {
      filters: [],
      conditionsOpKey: '$and',
      canRestrictAccounts: false,
    };
    const dateContext: ForecastDateContext = {
      forecastStartDate: '2024-03-02',
      forecastEndDate: '2024-03-04',
      forecastDays: ['2024-03-02', '2024-03-03', '2024-03-04'],
      firstForecastDate: '2024-03-02',
      endDateObj: new Date('2024-03-04T00:00:00'),
    };

    const result = projectForecastData({
      accounts,
      transactions,
      futureOccurrences,
      filterInfo,
      dateContext,
    });

    expect(result.dataPoints.map(point => point.balance)).toEqual([
      110, 70, 70,
    ]);
    expect(result.dataPoints[0].transactions).toMatchObject([
      { amount: 10, scheduleId: 'sched-1' },
    ]);
    expect(result.dataPoints[1].transactions).toMatchObject([
      { amount: -40, scheduleName: 'Transaction' },
    ]);
    expect(result.lowestBalance).toEqual({
      date: '2024-03-03',
      balance: 70,
      accountId: '',
      accountName: '',
    });
  });

  it('uses charge_date when available for credit card installment projection', () => {
    const accounts: AccountWithComputedBalance[] = [
      {
        id: 'credit-acct',
        name: 'Credit Card',
        closed: 0,
        offbudget: 0,
        balance_current: -50,
      },
    ];
    const transactions: TransactionEntity[] = [
      {
        id: 'installment-1',
        account: 'credit-acct',
        amount: -50,
        date: '2024-02-15', // purchased in Feb
        charge_date: '2024-03-10', // charged in Mar
      },
    ];
    const filterInfo: ForecastFilterInfo = {
      filters: [],
      conditionsOpKey: '$and',
      canRestrictAccounts: false,
    };
    const dateContext: ForecastDateContext = {
      forecastStartDate: '2024-03-01',
      forecastEndDate: '2024-03-15',
      forecastDays: ['2024-03-09', '2024-03-10', '2024-03-11'],
      firstForecastDate: '2024-03-01',
      endDateObj: new Date('2024-03-15T00:00:00'),
    };

    const result = projectForecastData({
      accounts,
      transactions,
      futureOccurrences: [],
      filterInfo,
      dateContext,
    });

    const march10Point = result.dataPoints.find(p => p.date === '2024-03-10');
    expect(march10Point).toBeDefined();
    expect(march10Point?.transactions).toMatchObject([
      { amount: -50, scheduleName: 'Transaction' },
    ]);
  });
});
