import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { SvgSwap } from '@actual-app/components/icons/v1';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import { q } from '@actual-app/core/shared/query';
import type { Query } from '@actual-app/core/shared/query';
import { getScheduledAmount } from '@actual-app/core/shared/schedules';
import { isPreviewId } from '@actual-app/core/shared/transactions';
import type { AccountEntity, TransactionEntity } from '@actual-app/core/types/models';

import { FinancialText } from '#components/FinancialText';
import { PrivacyFilter } from '#components/PrivacyFilter';
import { CellValue, CellValueText } from '#components/spreadsheet/CellValue';
import { useCachedSchedules } from '#hooks/useCachedSchedules';
import { useFormat } from '#hooks/useFormat';
import { useSelectedItems } from '#hooks/useSelected';
import { useSheetValue } from '#hooks/useSheetValue';
import { useSyncedPref } from '#hooks/useSyncedPref';
import type { Binding } from '#spreadsheet';

import { CreditCardBalances } from './CreditCardBalances';

type DetailedBalanceProps = {
  name: string;
  balance: number;
  isExactBalance?: boolean;
  onPress?: () => void;
};

export function DetailedBalance({
  name,
  balance,
  isExactBalance = true,
  onPress,
}: DetailedBalanceProps) {
  const format = useFormat();
  const content = (
    <Text
      style={{
        borderRadius: 4,
        padding: '4px 6px',
        color: theme.pillText,
        backgroundColor: theme.pillBackground,
        cursor: onPress ? 'pointer' : undefined,
        userSelect: 'none',
        ':hover': onPress
          ? {
              backgroundColor: theme.menuItemBackgroundHover,
            }
          : undefined,
      }}
    >
      {name}{' '}
      <PrivacyFilter>
        <FinancialText style={{ fontWeight: 600 }}>
          {!isExactBalance && '~ '}
          {format(balance, 'financial')}
        </FinancialText>
      </PrivacyFilter>
    </Text>
  );

  if (onPress) {
    return (
      <Button
        variant="bare"
        onPress={onPress}
        style={{
          padding: 0,
          backgroundColor: 'transparent',
          border: 'none',
        }}
      >
        {content}
      </Button>
    );
  }

  return content;
}

type SelectedBalanceProps = {
  selectedItems: Set<string>;
  account?: AccountEntity;
};

export function SelectedBalance({
  selectedItems,
  account,
}: SelectedBalanceProps) {
  const { t } = useTranslation();
  const { schedules } = useCachedSchedules();

  let isExactBalance = true;
  let balance = null;
  let scheduleBalance = 0;
  let hasSchedule = false;

  for (const id of selectedItems) {
    if (isPreviewId(id)) {
      hasSchedule = true;
      const parts = id.split('/');
      const schedule = schedules?.find(s => s.id === parts[1]);
      if (schedule && schedule._amount != null) {
        const amount = getScheduledAmount(schedule._amount);
        if (amount == null) {
          isExactBalance = false;
        } else if (typeof amount === 'number') {
          scheduleBalance += amount;
        }
      }
    }
  }

  if (account) {
    balance = balance ?? 0;
  }

  if (hasSchedule) {
    balance = (balance ?? 0) + scheduleBalance;
  }

  return (
    <DetailedBalance
      name={t('Selected balance:')}
      balance={balance ?? 0}
      isExactBalance={isExactBalance}
    />
  );
}

type FilteredBalanceProps = {
  filteredAmount?: number | null;
};

export function FilteredBalance({ filteredAmount }: FilteredBalanceProps) {
  const { t } = useTranslation();

  return (
    <DetailedBalance
      name={t('Filtered balance:')}
      balance={filteredAmount ?? 0}
      isExactBalance
    />
  );
}

type BalancesProps = {
  balanceQuery: { name: `balance-query-${string}`; query: Query };
  showExtraBalances?: boolean;
  onToggleExtraBalances?: () => void;
  account?: AccountEntity;
  transactions?: readonly TransactionEntity[];
  isFiltered: boolean;
  filteredAmount?: number | null;
};

export function Balances(props: BalancesProps) {
  if (props.account?.type === 'credit') {
    return (
      <CreditCardBalances
        {...props}
        account={props.account}
        transactions={props.transactions}
      />
    );
  }

  return <StandardBalances {...props} />;
}

