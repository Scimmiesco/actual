import React, { Fragment, useRef, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { SvgDotsHorizontalTriple } from '@actual-app/components/icons/v1';
import { Menu } from '@actual-app/components/menu';
import { Popover } from '@actual-app/components/popover';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';

import { FinancialText } from '#components/FinancialText';
import { Field, Row, TableHeader } from '#components/table';
import { useFormat } from '#hooks/useFormat';

import type { ScheduledCashFlowOccurrence } from './scheduledCashFlowChartData';

type ScheduledCashFlowTableProps = {
  occurrences: ScheduledCashFlowOccurrence[];
};

export const ROW_HEIGHT = 32;

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
      <Row
        key={`${occurrence.date}-${occurrence.accountId}-${occurrence.scheduleName}-${index}`}
        height={ROW_HEIGHT}
        inset={15}
        style={{
          color: theme.tableText,
          backgroundColor:
            index % 2 === 0
              ? theme.tableBackground
              : theme.tableRowBackgroundAlternate,
          ':hover': { backgroundColor: theme.tableRowBackgroundHover },
        }}
      >
        {!groupByDay && <Field width={110}>{occurrence.date}</Field>}
        <Field width="flex">{occurrence.accountName}</Field>
        <Field width="flex">{occurrence.payee}</Field>
        <Field width="flex">{occurrence.categoryName}</Field>
        <Field width={120} style={{ textAlign: 'right', padding: '0 5px' }}>
          <FinancialText>
            {format(occurrence.amount, 'financial')}
          </FinancialText>
        </Field>
        <Field width={32} />
      </Row>
    );
  }

  return (
    <View
      style={{
        flexShrink: 0,
        width: '100%',
        marginTop: 24,
        border: `1px solid ${theme.tableBorder}`,
        borderRadius: 4,
        backgroundColor: theme.tableBackground,
        overflow: 'hidden',
      }}
    >
      <TableHeader height={ROW_HEIGHT} inset={15}>
        {!groupByDay && (
          <Field width={110}>
            <Trans>Date</Trans>
          </Field>
        )}
        <Field width="flex">
          <Trans>Account</Trans>
        </Field>
        <Field width="flex">
          <Trans>Payee</Trans>
        </Field>
        <Field width="flex">
          <Trans>Category</Trans>
        </Field>
        <Field width={120} style={{ textAlign: 'right' }}>
          <Trans>Amount</Trans>
        </Field>
        <Field width={32} style={{ textAlign: 'right' }}>
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
        </Field>
      </TableHeader>

      <View style={{ overflowY: 'auto', maxHeight: 400 }}>
        {occurrences.length === 0 ? (
          <Row height={ROW_HEIGHT} inset={15}>
            <Field
              width="flex"
              style={{
                color: theme.tableTextSubdued,
                textAlign: 'center',
                fontStyle: 'italic',
              }}
            >
              <Trans>No scheduled transactions found</Trans>
            </Field>
          </Row>
        ) : groupedOccurrences ? (
          [...groupedOccurrences.entries()].map(([date, dateOccurrences]) => (
            <Fragment key={`group-${date}`}>
              <Row
                height={ROW_HEIGHT}
                inset={15}
                style={{
                  backgroundColor: theme.tableRowBackgroundHighlight,
                  fontWeight: 600,
                }}
              >
                <Field
                  width="flex"
                  style={{ fontWeight: 600, color: theme.tableText }}
                >
                  {date}
                </Field>
              </Row>
              {dateOccurrences.map(renderOccurrence)}
            </Fragment>
          ))
        ) : (
          occurrences.map(renderOccurrence)
        )}
      </View>
    </View>
  );
}
