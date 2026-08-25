// @ts-strict-ignore
import { useMemo, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import {
  SvgArrowDown,
  SvgArrowUp,
  SvgDotsHorizontalTriple,
} from '@actual-app/components/icons/v1';
import { SvgCheck } from '@actual-app/components/icons/v2';
import { styles } from '@actual-app/components/styles';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import { send } from '@actual-app/core/platform/client/connection';
import {
  currentDay as monthUtilCurrentDay,
  differenceInCalendarDays as monthUtilDifferenceInCalendarDays,
  format as monthUtilFormat,
} from '@actual-app/core/shared/months';
import { getNormalisedString } from '@actual-app/core/shared/normalisation';
import { getScheduledAmount } from '@actual-app/core/shared/schedules';
import type { ScheduleStatuses } from '@actual-app/core/shared/schedules';
import type { ScheduleEntity } from '@actual-app/core/types/models';

import { FinancialText } from '#components/FinancialText';
import { PrivacyFilter } from '#components/PrivacyFilter';
import { Cell, Field, Row, Table, TableHeader } from '#components/table';
import { DisplayId } from '#components/util/DisplayId';
import { GenericInput } from '#components/util/GenericInput';
import { useAccounts } from '#hooks/useAccounts';
import { useCategories } from '#hooks/useCategories';
import { useContextMenu } from '#hooks/useContextMenu';
import { useDateFormat } from '#hooks/useDateFormat';
import { useFormat } from '#hooks/useFormat';
import { usePayees } from '#hooks/usePayees';

import { StatusBadge } from './StatusBadge';
type SchedulesTableProps = {
  isLoading?: boolean;
  schedules: readonly ScheduleEntity[];
  statuses: ScheduleStatuses;
  filter: string;
  allowCompleted: boolean;
  onSelect: (id: ScheduleEntity['id']) => void;
  style: CSSProperties;
  tableStyle?: CSSProperties;
} & (
  | {
      minimal: true;
      onAction?: never;
    }
  | {
      minimal?: false;
      onAction: (
        actionName: ScheduleItemAction,
        id: ScheduleEntity['id'],
      ) => void;
    }
);

type CompletedScheduleItem = { id: 'show-completed' };
type SchedulesTableItem = ScheduleEntity | CompletedScheduleItem;

type SortKey =
  | 'name'
  | 'payee'
  | 'account'
  | 'category'
  | 'date'
  | 'days'
  | 'status'
  | 'amount';
type SortDirection = 'asc' | 'desc';
type SortState = { key: SortKey; direction: SortDirection };

export type ScheduleItemAction =
  | 'post-transaction'
  | 'post-transaction-today'
  | 'skip'
  | 'complete'
  | 'restart'
  | 'delete';

export const ROW_HEIGHT = 43;

function getDaysUntil(date: string | null) {
  return date == null
    ? null
    : monthUtilDifferenceInCalendarDays(date, monthUtilCurrentDay());
}

function ScheduleDaysCell({ date }: { date: string | null }) {
  const days = getDaysUntil(date);

  if (days == null) {
    return null;
  }
  if (days === 0) {
    return <Trans>Today</Trans>;
  }
  if (days < 0) {
    return (
      <Trans count={Math.abs(days)}>
        {{ count: Math.abs(days) }} days overdue
      </Trans>
    );
  }
  return <Trans count={days}>{{ count: days }} days</Trans>;
}

function getScheduleCategory(schedule: ScheduleEntity) {
  const action = schedule._actions?.find(
    action => action.op === 'set' && action.field === 'category',
  );
  return action?.value ? String(action.value) : '';
}

function SortableHeader({
  label,
  width,
  sort,
  sortKey,
  onSort,
  style,
}: {
  label: ReactNode;
  width: CSSProperties['width'];
  sort: SortState | null;
  sortKey: SortKey;
  onSort: (key: SortKey) => void;
  style?: CSSProperties;
}) {
  const isSorted = sort?.key === sortKey;

  return (
    <Field
      width={width}
      truncate={false}
      onClick={() => onSort(sortKey)}
      aria-sort={
        isSorted
          ? sort.direction === 'asc'
            ? 'ascending'
            : 'descending'
          : 'none'
      }
      style={{ cursor: 'pointer', ...style }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        {label}
        {isSorted &&
          (sort.direction === 'asc' ? (
            <SvgArrowUp width={10} height={10} />
          ) : (
            <SvgArrowDown width={10} height={10} />
          ))}
      </View>
    </Field>
  );
}

export function ScheduleAmountCell({
  amount,
  op,
}: {
  amount: ScheduleEntity['_amount'];
  op: ScheduleEntity['_amountOp'];
}) {
  const { t } = useTranslation();
  const format = useFormat();

  const num = getScheduledAmount(amount);
  const currencyAmount = format(Math.abs(num || 0), 'financial');
  const isApprox = op === 'isapprox';
  const isBetween = op === 'isbetween';
  let cellText = '';
  if (isApprox) {
    cellText = t('Approximately {{currencyAmount}}', {
      currencyAmount,
    });
  } else if (isBetween && typeof amount != 'number') {
    cellText = t('{{currency1}} to {{currency2}}', {
      currency1: format(Math.abs(amount.num1 || 0), 'financial'),
      currency2: format(Math.abs(amount.num2 || 0), 'financial'),
    });
  } else {
    cellText = currencyAmount;
  }
  return (
    <Cell
      width={100}
      plain
      style={{
        textAlign: 'right',
        flexDirection: 'row',
        alignItems: 'center',
        padding: '0 5px',
      }}
      name="amount"
    >
      {isApprox && (
        <View
          style={{
            textAlign: 'left',
            color: theme.pageTextSubdued,
            lineHeight: '1em',
            marginRight: 10,
          }}
          title={cellText}
        >
          ~
        </View>
      )}
      {isBetween && (
        <View
          style={{
            textAlign: 'left',
            color: theme.pageTextSubdued,
            lineHeight: '1em',
            marginRight: 10,
          }}
          title={cellText}
        >
          ±
        </View>
      )}
      <FinancialText
        style={{
          flex: 1,
          color: num > 0 ? theme.noticeTextLight : theme.tableText,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
        title={cellText}
      >
        <PrivacyFilter>
          {num > 0 ? `+${currencyAmount}` : `${currencyAmount}`}
        </PrivacyFilter>
      </FinancialText>
    </Cell>
  );
}

function ScheduleRow({
  schedule,
  onAction,
  onSelect,
  minimal,
  statuses,
  dateFormat,
  onCategoryChange,
}: {
  schedule: ScheduleEntity;
  dateFormat: string;
} & Pick<
  SchedulesTableProps,
  'onSelect' | 'onAction' | 'minimal' | 'statuses'
> & {
    onCategoryChange: (
      schedule: ScheduleEntity,
      categoryId: string | null,
    ) => Promise<void>;
  }) {
  const { t } = useTranslation();

  const rowRef = useRef(null);
  const buttonRef = useRef(null);

  const status = statuses.get(schedule.id);
  useContextMenu({
    triggerRef: rowRef,
    items: !minimal
      ? [
          {
            name: 'post-transaction',
            text: t('Post transaction'),
            onClick: () => onAction('post-transaction', schedule.id),
          },
          {
            name: 'post-transaction-today',
            text: t('Post transaction today'),
            onClick: () => onAction('post-transaction-today', schedule.id),
          },
          {
            name: 'restart',
            text: t('Restart'),
            onClick: () => onAction('restart', schedule.id),
            hidden: status !== 'completed',
          },
          {
            name: 'skip',
            text: t('Skip next scheduled date'),
            onClick: () => onAction('skip', schedule.id),
            hidden: status === 'completed',
          },
          {
            name: 'complete',
            text: t('Complete'),
            onClick: () => onAction('complete', schedule.id),
            hidden: status === 'completed',
          },
          {
            name: 'delete',
            text: t('Delete'),
            onClick: () => onAction('delete', schedule.id),
          },
        ]
      : [],
  });

  return (
    <Row
      ref={rowRef}
      height={ROW_HEIGHT}
      inset={15}
      onClick={() => onSelect(schedule.id)}
      style={{
        cursor: 'pointer',
        backgroundColor: theme.tableBackground,
        color: theme.tableText,
        ':hover': { backgroundColor: theme.tableRowBackgroundHover },
      }}
    >
      <Field width="flex" name="name">
        <Text
          style={
            schedule.name == null
              ? { color: theme.buttonNormalDisabledText }
              : null
          }
          title={schedule.name ? schedule.name : ''}
        >
          {schedule.name ? schedule.name : t('None')}
        </Text>
      </Field>
      <Field width="flex" name="payee">
        <DisplayId type="payees" id={schedule._payee} />
      </Field>
      <Field width="flex" name="account">
        <DisplayId type="accounts" id={schedule._account} />
      </Field>
      <Field
        width="flex"
        name="category"
        truncate={false}
        onClick={event => event.stopPropagation()}
      >
        <GenericInput
          type="id"
          field="category"
          value={getScheduleCategory(schedule)}
          onChange={category =>
            void onCategoryChange(schedule, category || null)
          }
          inputStyle={{
            border: 'none',
            backgroundColor: 'transparent',
            padding: '0 5px',
            width: '100%',
          }}
        />
      </Field>
      <Field width={110} name="date">
        {schedule.next_date
          ? monthUtilFormat(schedule.next_date, dateFormat)
          : null}
      </Field>
      <Field width={70} name="days" style={{ textAlign: 'center' }}>
        <ScheduleDaysCell date={schedule.next_date} />
      </Field>
      <Field width={120} name="status" style={{ alignItems: 'flex-start' }}>
        <StatusBadge status={statuses.get(schedule.id)} />
      </Field>
      <ScheduleAmountCell amount={schedule._amount} op={schedule._amountOp} />
      {!minimal && (
        <Field width={80} style={{ textAlign: 'center' }}>
          {schedule._date &&
            typeof schedule._date === 'object' &&
            schedule._date.frequency && (
              <SvgCheck style={{ width: 13, height: 13 }} />
            )}
        </Field>
      )}
      {!minimal && (
        <Field width={40} name="actions">
          <View>
            <Button
              ref={buttonRef}
              variant="bare"
              aria-label={t('Menu')}
              onPress={() => {
                if (rowRef.current) {
                  const rect = buttonRef.current?.getBoundingClientRect();
                  const clientX = rect ? rect.left : 0;
                  const clientY = rect ? rect.bottom : 0;
                  (rowRef.current as HTMLElement).dispatchEvent(
                    new MouseEvent('contextmenu', {
                      bubbles: true,
                      clientX,
                      clientY,
                    }),
                  );
                }
              }}
            >
              <SvgDotsHorizontalTriple
                width={15}
                height={15}
                style={{ transform: 'rotateZ(90deg)' }}
              />
            </Button>
          </View>
        </Field>
      )}
    </Row>
  );
}

export function SchedulesTable({
  isLoading,
  schedules,
  statuses,
  filter,
  minimal,
  allowCompleted,
  style,
  onSelect,
  onAction,
  tableStyle,
}: SchedulesTableProps) {
  const { t } = useTranslation();
  const format = useFormat();

  const dateFormat = useDateFormat() || 'MM/dd/yyyy';
  const [showCompleted, setShowCompleted] = useState(false);
  const [sort, setSort] = useState<SortState | null>(null);

  const { data: payees } = usePayees();
  const { data: accounts = [] } = useAccounts();
  const { data: { list: categories = [] } = {} } = useCategories();

  const filteredSchedules = useMemo(() => {
    const filterIncludes = (str: string) =>
      str
        ? getNormalisedString(str).includes(getNormalisedString(filter)) ||
          getNormalisedString(filter).includes(getNormalisedString(str))
        : false;

    const matchingSchedules = filter
      ? schedules.filter(schedule => {
          const payee = payees.find(p => schedule._payee === p.id);
          const account = accounts.find(a => schedule._account === a.id);
          const category = categories.find(
            c => c.id === getScheduleCategory(schedule),
          );
          const amount = getScheduledAmount(schedule._amount);
          let amountStr = '';
          if (schedule._amountOp === 'isbetween') {
            amountStr = '±';
          } else if (schedule._amountOp === 'isapprox') {
            amountStr = '~';
          }
          amountStr +=
            (amount > 0 ? '+' : '') +
            format(Math.abs(amount || 0), 'financial');
          const dateStr = schedule.next_date
            ? monthUtilFormat(schedule.next_date, dateFormat)
            : null;

          return (
            filterIncludes(schedule.name) ||
            filterIncludes(payee && payee.name) ||
            filterIncludes(account && account.name) ||
            filterIncludes(category && category.name) ||
            filterIncludes(amountStr) ||
            filterIncludes(statuses.get(schedule.id)) ||
            filterIncludes(dateStr)
          );
        })
      : schedules;

    if (!sort) {
      return matchingSchedules;
    }

    const payeeNames = new Map(payees.map(payee => [payee.id, payee.name]));
    const accountNames = new Map(
      accounts.map(account => [account.id, account.name]),
    );
    const categoryNames = new Map(
      categories.map(category => [category.id, category.name]),
    );

    function getValue(schedule: ScheduleEntity) {
      switch (sort.key) {
        case 'name':
          return getNormalisedString(schedule.name ?? '');
        case 'payee':
          return getNormalisedString(payeeNames.get(schedule._payee) ?? '');
        case 'account':
          return getNormalisedString(accountNames.get(schedule._account) ?? '');
        case 'category':
          return getNormalisedString(
            categoryNames.get(getScheduleCategory(schedule)) ?? '',
          );
        case 'date':
          return schedule.next_date ?? '';
        case 'days':
          return getDaysUntil(schedule.next_date) ?? Number.MAX_SAFE_INTEGER;
        case 'status':
          return statuses.get(schedule.id) ?? '';
        case 'amount':
          return getScheduledAmount(schedule._amount);
        default:
          return '';
      }
    }

    return [...matchingSchedules].sort((a, b) => {
      const aValue = getValue(a);
      const bValue = getValue(b);
      const comparison =
        typeof aValue === 'number' && typeof bValue === 'number'
          ? aValue - bValue
          : String(aValue).localeCompare(String(bValue));
      return sort.direction === 'asc' ? comparison : -comparison;
    });
  }, [
    payees,
    accounts,
    categories,
    schedules,
    filter,
    statuses,
    format,
    dateFormat,
    sort,
  ]);

  async function onCategoryChange(
    schedule: ScheduleEntity,
    categoryId: string | null,
  ) {
    if (!schedule.rule) {
      return;
    }

    const rule = await send('rule-get', { id: schedule.rule });
    if (!rule) {
      return;
    }

    const actions = rule.actions.filter(
      action => !(action.op === 'set' && action.field === 'category'),
    );
    if (categoryId) {
      actions.push({ op: 'set', field: 'category', value: categoryId });
    }

    await send('rule-update', { ...rule, actions });
  }

  function onSort(key: SortKey) {
    setSort(current =>
      current?.key === key
        ? {
            key,
            direction: current.direction === 'asc' ? 'desc' : 'asc',
          }
        : { key, direction: 'asc' },
    );
  }

  const items: readonly SchedulesTableItem[] = useMemo(() => {
    const unCompletedSchedules = filteredSchedules.filter(s => !s.completed);

    if (!allowCompleted) {
      return unCompletedSchedules;
    }
    if (showCompleted) {
      return filteredSchedules;
    }

    const hasCompletedSchedule = filteredSchedules.find(s => s.completed);

    if (!hasCompletedSchedule) return unCompletedSchedules;

    return [...unCompletedSchedules, { id: 'show-completed' }];
  }, [filteredSchedules, showCompleted, allowCompleted]);

  function renderItem({ item }: { item: SchedulesTableItem }) {
    if (item.id === 'show-completed') {
      return (
        <Row
          height={ROW_HEIGHT}
          inset={15}
          style={{
            cursor: 'pointer',
            backgroundColor: 'transparent',
            ':hover': { backgroundColor: theme.tableRowBackgroundHover },
          }}
          onClick={() => setShowCompleted(true)}
        >
          <Field
            width="flex"
            style={{
              fontStyle: 'italic',
              textAlign: 'center',
              color: theme.tableText,
            }}
          >
            <Trans>Show completed schedules</Trans>
          </Field>
        </Row>
      );
    }
    return (
      <ScheduleRow
        schedule={item as ScheduleEntity}
        {...{ statuses, dateFormat, onSelect, onAction, minimal }}
        onCategoryChange={onCategoryChange}
      />
    );
  }

  return (
    <View style={{ ...styles.tableContainer, ...tableStyle }}>
      <TableHeader height={ROW_HEIGHT} inset={15}>
        <SortableHeader
          width="flex"
          label={<Trans>Name</Trans>}
          sort={sort}
          sortKey="name"
          onSort={onSort}
        />
        <SortableHeader
          width="flex"
          label={<Trans>Payee</Trans>}
          sort={sort}
          sortKey="payee"
          onSort={onSort}
        />
        <SortableHeader
          width="flex"
          label={<Trans>Account</Trans>}
          sort={sort}
          sortKey="account"
          onSort={onSort}
        />
        <SortableHeader
          width="flex"
          label={<Trans>Category</Trans>}
          sort={sort}
          sortKey="category"
          onSort={onSort}
        />
        <SortableHeader
          width={110}
          label={<Trans>Next date</Trans>}
          sort={sort}
          sortKey="date"
          onSort={onSort}
        />
        <SortableHeader
          width={70}
          label={<Trans>Days</Trans>}
          sort={sort}
          sortKey="days"
          onSort={onSort}
          style={{ textAlign: 'center' }}
        />
        <SortableHeader
          width={120}
          label={<Trans>Status</Trans>}
          sort={sort}
          sortKey="status"
          onSort={onSort}
        />
        <SortableHeader
          width={100}
          label={<Trans>Amount</Trans>}
          sort={sort}
          sortKey="amount"
          onSort={onSort}
          style={{ textAlign: 'right' }}
        />
        {!minimal && (
          <Field width={80} style={{ textAlign: 'center' }}>
            <Trans>Recurring</Trans>
          </Field>
        )}
        {!minimal && <Field width={40} />}
      </TableHeader>
      <Table
        loading={isLoading}
        rowHeight={ROW_HEIGHT}
        backgroundColor="transparent"
        style={{ flex: 1, backgroundColor: 'transparent', ...style }}
        items={items as ScheduleEntity[]}
        renderItem={renderItem}
        renderEmpty={filter ? t('No matching schedules') : t('No schedules')}
      />
    </View>
  );
}
