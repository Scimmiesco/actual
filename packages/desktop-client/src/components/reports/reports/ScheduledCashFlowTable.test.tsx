import React from 'react';

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { TestProviders } from '#mocks';

import type { ScheduledCashFlowOccurrence } from './scheduledCashFlowChartData';
import { ScheduledCashFlowTable } from './ScheduledCashFlowTable';

const mockOccurrences: ScheduledCashFlowOccurrence[] = [
  {
    date: '2026-09-09',
    accountId: 'acct-1',
    accountName: 'Checking Account',
    payee: 'Grocery Store',
    categoryId: 'food',
    categoryName: 'Food',
    amount: -5000,
    scheduleName: 'Groceries',
  },
  {
    date: '2026-09-10',
    accountId: 'acct-2',
    accountName: 'Savings Account',
    payee: 'Employer',
    categoryId: 'income',
    categoryName: 'Income',
    amount: 250000,
    scheduleName: 'Salary',
  },
];

describe('ScheduledCashFlowTable', () => {
  it('renders table headers and occurrences using Table components', () => {
    render(
      <TestProviders>
        <ScheduledCashFlowTable occurrences={mockOccurrences} />
      </TestProviders>,
    );

    expect(screen.getByText('Date')).toBeInTheDocument();
    expect(screen.getByText('Account')).toBeInTheDocument();
    expect(screen.getByText('Payee')).toBeInTheDocument();
    expect(screen.getByText('Category')).toBeInTheDocument();
    expect(screen.getByText('Amount')).toBeInTheDocument();

    expect(screen.getByText('Checking Account')).toBeInTheDocument();
    expect(screen.getByText('Grocery Store')).toBeInTheDocument();
    expect(screen.getByText('Food')).toBeInTheDocument();
    expect(screen.getByText('-50.00')).toBeInTheDocument();

    expect(screen.getByText('Savings Account')).toBeInTheDocument();
    expect(screen.getByText('Employer')).toBeInTheDocument();
    expect(screen.getByText('Income')).toBeInTheDocument();
    expect(screen.getByText('2,500.00')).toBeInTheDocument();
  });

  it('allows grouping by day from options menu', () => {
    render(
      <TestProviders>
        <ScheduledCashFlowTable occurrences={mockOccurrences} />
      </TestProviders>,
    );

    const optionsButton = screen.getByLabelText('Table options');
    fireEvent.click(optionsButton);

    const groupByDayOption = screen.getByText('Group by day');
    fireEvent.click(groupByDayOption);

    expect(screen.getByText('2026-09-09')).toBeInTheDocument();
    expect(screen.getByText('2026-09-10')).toBeInTheDocument();
  });

  it('renders empty state when there are no occurrences', () => {
    render(
      <TestProviders>
        <ScheduledCashFlowTable occurrences={[]} />
      </TestProviders>,
    );

    expect(
      screen.getByText('No scheduled transactions found'),
    ).toBeInTheDocument();
  });

  it('renders credit card bills alongside schedules with correct formatting', () => {
    const mixedOccurrences: ScheduledCashFlowOccurrence[] = [
      {
        date: '2026-09-01',
        accountId: 'checking',
        accountName: 'Checking Account',
        payee: 'Landlord',
        categoryId: 'rent',
        categoryName: 'Rent',
        amount: -120000,
        scheduleName: 'Rent',
      },
      {
        date: '2026-09-10',
        accountId: 'card-1',
        accountName: 'Credit Card A',
        payee: 'Card A Statement',
        categoryId: 'cc',
        categoryName: 'Credit Card',
        amount: -200000,
        scheduleName: 'Transaction',
      },
      {
        date: '2026-09-10',
        accountId: 'card-2',
        accountName: 'Credit Card B',
        payee: 'Card B Statement',
        categoryId: 'cc',
        categoryName: 'Credit Card',
        amount: -150000,
        scheduleName: 'Transaction',
      },
      {
        date: '2026-09-10',
        accountId: 'card-3',
        accountName: 'Credit Card C',
        payee: 'Card C Statement',
        categoryId: 'cc',
        categoryName: 'Credit Card',
        amount: -213777,
        scheduleName: 'Transaction',
      },
    ];

    render(
      <TestProviders>
        <ScheduledCashFlowTable occurrences={mixedOccurrences} />
      </TestProviders>,
    );

    expect(screen.getByText('Landlord')).toBeInTheDocument();
    expect(screen.getByText('-1,200.00')).toBeInTheDocument();

    expect(screen.getByText('Credit Card A')).toBeInTheDocument();
    expect(screen.getByText('-2,000.00')).toBeInTheDocument();

    expect(screen.getByText('Credit Card B')).toBeInTheDocument();
    expect(screen.getByText('-1,500.00')).toBeInTheDocument();

    expect(screen.getByText('Credit Card C')).toBeInTheDocument();
    expect(screen.getByText('-2,137.77')).toBeInTheDocument();
  });
});
