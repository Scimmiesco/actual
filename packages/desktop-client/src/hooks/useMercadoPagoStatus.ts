import { useEffect, useState } from 'react';

import { send } from '@actual-app/core/platform/client/connection';
import type { BankSyncProviderStatus } from '@actual-app/core/types/models';

import { useSyncServerStatus } from './useSyncServerStatus';

export function useMercadoPagoStatus() {
  const [mercadoPagoStatus, setMercadoPagoStatus] =
    useState<BankSyncProviderStatus>({});
  const [isLoading, setIsLoading] = useState(false);
  const status = useSyncServerStatus();

  useEffect(() => {
    async function fetch() {
      setIsLoading(true);

      const results = await send('mercadopago-status');

      setMercadoPagoStatus(results);
      setIsLoading(false);
    }

    if (status !== 'online') {
      setMercadoPagoStatus({});
      return;
    }

    void fetch();
  }, [status]);

  return {
    mercadoPagoStatus,
    setMercadoPagoStatus,
    isLoading,
  };
}
