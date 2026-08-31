import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { SvgSwap } from '@actual-app/components/icons/v1';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import * as monthUtils from '@actual-app/core/shared/months';
import type { Query } from '@actual-app/core/shared/query';
import type {
  AccountEntity,
  TransactionEntity,
} from '@actual-app/core/types/models';

import { FinancialText } from '#components/FinancialText';
import { PrivacyFilter } from '#components/PrivacyFilter';
import { CellValue, CellValueText } from '#components/spreadsheet/CellValue';
import { useFormat } from '#hooks/useFormat';
import { useLocale } from '#hooks/useLocale';
import { useSelectedItems } from '#hooks/useSelected';
import { useSheetValue } from '#hooks/useSheetValue';
import { useSyncedPref } from '#hooks/useSyncedPref';
import type { Binding } from '#spreadsheet';

import { DetailedBalance, FilteredBalance, SelectedBalance } from './Balance';

type CreditCardBalancesProps = {
  balanceQuery: {
    name: `balance-query-${string}`;
    query: Query;
  };
  account: AccountEntity;
  transactions?: readonly TransactionEntity[];
  isFiltered: boolean;
  filteredAmount?: number | null;
  showExtraBalances?: boolean;
  onToggleExtraBalances?: () => void;
};

export function CreditCardBalances({
  balanceQuery,
  account,
  transactions,
  isFiltered,
  filteredAmount,
}: CreditCardBalancesProps) {
  const { t } = useTranslation();
  const format = useFormat();
  const locale = useLocale();
  const selectedItems = useSelectedItems();

  const currentMonth = monthUtils.currentMonth();
  const nextMonth = monthUtils.nextMonth(currentMonth);

  const startOfCurrentMonth = `${currentMonth}-01`;
  const endOfCurrentMonth = monthUtils.lastDayOfMonth(currentMonth);

  const startOfNextMonth = `${nextMonth}-01`;
  const endOfNextMonth = monthUtils.lastDayOfMonth(nextMonth);

  const [primaryBalanceViewPref, setPrimaryBalanceViewPref] = useSyncedPref(
    `primary-balance-view-${account.id}` as `primary-balance-view-${string}`,
  );

  const getValidView = (pref: string | null | undefined) => {
    if (pref === 'total' || pref === 'current-month' || pref === 'next-month') {
      return pref;
    }
    return 'next-month';
  };

  const [primaryView, setPrimaryView] = useState<string>(
    getValidView(primaryBalanceViewPref),
  );

  useEffect(() => {
    setPrimaryView(getValidView(primaryBalanceViewPref));
  }, [primaryBalanceViewPref]);

  // Total balance binding
  const totalBalanceBinding = useMemo(
    () =>
      ({
        name: balanceQuery.name,
        query: balanceQuery.query,
        value: 0,
      }) as unknown as Binding<'balance', `balance-query-${string}`>,
    [balanceQuery.name, balanceQuery.query],
  );

  // Next month statement binding
  const nextMonthBinding = useMemo(
    () =>
      ({
        name: `${balanceQuery.name}-next-month`,
        query: balanceQuery.query.filter({
          $or: [
            {
              charge_date: {
                $gte: startOfNextMonth,
                $lte: endOfNextMonth,
              },
            },
            {
              $and: [
                { charge_date: null },
                {
                  date: {
                    $gte: startOfNextMonth,
                    $lte: endOfNextMonth,
                  },
                },
              ],
            },
          ],
        }),
        value: 0,
      }) as unknown as Binding<'balance', `balance-query-${string}`>,
    [balanceQuery.name, balanceQuery.query, startOfNextMonth, endOfNextMonth],
  );

  // Current month statement binding
  const currentMonthBinding = useMemo(
    () =>
      ({
        name: `${balanceQuery.name}-current-month`,
        query: balanceQuery.query.filter({
          $or: [
            {
              charge_date: {
                $gte: startOfCurrentMonth,
                $lte: endOfCurrentMonth,
              },
            },
            {
              $and: [
                { charge_date: null },
                {
                  date: {
                    $gte: startOfCurrentMonth,
                    $lte: endOfCurrentMonth,
                  },
                },
              ],
            },
          ],
        }),
        value: 0,
      }) as unknown as Binding<'balance', `balance-query-${string}`>,
    [
      balanceQuery.name,
      balanceQuery.query,
      startOfCurrentMonth,
      endOfCurrentMonth,
    ],
  );

  const totalBalance = useSheetValue<'balance', `balance-query-${string}`>(
    totalBalanceBinding,
  );

  const nextMonthBill = useSheetValue<
    'balance',
    `balance-query-${string}-next-month`
  >(
    nextMonthBinding as unknown as Binding<
      'balance',
      `balance-query-${string}-next-month`
    >,
  );

  const currentMonthBill = useSheetValue<
    'balance',
    `balance-query-${string}-current-month`
  >(
    currentMonthBinding as unknown as Binding<
      'balance',
      `balance-query-${string}-current-month`
    >,
  );

  // Future remaining installments beyond next month
  const futureInstallments = useSheetValue<
    'balance',
    `balance-query-${string}-future`
  >({
    name: `${balanceQuery.name}-future` as `balance-query-${string}-future`,
    query: balanceQuery.query.filter({
      $or: [
        { charge_date: { $gt: endOfNextMonth } },
        {
          $and: [{ charge_date: null }, { date: { $gt: endOfNextMonth } }],
        },
      ],
    }),
  });

  // Calculate matching totals directly from transactions for 100% exact parity with table separators
  const calculatedTotals = useMemo(() => {
    if (!transactions || transactions.length === 0) {
      return null;
    }

    let nextSum = 0;
    let currentSum = 0;
    let futureSum = 0;

    for (const trans of transactions) {
      if (!trans.is_child) {
        const transDate = trans.charge_date || trans.date;
        if (transDate) {
          const month = transDate.slice(0, 7);
          if (month === nextMonth) {
            nextSum += trans.amount || 0;
          } else if (month === currentMonth) {
            currentSum += trans.amount || 0;
          } else if (month > nextMonth) {
            futureSum += trans.amount || 0;
          }
        }
      }
    }

    return {
      nextMonth: nextSum,
      currentMonth: currentSum,
      futureInstallments: futureSum,
    };
  }, [transactions, nextMonth, currentMonth]);

  const effectiveNextMonthBill =
    calculatedTotals != null ? calculatedTotals.nextMonth : nextMonthBill;
  const effectiveCurrentMonthBill =
    calculatedTotals != null ? calculatedTotals.currentMonth : currentMonthBill;
  const effectiveFutureInstallments =
    calculatedTotals != null
      ? calculatedTotals.futureInstallments
      : futureInstallments;

  // Uncleared charges
  const uncleared = useSheetValue<
    'balance',
    `balance-query-${string}-uncleared`
  >({
    name: `${balanceQuery.name}-uncleared` as `balance-query-${string}-uncleared`,
    query: balanceQuery.query.filter({ cleared: false }),
  });

  const nextMonthLabel = useMemo(() => {
    return monthUtils.format(`${nextMonth}-01`, 'MMM yyyy', locale);
  }, [nextMonth, locale]);

  const currentMonthLabel = useMemo(() => {
    return monthUtils.format(`${currentMonth}-01`, 'MMM yyyy', locale);
  }, [currentMonth, locale]);

  const setPrimary = (view: string) => {
    setPrimaryView(view);
    setPrimaryBalanceViewPref(view);
  };

  const onTogglePrimaryBalance = () => {
    let next = 'total';
    if (primaryView === 'next-month') {
      next = 'total';
    } else if (primaryView === 'total') {
      next =
        effectiveCurrentMonthBill && effectiveCurrentMonthBill !== 0
          ? 'current-month'
          : 'next-month';
    } else {
      next = 'next-month';
    }
    setPrimary(next);
  };

  let primaryLabel = t('Next month ({{month}})', { month: nextMonthLabel });
  let primaryValue: number | null | undefined = effectiveNextMonthBill;

  if (primaryView === 'total') {
    primaryLabel = t('Total balance');
    primaryValue = totalBalance;
  } else if (primaryView === 'current-month') {
    primaryLabel = t('This month ({{month}})', { month: currentMonthLabel });
    primaryValue = effectiveCurrentMonthBill;
  }

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
          minWidth: 180,
        }}
      >
        <Button
          data-testid="account-balance"
          variant="bare"
          aria-label={t('Switch balance view')}
          onPress={onTogglePrimaryBalance}
          style={{
            paddingTop: 1,
            paddingBottom: 1,
            flexDirection: 'row',
            alignItems: 'center',
            minWidth: 150,
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
            {primaryView === 'total' ? (
              <CellValue binding={totalBalanceBinding} type="financial">
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
            ) : (
              <PrivacyFilter>
                <FinancialText
                  style={{
                    fontSize: 22,
                    fontWeight: 400,
                    whiteSpace: 'nowrap',
                    color:
                      (primaryValue ?? 0) < 0
                        ? theme.numberNegative
                        : (primaryValue ?? 0) > 0
                          ? theme.numberPositive
                          : theme.pageTextSubdued,
                  }}
                >
                  {format(primaryValue ?? 0, 'financial')}
                </FinancialText>
              </PrivacyFilter>
            )}
          </View>
        </Button>

        <Button
          variant="bare"
          aria-label={t('Switch balance view')}
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

      {/* Next month statement / bill due (when not primary) */}
      {primaryView !== 'next-month' && effectiveNextMonthBill != null && (
        <DetailedBalance
          name={t('Next month ({{month}}):', { month: nextMonthLabel })}
          balance={effectiveNextMonthBill}
          onPress={() => setPrimary('next-month')}
        />
      )}

      {/* Total balance (when not primary) */}
      {primaryView !== 'total' && totalBalance != null && (
        <DetailedBalance
          name={t('Total balance:')}
          balance={totalBalance}
          onPress={() => setPrimary('total')}
        />
      )}

      {/* Current month statement if different from 0 (when not primary) */}
      {primaryView !== 'current-month' &&
        effectiveCurrentMonthBill != null &&
        effectiveCurrentMonthBill !== 0 && (
          <DetailedBalance
            name={t('This month ({{month}}):', { month: currentMonthLabel })}
            balance={effectiveCurrentMonthBill}
            onPress={() => setPrimary('current-month')}
          />
        )}

      {/* Future installments beyond next month */}
      {effectiveFutureInstallments != null &&
        effectiveFutureInstallments !== 0 && (
          <DetailedBalance
            name={t('Future installments:')}
            balance={effectiveFutureInstallments}
          />
        )}

      {/* Uncleared total if not 0 */}
      {uncleared != null && uncleared !== 0 && (
        <DetailedBalance name={t('Uncleared:')} balance={uncleared} />
      )}

      {selectedItems.size > 0 && (
        <SelectedBalance selectedItems={selectedItems} account={account} />
      )}
      {isFiltered && <FilteredBalance filteredAmount={filteredAmount} />}
    </View>
  );
}
