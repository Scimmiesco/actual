import type { ReactNode } from 'react';
import { Trans } from 'react-i18next';

import { AlignedText } from '@actual-app/components/aligned-text';
import { Block } from '@actual-app/components/block';
import { styles } from '@actual-app/components/styles';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';

import { FinancialText } from '#components/FinancialText';
import { useFormat } from '#hooks/useFormat';

import type { ScheduledCashFlowAccountSummary } from './scheduledCashFlowChartData';

type ScheduledCashFlowAccountBreakdownProps = {
  accounts: ScheduledCashFlowAccountSummary[];
};

export function ScheduledCashFlowAccountBreakdown({
  accounts,
}: ScheduledCashFlowAccountBreakdownProps) {
  const format = useFormat();
  const incomeAccounts = accounts.filter(account => account.income > 0);
  const expenseAccounts = accounts.filter(account => account.expenses < 0);
  const totalIncome = incomeAccounts.reduce(
    (sum, account) => sum + account.income,
    0,
  );
  const totalExpenses = expenseAccounts.reduce(
    (sum, account) => sum + Math.abs(account.expenses),
    0,
  );
  const total = totalIncome + totalExpenses;
  const net = totalIncome - totalExpenses;

  return (
    <View
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        margin: '0 20px 16px',
        overflowX: 'auto',
        position: 'relative',
      }}
    >
      <View style={{ position: 'absolute', left: 20, right: 20 }}>
        <View
          style={{
            flexDirection: 'row',
            height: 6,
            borderRadius: 3,
            overflow: 'hidden',
            backgroundColor: theme.tableBorder,
          }}
        >
          {total > 0 && (
            <View
              style={{
                width: `${(totalIncome / total) * 100}%`,
                backgroundColor: theme.numberPositive,
              }}
            />
          )}
          {total > 0 && (
            <View
              style={{
                width: `${(totalExpenses / total) * 100}%`,
                backgroundColor: theme.numberNegative,
              }}
            />
          )}
        </View>
      </View>
      <View style={{ width: '100%', marginTop: 10, marginBottom: 12 }}>
        <AlignedText
          left={<Trans>Incoming</Trans>}
          right={
            <FinancialText style={{ color: theme.numberPositive }}>
              {format(totalIncome, 'financial')}
            </FinancialText>
          }
        />
        <AlignedText
          left={<Trans>Outgoing</Trans>}
          right={
            <FinancialText style={{ color: theme.numberNegative }}>
              {format(totalExpenses, 'financial')}
            </FinancialText>
          }
        />
        <AlignedText
          left={<Trans>Net change</Trans>}
          right={
            <FinancialText
              style={{
                color: net >= 0 ? theme.numberPositive : theme.numberNegative,
                fontWeight: 600,
              }}
            >
              {format(net, 'financial')}
            </FinancialText>
          }
        />
      </View>
      <View style={{ flexDirection: 'row', gap: 16, minWidth: 360 }}>
        <AccountGroup
          accounts={incomeAccounts}
          color={theme.numberPositive}
          format={format}
          title={<Trans>Income accounts</Trans>}
          value={account => account.income}
          emptyLabel={<Trans>No income scheduled</Trans>}
        />
        <AccountGroup
          accounts={expenseAccounts}
          color={theme.numberNegative}
          format={format}
          title={<Trans>Expense accounts</Trans>}
          value={account => Math.abs(account.expenses)}
          emptyLabel={<Trans>No expenses scheduled</Trans>}
        />
      </View>
    </View>
  );
}

type AccountGroupProps = {
  accounts: ScheduledCashFlowAccountSummary[];
  color: string;
  format: ReturnType<typeof useFormat>;
  title: ReactNode;
  value: (account: ScheduledCashFlowAccountSummary) => number;
  emptyLabel: ReactNode;
};

function AccountGroup({
  accounts,
  color,
  format,
  title,
  value,
  emptyLabel,
}: AccountGroupProps) {
  const total = accounts.reduce((sum, account) => sum + value(account), 0);

  return (
    <View style={{ flex: 1, minWidth: 172 }}>
      <Block
        style={{
          ...styles.smallText,
          color,
          fontWeight: 600,
          marginBottom: 6,
          whiteSpace: 'nowrap',
        }}
      >
        {title}
      </Block>
      <View>
        {accounts.length === 0 ? (
          <Block style={{ ...styles.smallText, color: theme.pageTextLight }}>
            {emptyLabel}
          </Block>
        ) : (
          accounts.map(account => (
            <AlignedText
              key={account.accountId}
              left={
                <Block
                  style={{
                    ...styles.smallText,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {account.accountName}
                </Block>
              }
              right={
                <FinancialText style={{ color, whiteSpace: 'nowrap' }}>
                  {format(value(account), 'financial')}
                </FinancialText>
              }
            />
          ))
        )}
      </View>
      {accounts.length > 0 && (
        <AlignedText
          style={{ borderTop: `1px solid ${theme.tableBorder}`, marginTop: 4 }}
          left={
            <Block style={{ ...styles.smallText, fontWeight: 600 }}>
              <Trans>Total</Trans>
            </Block>
          }
          right={
            <FinancialText
              style={{ color, fontWeight: 600, whiteSpace: 'nowrap' }}
            >
              {format(total, 'financial')}
            </FinancialText>
          }
        />
      )}
    </View>
  );
}
