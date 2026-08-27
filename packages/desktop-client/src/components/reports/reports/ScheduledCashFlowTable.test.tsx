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
});
