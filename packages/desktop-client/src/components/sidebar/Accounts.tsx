import React, { useState } from 'react';
import type { MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { SvgSwap } from '@actual-app/components/icons/v1';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import type { AccountEntity } from '@actual-app/core/types/models';

import { useMoveAccountMutation } from '#accounts';
import { isAccountFailedSync } from '#accounts/syncStatus';
import { useAccounts } from '#hooks/useAccounts';
import { useClosedAccounts } from '#hooks/useClosedAccounts';
import { useLocalPref } from '#hooks/useLocalPref';
import { useOffBudgetAccounts } from '#hooks/useOffBudgetAccounts';
import { useOnBudgetAccounts } from '#hooks/useOnBudgetAccounts';
import { useSyncedPref } from '#hooks/useSyncedPref';
import { useUpdatedAccounts } from '#hooks/useUpdatedAccounts';
import { useSelector } from '#redux';
import * as bindings from '#spreadsheet/bindings';

import { Account } from './Account';
import { SecondaryItem } from './SecondaryItem';

const fontWeight = 600;

export function Accounts() {
  const { t } = useTranslation();
  const [isDragging, setIsDragging] = useState(false);
  const { data: accounts = [] } = useAccounts();
  const updatedAccounts = useUpdatedAccounts();
  const { data: offbudgetAccounts = [] } = useOffBudgetAccounts();
  const { data: onBudgetAccounts = [] } = useOnBudgetAccounts();
  const { data: closedAccounts = [] } = useClosedAccounts();
  const syncingAccountIds = useSelector(state => state.account.accountsSyncing);

  const getAccountPath = (account: AccountEntity) => `/accounts/${account.id}`;

  const onBudgetNonCreditAccounts = onBudgetAccounts.filter(
    a => a.type !== 'credit',
  );
  const onBudgetCreditAccounts = onBudgetAccounts.filter(
    a => a.type === 'credit',
  );

  const [showClosedAccounts, setShowClosedAccountsPref] = useLocalPref(
    'ui.showClosedAccounts',
  );
  const [onBudgetBalanceViewPref, setOnBudgetBalanceViewPref] = useSyncedPref(
    'sidebar.onbudget-balance-view',
  );
  const isOnBudgetCleared = onBudgetBalanceViewPref === 'cleared';

  const [creditCardBalanceViewPref, setCreditCardBalanceViewPref] =
    useSyncedPref('sidebar.creditcard-balance-view');
  const isCreditCardCleared = creditCardBalanceViewPref === 'cleared';

  const onToggleOnBudgetBalanceView = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setOnBudgetBalanceViewPref(isOnBudgetCleared ? 'all' : 'cleared');
  };

  const onToggleCreditCardBalanceView = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setCreditCardBalanceViewPref(isCreditCardCleared ? 'due' : 'cleared');
  };

  function onDragChange(drag: { state: string }) {
    setIsDragging(drag.state === 'start');
  }

  const moveAccount = useMoveAccountMutation();

  const makeDropPadding = (i: number) => {
    if (i === 0) {
      return {
        paddingTop: isDragging ? 15 : 0,
        marginTop: isDragging ? -15 : 0,
      };
    }
    return undefined;
  };

  async function onReorder(
    id: string,
    dropPos: 'top' | 'bottom' | null,
    targetId: string,
  ) {
    let targetIdToMove: string | null = targetId;
    if (dropPos === 'bottom') {
      const idx = accounts.findIndex(a => a.id === targetId) + 1;
      targetIdToMove = idx < accounts.length ? accounts[idx].id : null;
    }

    moveAccount.mutate({ id, targetId: targetIdToMove });
  }

  const onToggleClosedAccounts = () => {
    setShowClosedAccountsPref(!showClosedAccounts);
  };

  return (
    <View
      style={{
        flexGrow: 1,
        '@media screen and (max-height: 480px)': {
          minHeight: 'auto',
        },
      }}
    >
      <View
        style={{
          height: 1,
          backgroundColor: theme.sidebarItemBackgroundHover,
          marginTop: 15,
          flexShrink: 0,
        }}
      />

      <View style={{ overflow: 'auto' }}>
        <Account
          name={t('All accounts')}
          to="/accounts"
          query={bindings.allAccountBalanceWithViews({
            onBudgetCleared: isOnBudgetCleared,
            creditCardCleared: isCreditCardCleared,
          })}
          style={{ fontWeight, marginTop: 15 }}
          isExactPathMatch
          balanceTestId="sidebar-all-accounts-balance"
        />

        {onBudgetAccounts.length > 0 && (
          <Account
            name={t('On budget')}
            to="/accounts/onbudget"
            query={bindings.onBudgetAccountBalanceWithViews({
              onBudgetCleared: isOnBudgetCleared,
              creditCardCleared: isCreditCardCleared,
            })}
            style={{
              fontWeight,
              marginTop: 13,
              marginBottom: 5,
            }}
            titleAccount
            balanceTestId="sidebar-on-budget-balance"
            action={
              <Button
                variant="bare"
                aria-label={
                  isOnBudgetCleared
                    ? t('Switch to all transactions balance')
                    : t('Switch to cleared balance only')
                }
                onClick={onToggleOnBudgetBalanceView}
                style={({ isHovered }) => ({
                  padding: 2,
                  borderRadius: 3,
                  color: isOnBudgetCleared
                    ? theme.sidebarItemTextSelected
                    : theme.sidebarItemText,
                  opacity: isHovered ? 1 : 0.8,
                })}
                data-testid="toggle-sidebar-onbudget-balance-view"
              >
                <SvgSwap width={11} height={11} />
              </Button>
            }
          />
        )}

        {onBudgetNonCreditAccounts.map((account, i) => (
          <Account
            key={account.id}
            name={account.name}
            account={account}
            connected={!!account.bank}
            pending={syncingAccountIds.includes(account.id)}
            failed={isAccountFailedSync(account)}
            updated={updatedAccounts.includes(account.id)}
            to={getAccountPath(account)}
            query={
              isOnBudgetCleared
                ? bindings.accountBalanceCleared(account.id)
                : bindings.accountBalance(account.id)
            }
            onDragChange={onDragChange}
            onDrop={onReorder}
            outerStyle={makeDropPadding(i)}
          />
        ))}

        {onBudgetCreditAccounts.length > 0 && (
          <>
            <Account
              name={t('Credit cards')}
              to="/accounts"
              query={
                isCreditCardCleared
                  ? bindings.creditCardsTotalBalanceCleared()
                  : bindings.creditCardsTotalBalance()
              }
              style={{
                fontWeight,
                marginTop: 10,
                marginBottom: 5,
              }}
              titleAccount
              balanceTestId="sidebar-credit-cards-balance"
              action={
                <Button
                  variant="bare"
                  aria-label={
                    isCreditCardCleared
                      ? t('Switch to bill due balance')
                      : t('Switch to cleared balance only')
                  }
                  onClick={onToggleCreditCardBalanceView}
                  style={({ isHovered }) => ({
                    padding: 2,
                    borderRadius: 3,
                    color: isCreditCardCleared
                      ? theme.sidebarItemTextSelected
                      : theme.sidebarItemText,
                    opacity: isHovered ? 1 : 0.8,
                  })}
                  data-testid="toggle-sidebar-creditcard-balance-view"
                >
                  <SvgSwap width={11} height={11} />
                </Button>
              }
            />
            {onBudgetCreditAccounts.map((account, i) => (
              <Account
                key={account.id}
                name={account.name}
                account={account}
                connected={!!account.bank}
                pending={syncingAccountIds.includes(account.id)}
                failed={isAccountFailedSync(account)}
                updated={updatedAccounts.includes(account.id)}
                to={getAccountPath(account)}
                query={
                  isCreditCardCleared
                    ? bindings.accountBalanceCleared(account.id)
                    : bindings.creditCardAccountBalance(account.id)
                }
                onDragChange={onDragChange}
                onDrop={onReorder}
                outerStyle={makeDropPadding(
                  onBudgetNonCreditAccounts.length + i,
                )}
              />
            ))}
          </>
        )}

        {offbudgetAccounts.length > 0 && (
          <Account
            name={t('Off budget')}
            to="/accounts/offbudget"
            query={bindings.offBudgetAccountBalance()}
            style={{
              fontWeight,
              marginTop: 13,
              marginBottom: 5,
            }}
            titleAccount
            balanceTestId="sidebar-off-budget-balance"
          />
        )}

        {offbudgetAccounts.map((account, i) => (
          <Account
            key={account.id}
            name={account.name}
            account={account}
            connected={!!account.bank}
            pending={syncingAccountIds.includes(account.id)}
            failed={isAccountFailedSync(account)}
            updated={updatedAccounts.includes(account.id)}
            to={getAccountPath(account)}
            query={bindings.accountBalance(account.id)}
            onDragChange={onDragChange}
            onDrop={onReorder}
            outerStyle={makeDropPadding(i)}
          />
        ))}

        {closedAccounts.length > 0 && (
          <SecondaryItem
            style={{ marginTop: 15 }}
            title={
              showClosedAccounts
                ? t('Closed accounts')
                : t('Closed accounts...')
            }
            onClick={onToggleClosedAccounts}
            bold
          />
        )}

        {showClosedAccounts &&
          closedAccounts.map(account => (
            <Account
              key={account.id}
              name={account.name}
              account={account}
              to={getAccountPath(account)}
              query={bindings.accountBalance(account.id)}
              onDragChange={onDragChange}
              onDrop={onReorder}
            />
          ))}
      </View>
    </View>
  );
}
