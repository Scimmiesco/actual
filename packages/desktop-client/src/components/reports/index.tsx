// ENTRY POINT OF THE REPORTS FEATURE (desktop build)
// ----------------------------------------------------
// This component is the route ("/reports") landing component mounted by the app
// shell. Think of it as the Angular equivalent of a *lazy-loaded feature
// module's* entry component: it does almost nothing itself except render a
// full-height container and then lazy-load the real router via `LoadComponent`.
//
// `LoadComponent` dynamically imports `./ReportRouter` (webpack code-split chunk
// named "reports"), so the entire reports bundle is only fetched when the user
// actually navigates to reports. This mirrors Angular's `loadChildren: () =>
// import('./reports/reports.module').then(m => m.ReportsModule)` lazy routing.
import { useTranslation } from 'react-i18next';

import { View } from '@actual-app/components/view';

import { LoadComponent } from '#components/util/LoadComponent';

export function Reports() {
  const { t } = useTranslation();

  return (
    <View style={{ flex: 1 }} data-testid="reports-page">
      <LoadComponent
        name="ReportRouter"
        message={t('Loading reports...')}
        importer={() =>
          import(/* webpackChunkName: 'reports' */ './ReportRouter')
        }
      />
    </View>
  );
}
