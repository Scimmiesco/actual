import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Block } from '@actual-app/components/block';
import { styles } from '@actual-app/components/styles';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import * as monthUtils from '@actual-app/core/shared/months';
import type {
  AccountEntity,
  ScheduledCashFlowWidget,
} from '@actual-app/core/types/models';

import { PrivacyFilter } from '#components/PrivacyFilter';
import { DateRange } from '#components/reports/DateRange';
import { ScheduledCashFlowGraph } from '#components/reports/graphs/ScheduledCashFlowGraph';
import { LoadingIndicator } from '#components/reports/LoadingIndicator';
import { ReportCard } from '#components/reports/ReportCard';
import { ReportCardName } from '#components/reports/ReportCardName';
import { calculateTimeRange } from '#components/reports/reportRanges';
import { ScheduledCashFlowAccountBreakdown } from '#components/reports/reports/ScheduledCashFlowAccountBreakdown';
import { useAccounts } from '#hooks/useAccounts';
import { useBalanceForecast } from '#hooks/useBalanceForecast';
import { useCategories } from '#hooks/useCategories';
import { useFormat } from '#hooks/useFormat';

import { buildScheduledCashFlowChartData } from './scheduledCashFlowChartData';

type ScheduledCashFlowCardProps = {
  widgetId: string;
  isEditing?: boolean;
  accounts: AccountEntity[];
  meta?: ScheduledCashFlowWidget['meta'];
  onMetaChange: (newMeta: ScheduledCashFlowWidget['meta']) => void;
};

export function ScheduledCashFlowCard({
  widgetId,
  isEditing,
  accounts,
  meta,
  onMetaChange,
}: ScheduledCashFlowCardProps) {
  const { t } = useTranslation();
  const [nameMenuOpen, setNameMenuOpen] = useState(false);
  const format = useFormat();
  const { data: loadedAccounts = accounts } = useAccounts();
  const { data: categories = { list: [], grouped: [] } } = useCategories();
  const [start, end] = calculateTimeRange(meta?.timeFrame, {
    start: monthUtils.currentMonth(),
    end: monthUtils.addMonths(monthUtils.currentMonth(), 11),
    mode: 'static',
  });
  const selectedAccountIds =
    meta?.accounts ?? loadedAccounts.map(account => account.id);
  const { data: forecastData, isPending } = useBalanceForecast({
    accountIds: selectedAccountIds.length > 0 ? selectedAccountIds : undefined,
    conditions: meta?.conditions,
    conditionsOp: meta?.conditionsOp,
    startDate: monthUtils.firstDayOfMonth(start),
    endDate: monthUtils.lastDayOfMonth(end),
    includeAccountlessSchedules: meta?.accounts === undefined,
  });
  const chartData = buildScheduledCashFlowChartData({
    forecastData: forecastData ?? null,
    start,
    end,
    granularity: 'Monthly',
    accounts: loadedAccounts,
    categories: categories.list,
    categoryGroups: categories.grouped,
    uncategorizedLabel: t('Uncategorized'),
  });
  const name = meta?.name ?? t('Scheduled Cash Flow');

  function onRename(newName: string) {
    onMetaChange({ ...meta, name: newName });
    setNameMenuOpen(false);
  }

  return (
    <ReportCard
      widgetId={widgetId}
      isEditing={isEditing}
      disableClick={nameMenuOpen}
      to={`/reports/scheduled-cash-flow/${widgetId}`}
      onRename={() => setNameMenuOpen(true)}
    >
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', padding: 20 }}>
          <View style={{ flex: 1 }}>
            <ReportCardName
              name={name}
              isEditing={nameMenuOpen}
              onChange={onRename}
              onClose={() => setNameMenuOpen(false)}
            />
            <DateRange start={start} end={end} />
          </View>
          <View style={{ textAlign: 'right' }}>
            <Block style={{ ...styles.mediumText, fontWeight: 500 }}>
              <PrivacyFilter>
                {format(
                  chartData.totalIncome + chartData.totalExpenses,
                  'financial',
                )}
              </PrivacyFilter>
            </Block>
            <Block style={{ fontSize: 12, color: theme.pageTextLight }}>
              {chartData.occurrences.length} {t('scheduled transactions')}
            </Block>
          </View>
        </View>
        {isPending && !forecastData ? (
          <LoadingIndicator />
        ) : (
          <>
            <ScheduledCashFlowGraph data={chartData} compact />
            <ScheduledCashFlowAccountBreakdown
              accounts={chartData.accountBreakdown}
            />
          </>
        )}
      </View>
    </ReportCard>
  );
}
