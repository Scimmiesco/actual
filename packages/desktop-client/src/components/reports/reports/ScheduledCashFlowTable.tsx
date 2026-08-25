import { Trans } from 'react-i18next';

import { FinancialText } from '#components/FinancialText';
import { useFormat } from '#hooks/useFormat';

import type { ScheduledCashFlowOccurrence } from './scheduledCashFlowChartData';

type ScheduledCashFlowTableProps = {
  occurrences: ScheduledCashFlowOccurrence[];
};

export function ScheduledCashFlowTable({
  occurrences,
}: ScheduledCashFlowTableProps) {
  const format = useFormat();

  return (
    <div style={{ overflowX: 'auto', marginTop: 24 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ textAlign: 'left' }}>
            <th>
              <Trans>Date</Trans>
            </th>
            <th>
              <Trans>Account</Trans>
            </th>
            <th>
              <Trans>Payee</Trans>
            </th>
            <th>
              <Trans>Category</Trans>
            </th>
            <th style={{ textAlign: 'right' }}>
              <Trans>Amount</Trans>
            </th>
          </tr>
        </thead>
        <tbody>
          {occurrences.map((occurrence, index) => (
            <tr
              key={`${occurrence.date}-${occurrence.accountId}-${occurrence.scheduleName}-${index}`}
            >
              <td>{occurrence.date}</td>
              <td>{occurrence.accountName}</td>
              <td>{occurrence.payee}</td>
              <td>{occurrence.categoryName}</td>
              <td style={{ textAlign: 'right' }}>
                <FinancialText>
                  {format(occurrence.amount, 'financial')}
                </FinancialText>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
