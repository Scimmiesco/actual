// useReport — the data-access hook every report page uses
// -------------------------------------------------------
// This is the reports feature's generic "fetch my data" primitive. In Angular
// it would be a service method returning an `Observable<T>` (e.g.
// `this.netWorthService.get(start, end, ...)`) that the component subscribes to.
//
// Here instead of returning an Observable it manages local React state:
//   - `sheetName`   : a cache key for the spreadsheet (like a query/entity name).
//   - `getData`     : an async callback that receives the spreadsheet helper and
//                     a `setData` sink; it queries the DB and pushes results.
//   - returns `T | null` : `null` means "still loading" (the Angular equivalent
//                     of an Observable that hasn't emitted yet).
//
// The effect re-runs whenever `getData` or the spreadsheet changes, resets
// `results` to `null` first (forcing a loading state), and uses a `didCancel`
// flag to ignore late resolves after unmount — exactly the cleanup you get for
// free with `takeUntilDestroyed`/async pipe in Angular.
import { useEffect, useState } from 'react';

import { useSpreadsheet } from '#hooks/useSpreadsheet';

export function useReport<T>(
  sheetName: string,
  getData: (
    spreadsheet: ReturnType<typeof useSpreadsheet>,
    setData: (results: T) => void,
  ) => Promise<void>,
): T | null {
  const spreadsheet = useSpreadsheet();
  const [results, setResults] = useState<T | null>(null);

  useEffect(() => {
    let didCancel = false;

    // Reset results whenever a new data function is provided so callers
    // can reliably show a loading state instead of stale/partial data.
    setResults(null);

    void getData(spreadsheet, results => {
      if (!didCancel) {
        setResults(results);
      }
    });

    return () => {
      didCancel = true;
    };
  }, [getData, spreadsheet]);
  return results;
}
