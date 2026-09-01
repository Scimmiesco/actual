import React, { useState } from 'react';

import { generateAccount } from '@actual-app/core/mocks';
import type { AccountEntity } from '@actual-app/core/types/models';
import { fireEvent, render, screen } from '@testing-library/react';

import { TestProviders } from '#mocks';

import { AccountSelector } from './AccountSelector';

const mockAccounts: AccountEntity[] = [
  {
    ...generateAccount('Checking Account 1', false, false),
    id: 'chk-1',
    type: 'checking',
  },
  {
    ...generateAccount('Checking Account 2', false, false),
    id: 'chk-2',
    type: null as unknown as 'checking',
  },
  {
    ...generateAccount('Credit Card 1', false, false),
    id: 'cc-1',
    type: 'credit',
  },
  {
    ...generateAccount('Credit Card 2', false, false),
    id: 'cc-2',
    type: 'credit',
  },
  {
    ...generateAccount('Investment Account', false, true),
    id: 'off-1',
    type: 'investment',
  },
  {
    ...generateAccount('Closed Account', false, false),
    id: 'cls-1',
    closed: 1,
    type: 'checking',
  },
];

function TestAccountSelectorWrapper({
  initialSelected = [],
}: {
  initialSelected?: string[];
}) {
  const [selectedAccountIds, setSelectedAccountIds] =
    useState<string[]>(initialSelected);

  return (
    <TestProviders>
      <div>
        <div data-testid="selected-ids">{selectedAccountIds.join(',')}</div>
        <AccountSelector
          accounts={mockAccounts}
          selectedAccountIds={selectedAccountIds}
          setSelectedAccountIds={setSelectedAccountIds}
        />
      </div>
    </TestProviders>
  );
}

describe('AccountSelector', () => {
  it('toggles checking accounts on and off when clicking Checking accounts row', () => {
    render(<TestAccountSelectorWrapper initialSelected={[]} />);

    expect(screen.getByTestId('selected-ids').textContent).toBe('');

    // Click Checking accounts
    fireEvent.click(screen.getByText('Checking accounts'));
    expect(screen.getByTestId('selected-ids').textContent).toBe('chk-1,chk-2');

    // Click Checking accounts again to toggle off
    fireEvent.click(screen.getByText('Checking accounts'));
    expect(screen.getByTestId('selected-ids').textContent).toBe('');
  });

  it('toggles credit cards on and off when clicking Credit cards row', () => {
    render(<TestAccountSelectorWrapper initialSelected={[]} />);

    // Click Credit cards
    fireEvent.click(screen.getByText('Credit cards'));
    expect(screen.getByTestId('selected-ids').textContent).toBe('cc-1,cc-2');

    // Click Credit cards again to toggle off
    fireEvent.click(screen.getByText('Credit cards'));
    expect(screen.getByTestId('selected-ids').textContent).toBe('');
  });

  it('toggles all on-budget accounts when clicking On Budget row', () => {
    render(<TestAccountSelectorWrapper initialSelected={[]} />);

    // Click On Budget
    fireEvent.click(screen.getByText('On Budget'));
    expect(screen.getByTestId('selected-ids').textContent).toBe(
      'chk-1,chk-2,cc-1,cc-2',
    );

    // Click On Budget again to toggle off
    fireEvent.click(screen.getByText('On Budget'));
    expect(screen.getByTestId('selected-ids').textContent).toBe('');
  });

  it('toggles individual accounts independently', () => {
    render(<TestAccountSelectorWrapper initialSelected={['chk-1']} />);

    expect(screen.getByTestId('selected-ids').textContent).toBe('chk-1');

    // Click Credit Card 1
    fireEvent.click(screen.getByText('Credit Card 1'));
    expect(screen.getByTestId('selected-ids').textContent).toBe('chk-1,cc-1');

    // Click Checking Account 1 to uncheck
    fireEvent.click(screen.getByText('Checking Account 1'));
    expect(screen.getByTestId('selected-ids').textContent).toBe('cc-1');
  });

  it('handles Select All and Unselect All buttons', () => {
    render(<TestAccountSelectorWrapper initialSelected={[]} />);

    // Click Select All
    fireEvent.click(screen.getByRole('button', { name: 'Select All' }));
    expect(screen.getByTestId('selected-ids').textContent).toBe(
      'chk-1,chk-2,cc-1,cc-2,off-1,cls-1',
    );

    // Click Unselect All
    fireEvent.click(screen.getByRole('button', { name: 'Unselect All' }));
    expect(screen.getByTestId('selected-ids').textContent).toBe('');
  });
});
