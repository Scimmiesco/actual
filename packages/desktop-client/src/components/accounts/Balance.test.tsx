import React from 'react';

import type { Query } from '@actual-app/core/shared/query';
import type {
  AccountEntity,
  ScheduleEntity,
} from '@actual-app/core/types/models';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { useCachedSchedules } from '#hooks/useCachedSchedules';
import { useSelectedItems } from '#hooks/useSelected';
import { useSheetValue } from '#hooks/useSheetValue';
import { TestProviders } from '#mocks';

import { Balances, SelectedBalance } from './Balance';

vi.mock('#hooks/useSelected', () => ({
  useSelectedItems: vi.fn(),
}));

vi.mock('#hooks/useSheetValue', () => ({
  useSheetValue: vi.fn(),
}));

vi.mock('#hooks/useCachedSchedules', () => ({
  useCachedSchedules: vi.fn(),
}));

function makeSchedule(
  id: string,
  amount: number,
  accountId: string,
): ScheduleEntity {
  return {
    id,
    rule: 'rule-1',
    next_date: '2026-03-24',
    completed: false,
    posts_transaction: false,
    tombstone: false,
    _payee: 'payee-1',
    _account: accountId,
    _amount: amount,
    _amountOp: 'is',
    _date: '2026-03-24',
    _conditions: [],
    _actions: [],
  } satisfies ScheduleEntity;
}

function mockedSchedules(schedules: ScheduleEntity[]) {
  return {
    isLoading: false,
    schedules,
    statuses: new Map(),
    statusLabels: new Map(),
  };
}

describe('SelectedBalance – normal transactions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useCachedSchedules).mockReturnValue(mockedSchedules([]));
  });

  test('shows balance for selected normal transactions', () => {
    vi.mocked(useSheetValue)
      .mockReturnValueOnce(null)
      .mockReturnValueOnce(-5000);

    render(
      <TestProviders>
        <SelectedBalance selectedItems={new Set(['tx-123'])} />
      </TestProviders>,
    );

    expect(screen.getByText('Selected balance:')).toBeInTheDocument();
    expect(screen.getByText('-50.00')).toBeInTheDocument();
  });

  test('shows balance when balance is falsy', () => {
    vi.mocked(useSheetValue).mockReturnValueOnce(null).mockReturnValueOnce(0);

    render(
      <TestProviders>
        <SelectedBalance selectedItems={new Set(['tx-123'])} />
      </TestProviders>,
    );

    expect(screen.getByText('Selected balance:')).toBeInTheDocument();
  });
});

describe('SelectedBalance – preview (scheduled) transactions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useSheetValue).mockReturnValue(null);
  });

  test('includes the schedule amount when a preview transaction is selected', () => {
    const scheduleId = 'schedule-abc';

    vi.mocked(useSelectedItems).mockReturnValue(
      new Set([`preview/${scheduleId}/2026-03-24`]),
    );
    vi.mocked(useCachedSchedules).mockReturnValue(
      mockedSchedules([makeSchedule(scheduleId, -5000, 'account-1')]),
    );

    render(
      <TestProviders>
        <SelectedBalance
          selectedItems={new Set([`preview/${scheduleId}/2026-03-24`])}
        />
      </TestProviders>,
    );

    expect(screen.getByText('Selected balance:')).toBeInTheDocument();
  });

  test('counts each selected occurrence of the same schedule independently', () => {
    const scheduleId = 'schedule-abc';
    const previewId1 = `preview/${scheduleId}/2026-03-24`;
    const previewId2 = `preview/${scheduleId}/2026-04-24`;
    const selectedItems = new Set([previewId1, previewId2]);

    vi.mocked(useSelectedItems).mockReturnValue(selectedItems);
    vi.mocked(useCachedSchedules).mockReturnValue(
      mockedSchedules([makeSchedule(scheduleId, -5000, 'account-1')]),
    );

    render(
      <TestProviders>
        <SelectedBalance selectedItems={selectedItems} />
      </TestProviders>,
    );

    expect(screen.getByText('-100.00')).toBeInTheDocument();
  });
});

