import { useEffect, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { useParams } from 'react-router';

import { AlignedText } from '@actual-app/components/aligned-text';
import { Button } from '@actual-app/components/button';
import { useResponsive } from '@actual-app/components/hooks/useResponsive';
import { Select } from '@actual-app/components/select';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import * as monthUtils from '@actual-app/core/shared/months';
import type {
  RuleConditionEntity,
  ScheduledCashFlowWidget,
  TimeFrame,
} from '@actual-app/core/types/models';

import { EditablePageHeaderTitle } from '#components/EditablePageHeaderTitle';
import { FinancialText } from '#components/FinancialText';
import { MobileBackButton } from '#components/mobile/MobileBackButton';
import { MobilePageHeader, Page, PageHeader } from '#components/Page';
import { AccountSelector } from '#components/reports/AccountSelector';
import { ScheduledCashFlowGraph } from '#components/reports/graphs/ScheduledCashFlowGraph';
import { Header } from '#components/reports/Header';
import { LoadingIndicator } from '#components/reports/LoadingIndicator';
import { calculateTimeRange } from '#components/reports/reportRanges';
import { useAccounts } from '#hooks/useAccounts';
import { useBalanceForecast } from '#hooks/useBalanceForecast';
import { useCategories } from '#hooks/useCategories';
import { useDashboardWidget } from '#hooks/useDashboardWidget';
import { useFormat } from '#hooks/useFormat';
import { useNavigate } from '#hooks/useNavigate';
import { useRuleConditionFilters } from '#hooks/useRuleConditionFilters';
import { addNotification } from '#notifications/notificationsSlice';
import { useDispatch } from '#redux';
import { useUpdateDashboardWidgetMutation } from '#reports/mutations';

import { buildScheduledCashFlowChartData } from './scheduledCashFlowChartData';
import { ScheduledCashFlowTable } from './ScheduledCashFlowTable';

const defaultTimeFrame = {
  start: monthUtils.currentMonth(),
  end: monthUtils.addMonths(monthUtils.currentMonth(), 11),
  mode: 'static',
} satisfies TimeFrame;

export function ScheduledCashFlow() {
  const { id } = useParams();
  const { data: widget, isPending } =
    useDashboardWidget<ScheduledCashFlowWidget>({
      id,
      type: 'scheduled-cash-flow-card',
    });

  if (isPending) {
    return <LoadingIndicator />;
  }

  return <ScheduledCashFlowInner widget={widget} />;
}

type ScheduledCashFlowInnerProps = {
  widget?: ScheduledCashFlowWidget;
};

function ScheduledCashFlowInner({ widget }: ScheduledCashFlowInnerProps) {
  const { t } = useTranslation();
  const format = useFormat();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { isNarrowWidth } = useResponsive();
  const { data: accounts = [] } = useAccounts();
  const { data: categories = { list: [], grouped: [] } } = useCategories();
  const [start, setStart] = useState(defaultTimeFrame.start);
  const [end, setEnd] = useState(defaultTimeFrame.end);
  const [mode, setMode] = useState<TimeFrame['mode']>(defaultTimeFrame.mode);
  const [granularity, setGranularity] = useState<'Daily' | 'Monthly'>(
    widget?.meta?.granularity ?? 'Monthly',
  );
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>(
    widget?.meta?.accounts ?? [],
  );
  const [hasInitializedAccounts, setHasInitializedAccounts] = useState(
    widget?.meta?.accounts !== undefined,
  );

  const {
    conditions,
    conditionsOp,
    onApply: onApplyFilter,
    onDelete: onDeleteFilter,
    onUpdate: onUpdateFilter,
    onConditionsOpChange,
  } = useRuleConditionFilters<RuleConditionEntity>(
    widget?.meta?.conditions,
    widget?.meta?.conditionsOp,
  );

  useEffect(() => {
    const [initialStart, initialEnd, initialMode] = calculateTimeRange(
      widget?.meta?.timeFrame,
      defaultTimeFrame,
    );
    setStart(initialStart);
    setEnd(initialEnd);
    setMode(initialMode);
  }, [widget?.meta?.timeFrame]);

  useEffect(() => {
    if (
      !hasInitializedAccounts &&
      widget?.meta?.accounts === undefined &&
      accounts.length > 0
    ) {
      setSelectedAccountIds(accounts.map(account => account.id));
      setHasInitializedAccounts(true);
    }
  }, [accounts, hasInitializedAccounts, widget?.meta?.accounts]);

  const startDate = start;
  const endDate = end;
  const forecastStartDate =
    start.length === 7 ? monthUtils.firstDayOfMonth(start) : start;
  const forecastEndDate =
    end.length === 7 ? monthUtils.lastDayOfMonth(end) : end;
  const {
    data: forecastData,
    error,
    isPending: isForecastPending,
  } = useBalanceForecast({
    accountIds: selectedAccountIds,
    conditions,
    conditionsOp,
    startDate: forecastStartDate,
    endDate: forecastEndDate,
    includeAccountlessSchedules: widget?.meta?.accounts === undefined,
  });

  const chartData = buildScheduledCashFlowChartData({
    forecastData: forecastData ?? null,
    start,
    end,
    granularity,
    accounts,
    categories: categories.list,
    uncategorizedLabel: t('Uncategorized'),
  });

  const allMonths = monthUtils
    .rangeInclusive(monthUtils.currentMonth(), monthUtils.getMonth(end))
    .map(name => ({ name }));
  const updateDashboardWidgetMutation = useUpdateDashboardWidgetMutation();
  const title = widget?.meta?.name ?? t('Scheduled Cash Flow');

  function onChangeDates(
    newStart: string,
    newEnd: string,
    newMode: TimeFrame['mode'],
  ) {
    setStart(newStart);
    setEnd(newEnd);
    setMode(newMode);
  }

  function onSaveWidgetName(name: string) {
    if (!widget) return;
    updateDashboardWidgetMutation.mutate({
      widget: { id: widget.id, meta: { ...(widget.meta ?? {}), name } },
    });
  }

  function onSaveWidget() {
    if (!widget) return;
    updateDashboardWidgetMutation.mutate(
      {
        widget: {
          id: widget.id,
          meta: {
            ...(widget.meta ?? {}),
            accounts: selectedAccountIds,
            conditions,
            conditionsOp,
            granularity,
            timeFrame: { start, end, mode },
          },
        },
      },
      {
        onSuccess: () =>
          dispatch(
            addNotification({
              notification: {
                type: 'message',
                message: t('Dashboard widget successfully saved.'),
              },
            }),
          ),
      },
    );
  }

  if (isForecastPending && !forecastData) {
    return <LoadingIndicator message={t('Loading scheduled cash flow...')} />;
  }

  return (
    <Page
      header={
        isNarrowWidth ? (
          <MobilePageHeader
            title={title}
            leftContent={
              <MobileBackButton onPress={() => navigate('/reports')} />
            }
          />
        ) : (
          <PageHeader
            title={
              widget ? (
                <EditablePageHeaderTitle
                  title={title}
                  onSave={onSaveWidgetName}
                />
              ) : (
                title
              )
            }
          />
        )
      }
      padding={0}
    >
      <Header
        allMonths={allMonths}
        start={start}
        end={end}
        earliestTransaction={startDate}
        latestTransaction={endDate}
        mode={mode}
        onChangeDates={onChangeDates}
        granularities={['month', 'day']}
        show1Month
        showFutureRange
        filters={conditions}
        onApply={onApplyFilter}
        onUpdateFilter={onUpdateFilter}
        onDeleteFilter={onDeleteFilter}
        conditionsOp={conditionsOp}
        onConditionsOpChange={onConditionsOpChange}
        inlineContent={
          <Select
            value={granularity}
            onChange={setGranularity}
            options={[
              ['Monthly', t('Monthly')],
              ['Daily', t('Daily')],
            ]}
          />
        }
      >
        {widget && (
          <Button variant="primary" onPress={onSaveWidget}>
            <Trans>Save widget</Trans>
          </Button>
        )}
      </Header>

      <View
        style={{
          backgroundColor: theme.tableBackground,
          padding: 20,
          overflowY: 'auto',
        }}
      >
        <View style={{ maxWidth: 300, marginBottom: 20 }}>
          <AccountSelector
            accounts={accounts}
            selectedAccountIds={selectedAccountIds}
            setSelectedAccountIds={setSelectedAccountIds}
          />
        </View>

        {error ? (
          <Trans>Failed to load scheduled cash flow.</Trans>
        ) : (
          <>
            <View
              style={{
                flexDirection: 'row',
                gap: 30,
                marginBottom: 20,
              }}
            >
              <AlignedText
                left={<Trans>Planned income</Trans>}
                right={
                  <FinancialText>
                    {format(chartData.totalIncome, 'financial')}
                  </FinancialText>
                }
              />
              <AlignedText
                left={<Trans>Planned expenses</Trans>}
                right={
                  <FinancialText>
                    {format(chartData.totalExpenses, 'financial')}
                  </FinancialText>
                }
              />
            </View>
            <ScheduledCashFlowGraph data={chartData} />
            <ScheduledCashFlowTable occurrences={chartData.occurrences} />
          </>
        )}
      </View>
    </Page>
  );
}
