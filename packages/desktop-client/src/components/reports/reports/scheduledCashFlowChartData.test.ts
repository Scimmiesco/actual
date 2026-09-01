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
    expect(data.accountBreakdown).toEqual([
      {
        accountId: 'checking',
        accountName: 'Checking',
        income: 100,
        expenses: -25,
      },
    ]);
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

  it('includes account ab20b57d-2eb3-459c-99e2-f2eca64096b2 and its September 9th transaction in chart occurrences and totals', () => {
    const creditCardId = 'ab20b57d-2eb3-459c-99e2-f2eca64096b2';
    const data = buildScheduledCashFlowChartData({
      forecastData: {
        dataPoints: [
          {
            date: '2026-09-09',
            balance: -150,
            accountId: creditCardId,
            accountName: 'Credit Card',
            transactions: [
              {
                amount: -150,
                payee: 'Amazon',
                category: 'shopping',
                scheduleId: null,
                scheduleName: 'Transaction',
              },
            ],
          },
        ],
        lowestBalance: {
          date: '2026-09-09',
          balance: -150,
          accountId: creditCardId,
          accountName: 'Credit Card',
        },
        forecastStartDate: '2026-08-01',
        forecastEndDate: '2027-07-31',
      },
      start: '2026-08',
      end: '2027-07',
      granularity: 'Monthly',
      accounts: [{ id: creditCardId, name: 'Credit Card' }] as AccountEntity[],
      categories: [{ id: 'shopping', name: 'Shopping' }] as CategoryEntity[],
      uncategorizedLabel: 'Uncategorized',
    });

    expect(data.occurrences).toContainEqual({
      date: '2026-09-09',
      accountId: creditCardId,
      accountName: 'Credit Card',
      payee: 'Amazon',
      scheduleName: 'Transaction',
      categoryId: 'shopping',
      categoryName: 'Shopping',
      amount: -150,
    });
    expect(data.accountBreakdown).toContainEqual({
      accountId: creditCardId,
      accountName: 'Credit Card',
      income: 0,
      expenses: -150,
    });
    expect(data.totalExpenses).toBe(-150);
  });

  it('correctly calculates total expenses for 3 credit card accounts summing to 5637.77 and schedules like rent', () => {
    const card1 = 'card-1';
    const card2 = 'card-2';
    const card3 = 'card-3';
    const checking = 'checking-1';

    const data = buildScheduledCashFlowChartData({
      forecastData: {
        dataPoints: [
          {
            date: '2026-09-01',
            balance: 5000,
            accountId: checking,
            accountName: 'Checking Account',
            transactions: [
              {
                amount: -120000,
                payee: 'Landlord',
                category: 'rent',
                scheduleId: 'sched-rent',
                scheduleName: 'Rent',
              },
              {
                amount: -30000,
                payee: 'Allowance',
                category: 'allowance',
                scheduleId: 'sched-allowance',
                scheduleName: 'Allowance',
              },
            ],
          },
          {
            date: '2026-09-10',
            balance: -200000,
            accountId: card1,
            accountName: 'Credit Card A',
            transactions: [
              {
                amount: -200000,
                payee: 'Card A Statement',
                category: 'cc-bill',
                scheduleId: null,
                scheduleName: 'Transaction',
              },
            ],
          },
          {
            date: '2026-09-10',
            balance: -150000,
            accountId: card2,
            accountName: 'Credit Card B',
            transactions: [
              {
                amount: -150000,
                payee: 'Card B Statement',
                category: 'cc-bill',
                scheduleId: null,
                scheduleName: 'Transaction',
              },
            ],
          },
          {
            date: '2026-09-10',
            balance: -213777,
            accountId: card3,
            accountName: 'Credit Card C',
            transactions: [
              {
                amount: -213777,
                payee: 'Card C Statement',
                category: 'cc-bill',
                scheduleId: null,
                scheduleName: 'Transaction',
              },
            ],
          },
        ],
        lowestBalance: {
          date: '2026-09-10',
          balance: -213777,
          accountId: card3,
          accountName: 'Credit Card C',
        },
        forecastStartDate: '2026-09-01',
        forecastEndDate: '2026-09-30',
      },
      start: '2026-09',
      end: '2026-09',
      granularity: 'Monthly',
      accounts: [
        { id: checking, name: 'Checking Account' },
        { id: card1, name: 'Credit Card A' },
        { id: card2, name: 'Credit Card B' },
        { id: card3, name: 'Credit Card C' },
      ] as AccountEntity[],
      categories: [
        { id: 'rent', name: 'Rent' },
        { id: 'allowance', name: 'Allowance' },
        { id: 'cc-bill', name: 'Credit Card Bill' },
      ] as CategoryEntity[],
      uncategorizedLabel: 'Uncategorized',
    });

    // Sum of credit card bills: 2000.00 + 1500.00 + 2137.77 = 5637.77 (-563777 in integer cents)
    const creditCardsTotal = data.occurrences
      .filter(o => [card1, card2, card3].includes(o.accountId))
      .reduce((sum, o) => sum + o.amount, 0);
    expect(creditCardsTotal).toBe(-563777);

    // Rent + Allowance = -150000 (-1500.00)
    const schedulesTotal = data.occurrences
      .filter(o => o.accountId === checking)
      .reduce((sum, o) => sum + o.amount, 0);
    expect(schedulesTotal).toBe(-150000);

    // Total expenses for the month = -563777 + -150000 = -713777
    expect(data.totalExpenses).toBe(-713777);
    expect(data.occurrences).toHaveLength(5);
  });
});
