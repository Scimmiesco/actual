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

  return (
    <View
      style={{
        display: 'flex',
        flexDirection: 'row',
        gap: 16,
        margin: '0 20px 16px',
      }}
    >
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
    <View style={{ flex: 1, minWidth: 0 }}>
      <Block
        style={{
          ...styles.smallText,
          color,
          fontWeight: 600,
          marginBottom: 6,
        }}
      >
        {title}
      </Block>
      <View style={{ maxHeight: 100, overflowY: 'auto' }}>
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
                <FinancialText style={{ color }}>
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
            <FinancialText style={{ color, fontWeight: 600 }}>
              {format(total, 'financial')}
            </FinancialText>
          }
        />
      )}
    </View>
  );
}
