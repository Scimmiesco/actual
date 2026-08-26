import { Fragment, useRef, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { SvgDotsHorizontalTriple } from '@actual-app/components/icons/v1';
import { Menu } from '@actual-app/components/menu';
import { Popover } from '@actual-app/components/popover';

import { FinancialText } from '#components/FinancialText';
import { useFormat } from '#hooks/useFormat';

import type { ScheduledCashFlowOccurrence } from './scheduledCashFlowChartData';

type ScheduledCashFlowTableProps = {
  occurrences: ScheduledCashFlowOccurrence[];
};

export function ScheduledCashFlowTable({
  occurrences,
}: ScheduledCashFlowTableProps) {
  const { t } = useTranslation();
  const format = useFormat();
  const menuRef = useRef<HTMLButtonElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [groupByDay, setGroupByDay] = useState(false);

  const groupedOccurrences = groupByDay
    ? occurrences.reduce<Map<string, ScheduledCashFlowOccurrence[]>>(
        (groups, occurrence) => {
          const group = groups.get(occurrence.date) ?? [];
          group.push(occurrence);
          groups.set(occurrence.date, group);
          return groups;
        },
        new Map(),
      )
    : null;

  function renderOccurrence(
    occurrence: ScheduledCashFlowOccurrence,
    index: number,
  ) {
    return (
      <tr
        key={`${occurrence.date}-${occurrence.accountId}-${occurrence.scheduleName}-${index}`}
      >
        <td>{groupByDay ? null : occurrence.date}</td>
        <td>{occurrence.accountName}</td>
        <td>{occurrence.payee}</td>
        <td>{occurrence.categoryName}</td>
        <td style={{ textAlign: 'right' }}>
          <FinancialText>
            {format(occurrence.amount, 'financial')}
          </FinancialText>
        </td>
        <td />
      </tr>
    );
  }

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
            <th style={{ width: 32, textAlign: 'right' }}>
              <Button
                ref={menuRef}
                variant="bare"
                aria-label={t('Table options')}
                onPress={() => setMenuOpen(true)}
                style={{ padding: 2 }}
              >
                <SvgDotsHorizontalTriple width={15} height={15} />
              </Button>
              <Popover
                triggerRef={menuRef}
                placement="bottom end"
                isOpen={menuOpen}
                onOpenChange={setMenuOpen}
              >
                <Menu
                  onMenuSelect={item => {
                    if (item === 'group-by-day') {
                      setGroupByDay(value => !value);
                    }
                    setMenuOpen(false);
                  }}
                  items={[
                    {
                      name: 'group-by-day',
                      text: t('Group by day'),
                      toggle: groupByDay,
                    },
                  ]}
                />
              </Popover>
            </th>
          </tr>
        </thead>
        <tbody>
          {groupedOccurrences
            ? [...groupedOccurrences.entries()].map(
                ([date, dateOccurrences]) => (
                  <Fragment key={`group-${date}`}>
                    <tr>
                      <th colSpan={6} style={{ textAlign: 'left' }}>
                        {date}
                      </th>
                    </tr>
                    {dateOccurrences.map(renderOccurrence)}
                  </Fragment>
                ),
              )
            : occurrences.map(renderOccurrence)}
        </tbody>
      </table>
    </div>
  );
}
