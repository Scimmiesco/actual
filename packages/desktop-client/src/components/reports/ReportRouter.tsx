// REPORTS ROUTER — the feature's "Routes" table
// ----------------------------------------------
// This is the closest thing the reports feature has to an Angular `RouterModule`
// `Routes` array. Each <Route path=... element=...> entry maps a URL segment to
// a report *page* component (e.g. /net-worth -> <NetWorth/>). The `:id` suffix
// on most paths is the dashboard widget id that the page uses to load its saved
// configuration — analogous to an Angular route `:id` parameter
// (`/net-worth/:id`) resolved through a `Resolve`/route param.
//
// Feature flags gate some routes behind `useFeatureFlag(...)`, conditionally
// registering them much like Angular would conditionally provide routes based on
// an environment/config check.
//
// Every report page is wrapped in <ReportBoundary>, an ErrorBoundary that resets
// when the URL changes. There is no direct Angular primitive for this, but it is
// conceptually the same intent as a route-level error handler / `CanActivate`
// guard fallback that catches a failed component render.
import type { ReactNode } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { Route, Routes, useLocation } from 'react-router';

import { FeatureErrorFallback } from '#components/FeatureErrorFallback';
import { useFeatureFlag } from '#hooks/useFeatureFlag';

import { AgeOfMoney } from './reports/AgeOfMoney';
import { BalanceForecast } from './reports/BalanceForecast';
import { BudgetAnalysis } from './reports/BudgetAnalysis';
import { Calendar } from './reports/Calendar';
import { CashFlow } from './reports/CashFlow';
import { Crossover } from './reports/Crossover';
import { CustomReport } from './reports/CustomReport';
import { Formula } from './reports/Formula';
import { MonteCarlo } from './reports/monte-carlo/MonteCarlo';
import { NetWorth } from './reports/NetWorth';
import { Sankey } from './reports/Sankey';
import { ScheduledCashFlow } from './reports/ScheduledCashFlow';
import { Spending } from './reports/Spending';
import { Summary } from './reports/Summary';
import { ReportsDashboardRouter } from './ReportsDashboardRouter';

// Per-report error boundary. `resetKeys={[location.pathname]}` makes the
// boundary "forget" a previous error and re-mount its child whenever the route
// changes — so navigating between reports always starts from a clean state.
function ReportBoundary({ children }: { children: ReactNode }) {
  const location = useLocation();
  return (
    <ErrorBoundary
      FallbackComponent={FeatureErrorFallback}
      resetKeys={[location.pathname]}
    >
      {children}
    </ErrorBoundary>
  );
}

export function ReportRouter() {
  const balanceForecastReportEnabled = useFeatureFlag('balanceForecastReport');
  const budgetAnalysisReportEnabled = useFeatureFlag('budgetAnalysisReport');
  const sankeyReportEnabled = useFeatureFlag('sankeyReport');
  const monteCarloReportEnabled = useFeatureFlag('monteCarloReport');

  return (
    <Routes>
      <Route path="/" element={<ReportsDashboardRouter />} />
      <Route path="/:dashboardId" element={<ReportsDashboardRouter />} />
      <Route
        path="/net-worth"
        element={
          <ReportBoundary>
            <NetWorth />
          </ReportBoundary>
        }
      />
      <Route
        path="/net-worth/:id"
        element={
          <ReportBoundary>
            <NetWorth />
          </ReportBoundary>
        }
      />
      <Route
        path="/crossover"
        element={
          <ReportBoundary>
            <Crossover />
          </ReportBoundary>
        }
      />
      <Route
        path="/crossover/:id"
        element={
          <ReportBoundary>
            <Crossover />
          </ReportBoundary>
        }
      />
      <Route
        path="/age-of-money"
        element={
          <ReportBoundary>
            <AgeOfMoney />
          </ReportBoundary>
        }
      />
      <Route
        path="/age-of-money/:id"
        element={
          <ReportBoundary>
            <AgeOfMoney />
          </ReportBoundary>
        }
      />
      <Route
        path="/cash-flow"
        element={
          <ReportBoundary>
            <CashFlow />
          </ReportBoundary>
        }
      />
      <Route
        path="/cash-flow/:id"
        element={
          <ReportBoundary>
            <CashFlow />
          </ReportBoundary>
        }
      />
      <Route
        path="/custom"
        element={
          <ReportBoundary>
            <CustomReport />
          </ReportBoundary>
        }
      />
      <Route
        path="/custom/:id"
        element={
          <ReportBoundary>
            <CustomReport />
          </ReportBoundary>
        }
      />
      <Route
        path="/spending"
        element={
          <ReportBoundary>
            <Spending />
          </ReportBoundary>
        }
      />
      <Route
        path="/spending/:id"
        element={
          <ReportBoundary>
            <Spending />
          </ReportBoundary>
        }
      />
      {budgetAnalysisReportEnabled && (
        <>
          <Route
            path="/budget-analysis"
            element={
              <ReportBoundary>
                <BudgetAnalysis />
              </ReportBoundary>
            }
          />
          <Route
            path="/budget-analysis/:id"
            element={
              <ReportBoundary>
                <BudgetAnalysis />
              </ReportBoundary>
            }
          />
        </>
      )}
      <Route
        path="/summary"
        element={
          <ReportBoundary>
            <Summary />
          </ReportBoundary>
        }
      />
      <Route
        path="/summary/:id"
        element={
          <ReportBoundary>
            <Summary />
          </ReportBoundary>
        }
      />
      <Route
        path="/calendar"
        element={
          <ReportBoundary>
            <Calendar />
          </ReportBoundary>
        }
      />
      <Route
        path="/calendar/:id"
        element={
          <ReportBoundary>
            <Calendar />
          </ReportBoundary>
        }
      />
      <Route
        path="/formula"
        element={
          <ReportBoundary>
            <Formula />
          </ReportBoundary>
        }
      />
      <Route
        path="/formula/:id"
        element={
          <ReportBoundary>
            <Formula />
          </ReportBoundary>
        }
      />
      {balanceForecastReportEnabled && (
        <>
          <Route
            path="/forecast"
            element={
              <ReportBoundary>
                <BalanceForecast />
              </ReportBoundary>
            }
          />
          <Route
            path="/forecast/:id"
            element={
              <ReportBoundary>
                <BalanceForecast />
              </ReportBoundary>
            }
          />
        </>
      )}
      <Route
        path="/scheduled-cash-flow"
        element={
          <ReportBoundary>
            <ScheduledCashFlow />
          </ReportBoundary>
        }
      />
      <Route
        path="/scheduled-cash-flow/:id"
        element={
          <ReportBoundary>
            <ScheduledCashFlow />
          </ReportBoundary>
        }
      />
      {monteCarloReportEnabled && (
        <>
          <Route
            path="/monte-carlo"
            element={
              <ReportBoundary>
                <MonteCarlo />
              </ReportBoundary>
            }
          />
          <Route
            path="/monte-carlo/:id"
            element={
              <ReportBoundary>
                <MonteCarlo />
              </ReportBoundary>
            }
          />
        </>
      )}
      {sankeyReportEnabled && (
        <>
          <Route
            path="/sankey"
            element={
              <ReportBoundary>
                <Sankey />
              </ReportBoundary>
            }
          />
          <Route
            path="/sankey/:id"
            element={
              <ReportBoundary>
                <Sankey />
              </ReportBoundary>
            }
          />
        </>
      )}
    </Routes>
  );
}
