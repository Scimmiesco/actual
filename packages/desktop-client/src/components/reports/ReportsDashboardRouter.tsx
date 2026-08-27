// DASHBOARD ROUTER — the default "/reports" and "/reports/:dashboardId" view
// --------------------------------------------------------------------------
// This component resolves *which dashboard page* to show. `useDashboardPages()`
// is a React Query hook that fetches the list of saved dashboards (the data
// lives in the local DB, synced like everything else in Actual). If no
// `dashboardId` is present in the URL it redirects to the first dashboard —
// the Angular equivalent would be a `CanActivate`/redirect or a default route
// that resolves the first entity and navigates to its detail route.
//
// Once a valid `dashboardId` is known it renders <Overview dashboard={...}/>,
// passing the resolved dashboard entity down as a prop (Angular would instead
// inject a resolved `ActivatedRouteSnapshot.data` value into the component).
import { useEffect } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { useParams } from 'react-router';

import { Block } from '@actual-app/components/block';
import { View } from '@actual-app/components/view';

import { useDashboardPages } from '#hooks/useDashboardPages';
import { useNavigate } from '#hooks/useNavigate';

import { LoadingIndicator } from './LoadingIndicator';
import { Overview } from './Overview';

export function ReportsDashboardRouter() {
  const { t } = useTranslation();
  const { dashboardId } = useParams<{ dashboardId?: string }>();
  const navigate = useNavigate();
  const { data: dashboardPages = [], isPending } = useDashboardPages();

  // Redirect to first dashboard if no dashboardId in URL
  useEffect(() => {
    if (!dashboardId && !isPending && dashboardPages.length > 0) {
      void navigate(`/reports/${dashboardPages[0].id}`, { replace: true });
    }
  }, [dashboardId, isPending, dashboardPages, navigate]);

  // Show loading while we're fetching dashboards or redirecting
  if (isPending || (!dashboardId && dashboardPages.length > 0)) {
    return <LoadingIndicator message={t('Loading dashboards...')} />;
  }

  // If we have a dashboardId, render Overview with it
  if (dashboardId) {
    const dashboard = dashboardPages.find(d => d.id === dashboardId);
    if (dashboard) {
      return <Overview dashboard={dashboard} />;
    } else {
      // Invalid dashboardId - show error
      return (
        <View
          style={{
            flex: 1,
            gap: 20,
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <Block style={{ marginBottom: 20, fontSize: 18 }}>
            <Trans>Dashboard not found</Trans>
          </Block>
        </View>
      );
    }
  }

  // No dashboards exist (NOTE: This should not happen invariant is we always should have at least 1 dashboard)
  return <LoadingIndicator message={t('No dashboards available')} />;
}