describe('Balances – header visualization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useCachedSchedules).mockReturnValue(mockedSchedules([]));
    vi.mocked(useSelectedItems).mockReturnValue(new Set());
  });

  test('renders Uncleared total as primary view by default and Cleared total as secondary', () => {
    vi.mocked(useSheetValue).mockImplementation((binding: unknown) => {
      const name =
        typeof binding === 'string'
          ? binding
          : (binding as { name?: string })?.name || '';
      if (name.includes('cleared') && !name.includes('uncleared')) {
        return 120000;
      }
      if (name.includes('uncleared')) {
        return -15000;
      }
      return 105000;
    });

    render(
      <TestProviders>
        <Balances
          balanceQuery={{
            name: 'balance-query-acct-1',
            query: {
              filter: vi.fn().mockReturnThis(),
            } as unknown as Query,
          }}
          showExtraBalances={false}
          onToggleExtraBalances={vi.fn()}
          isFiltered={false}
        />
      </TestProviders>,
    );

    expect(screen.getByText('Uncleared total')).toBeInTheDocument();
    expect(screen.getByText('Cleared total:')).toBeInTheDocument();
    expect(screen.getByTestId('toggle-balance-view')).toBeInTheDocument();
  });

  test('toggles primary balance view to Cleared total when swap button is clicked', async () => {
    vi.mocked(useSheetValue).mockImplementation((binding: unknown) => {
      const name =
        typeof binding === 'string'
          ? binding
          : (binding as { name?: string })?.name || '';
      if (name.includes('cleared') && !name.includes('uncleared')) {
        return 120000;
      }
      if (name.includes('uncleared')) {
        return -15000;
      }
      return 105000;
    });

    render(
      <TestProviders>
        <Balances
          balanceQuery={{
            name: 'balance-query-acct-1',
            query: {
              filter: vi.fn().mockReturnThis(),
            } as unknown as Query,
          }}
          showExtraBalances={false}
          onToggleExtraBalances={vi.fn()}
          isFiltered={false}
        />
      </TestProviders>,
    );

    expect(screen.getByText('Uncleared total')).toBeInTheDocument();
    const swapButton = screen.getByTestId('toggle-balance-view');
    fireEvent.click(swapButton);

    await waitFor(() => {
      expect(screen.getByText('Cleared total')).toBeInTheDocument();
    });
    expect(screen.getByText('Uncleared total:')).toBeInTheDocument();
  });

  test('toggles primary balance view when main balance button is clicked', async () => {
    vi.mocked(useSheetValue).mockImplementation((binding: unknown) => {
      const name =
        typeof binding === 'string'
          ? binding
          : (binding as { name?: string })?.name || '';
      if (name.includes('cleared') && !name.includes('uncleared')) {
        return 120000;
      }
      if (name.includes('uncleared')) {
        return -15000;
      }
      return 105000;
    });

    render(
      <TestProviders>
        <Balances
          balanceQuery={{
            name: 'balance-query-acct-1',
            query: {
              filter: vi.fn().mockReturnThis(),
            } as unknown as Query,
          }}
          isFiltered={false}
        />
      </TestProviders>,
    );

    expect(screen.getByText('Uncleared total')).toBeInTheDocument();
    const balanceButton = screen.getByTestId('account-balance');
    fireEvent.click(balanceButton);

    await waitFor(() => {
      expect(screen.getByText('Cleared total')).toBeInTheDocument();
    });
    expect(screen.getByText('Uncleared total:')).toBeInTheDocument();
  });

  test('renders CreditCardBalances with Next month as default primary and allows toggling', async () => {
    vi.mocked(useSheetValue).mockImplementation((binding: unknown) => {
      const name =
        typeof binding === 'string'
          ? binding
          : (binding as { name?: string })?.name || '';
      if (name.includes('next-month')) {
        return -2990;
      }
      if (name.includes('current-month')) {
        return -5990;
      }
      if (name.includes('future')) {
        return -29900;
      }
      if (name.includes('uncleared')) {
        return -2990;
      }
      return -38880;
    });

    render(
      <TestProviders>
        <Balances
          account={
            {
              id: 'acct-credit',
              name: 'Credit Card',
              type: 'credit',
              offbudget: 0,
              closed: 0,
              sort_order: 1,
              tombstone: 0,
            } as unknown as AccountEntity
          }
          balanceQuery={{
            name: 'balance-query-acct-credit',
            query: {
              filter: vi.fn().mockReturnThis(),
            } as unknown as Query,
          }}
          isFiltered={false}
        />
      </TestProviders>,
    );

    // Primary label is Next month by default
    expect(screen.getByText(/NEXT MONTH/i)).toBeInTheDocument();
    expect(screen.getByText('Total balance:')).toBeInTheDocument();
    expect(screen.getByText(/This month/)).toBeInTheDocument();
    expect(screen.getByText('Future installments:')).toBeInTheDocument();

    const swapButton = screen.getByTestId('toggle-balance-view');
    fireEvent.click(swapButton);

    await waitFor(() => {
      expect(screen.getByText('Total balance')).toBeInTheDocument();
    });
    expect(screen.getByText(/Next month/)).toBeInTheDocument();
  });
});
