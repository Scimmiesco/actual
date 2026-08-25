import type {
  AccountEntity,
  CategoryEntity,
} from '@actual-app/core/types/models';
import { describe, expect, it } from 'vitest';

import { buildScheduledCashFlowChartData } from './scheduledCashFlowChartData';

const accounts = [{ id: 'checking', name: 'Checking' }] as AccountEntity[];

const categories = [
  { id: 'food', name: 'Food', group: 'living' },
] as CategoryEntity[];

describe('buildScheduledCashFlowChartData', () => {
  it('groups scheduled transactions by month and preserves rule categories', () => {
    const data = buildScheduledCashFlowChartData({
      forecastData: {
        dataPoints: [
          {
            date: '2024-03-05',
            balance: 100,
            accountId: 'checking',
            accountName: 'Checking',
            transactions: [
              {
                amount: -25,
                payee: 'Grocer',
                category: 'food',
                scheduleId: 'schedule-1',
                scheduleName: 'Groceries',
              },
            ],
          },
          {
            date: '2024-03-15',
            balance: 200,
            accountId: 'checking',
            accountName: 'Checking',
            transactions: [
              {
                amount: 100,
                payee: 'Employer',
                category: null,
                scheduleId: 'schedule-2',
                scheduleName: 'Payday',
              },
            ],
          },
        ],
        lowestBalance: {
          date: '2024-03-05',
          balance: 100,
          accountId: 'checking',
          accountName: 'Checking',
        },
        forecastStartDate: '2024-03-01',
        forecastEndDate: '2024-03-31',
      },
      start: '2024-03',
      end: '2024-04',
      granularity: 'Monthly',
      accounts,
      categories,
      uncategorizedLabel: 'Uncategorized',
    });

    expect(data.points).toEqual([
      { date: '2024-03', total: 75, food: -25, uncategorized: 100 },
      { date: '2024-04', total: 0, food: 0, uncategorized: 0 },
    ]);
    expect(data.totalIncome).toBe(100);
    expect(data.totalExpenses).toBe(-25);
    expect(data.occurrences[0]).toMatchObject({
      accountName: 'Checking',
      categoryName: 'Food',
    });
  });

  it('preserves exact bounds for daily data', () => {
    const data = buildScheduledCashFlowChartData({
      forecastData: null,
      start: '2024-03-10',
      end: '2024-03-12',
      granularity: 'Daily',
      accounts: [],
      categories: [],
      uncategorizedLabel: 'Uncategorized',
    });

    expect(data.points).toEqual([
      { date: '2024-03-10', total: 0 },
      { date: '2024-03-11', total: 0 },
      { date: '2024-03-12', total: 0 },
    ]);
  });
});