function StandardBalances({
  balanceQuery,
  account,
  isFiltered,
  filteredAmount,
}: BalancesProps) {
  const { t } = useTranslation();
  const selectedItems = useSelectedItems();

  const [primaryBalanceViewPref, setPrimaryBalanceViewPref] = useSyncedPref(
    `primary-balance-view-${account?.id || 'all-accounts'}` as `primary-balance-view-${string}`,
  );
  const [primaryView, setPrimaryView] = useState<'uncleared' | 'cleared'>(
    primaryBalanceViewPref === 'cleared' ? 'cleared' : 'uncleared',
  );

  useEffect(() => {
    if (primaryBalanceViewPref) {
      setPrimaryView(
        primaryBalanceViewPref === 'cleared' ? 'cleared' : 'uncleared',
      );
    }
  }, [primaryBalanceViewPref]);

  const isUnclearedPrimary = primaryView === 'uncleared';

  const cleared = useSheetValue<'balance', `balance-query-${string}-cleared`>({
    name: (balanceQuery.name + '-cleared') as `balance-query-${string}-cleared`,
    query: balanceQuery.query.filter({ cleared: true }),
  });
  const uncleared = useSheetValue<
    'balance',
    `balance-query-${string}-uncleared`
  >({
    name: (balanceQuery.name +
      '-uncleared') as `balance-query-${string}-uncleared`,
    query: balanceQuery.query.filter({ cleared: false }),
  });

  const primaryBinding = {
    name: `${balanceQuery.name}-${isUnclearedPrimary ? 'uncleared' : 'cleared'}`,
    query: balanceQuery.query.filter({ cleared: !isUnclearedPrimary }),
    value: 0,
  } as unknown as Binding<'balance', `balance-query-${string}`>;

  const primaryLabel = isUnclearedPrimary
    ? t('Uncleared total')
    : t('Cleared total');

  const onTogglePrimaryBalance = () => {
    const next = primaryView === 'uncleared' ? 'cleared' : 'uncleared';
    setPrimaryView(next);
    setPrimaryBalanceViewPref(next);
  };

  return (
    <View
      style={{
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'center',
        marginTop: -5,
        marginLeft: -5,
        gap: 10,
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 4,
          minWidth: 160,
        }}
      >
        <Button
          data-testid="account-balance"
          variant="bare"
          aria-label={
            isUnclearedPrimary
              ? t('Switch to cleared balance')
              : t('Switch to uncleared balance')
          }
          onPress={onTogglePrimaryBalance}
          style={{
            paddingTop: 1,
            paddingBottom: 1,
            flexDirection: 'row',
            alignItems: 'center',
            minWidth: 130,
          }}
        >
          <View
            style={{
              flexDirection: 'column',
              alignItems: 'flex-start',
              width: '100%',
            }}
          >
            <Text
              style={{
                fontSize: 10,
                fontWeight: 600,
                textTransform: 'uppercase',
                color: theme.pageTextSubdued,
                letterSpacing: 0.5,
                marginBottom: -2,
                whiteSpace: 'nowrap',
              }}
            >
              {primaryLabel}
            </Text>
            <CellValue binding={primaryBinding} type="financial">
              {props => (
                <CellValueText
                  {...props}
                  style={{
                    fontSize: 22,
                    fontWeight: 400,
                    whiteSpace: 'nowrap',
                    color:
                      props.value < 0
                        ? theme.numberNegative
                        : props.value > 0
                          ? theme.numberPositive
                          : theme.pageTextSubdued,
                  }}
                />
              )}
            </CellValue>
          </View>
        </Button>

        <Button
          variant="bare"
          aria-label={
            isUnclearedPrimary
              ? t('Switch to cleared balance')
              : t('Switch to uncleared balance')
          }
          onPress={onTogglePrimaryBalance}
          style={{
            padding: 4,
            borderRadius: 4,
            color: theme.pageTextSubdued,
          }}
          data-testid="toggle-balance-view"
        >
          <SvgSwap width={14} height={14} />
        </Button>
      </View>

      {isUnclearedPrimary ? (
        <DetailedBalance
          name={t('Cleared total:')}
          balance={cleared ?? 0}
          onPress={onTogglePrimaryBalance}
        />
      ) : (
        <DetailedBalance
          name={t('Uncleared total:')}
          balance={uncleared ?? 0}
          onPress={onTogglePrimaryBalance}
        />
      )}

      {selectedItems.size > 0 && (
        <SelectedBalance selectedItems={selectedItems} account={account} />
      )}
      {isFiltered && <FilteredBalance filteredAmount={filteredAmount} />}
    </View>
  );
}
