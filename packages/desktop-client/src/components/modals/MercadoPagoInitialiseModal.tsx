import React, { useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { ButtonWithLoading } from '@actual-app/components/button';
import { InitialFocus } from '@actual-app/components/initial-focus';
import { Input } from '@actual-app/components/input';
import { Text } from '@actual-app/components/text';
import { Toggle } from '@actual-app/components/toggle';
import { View } from '@actual-app/components/view';
import { send } from '@actual-app/core/platform/client/connection';

import { Error } from '#components/alerts';
import { Link } from '#components/common/Link';
import {
  Modal,
  ModalButtons,
  ModalCloseButton,
  ModalHeader,
} from '#components/common/Modal';
import { FormField, FormLabel } from '#components/forms';
import { useCurrentAccess } from '#hooks/useCurrentAccess';
import type { Modal as ModalType } from '#modals/modalsSlice';

type MercadoPagoInitialiseProps = Extract<
  ModalType,
  { name: 'mercadopago-init' }
>['options'];

export const MercadoPagoInitialiseModal = ({
  onSuccess,
  credentialSource,
}: MercadoPagoInitialiseProps) => {
  const { t } = useTranslation();
  const { cloudFileId, isAdmin: canSetGlobalCredentials } = useCurrentAccess();
  const [accessToken, setAccessToken] = useState('');
  const [perBudgetFile, setPerBudgetFile] = useState(
    credentialSource === 'per-budget-file' || !canSetGlobalCredentials,
  );
  const [isValid, setIsValid] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(
    t('It is required to provide the Mercado Pago Access Token.'),
  );

  const onSubmit = async (close: () => void) => {
    if (!accessToken || !accessToken.trim()) {
      setIsValid(false);
      setError(t('It is required to provide the Mercado Pago Access Token.'));
      return;
    }

    setIsLoading(true);

    const fileId = perBudgetFile ? cloudFileId : null;
    if (perBudgetFile && !fileId) {
      setIsLoading(false);
      setIsValid(false);
      setError(t('Budget file ID is required.'));
      return;
    }

    try {
      const result = (await send('mercadopago-configure', {
        accessToken: accessToken.trim(),
        fileId,
      })) as
        | {
            error?: string;
            error_code?: string;
            reason?: string;
            details?: string;
          }
        | undefined;

      if (result && (result.error || result.error_code)) {
        setIsLoading(false);
        setIsValid(false);
        setError(
          result.details ||
            result.reason ||
            result.error ||
            t('Failed to configure Mercado Pago credentials.'),
        );
        return;
      }

      setIsValid(true);
      onSuccess(perBudgetFile);
      setIsLoading(false);
      close();
    } catch (err: unknown) {
      setIsLoading(false);
      setIsValid(false);
      const msg =
        typeof err === 'object' && err !== null && 'message' in err
          ? String((err as { message: unknown }).message)
          : t('An error occurred while saving the credentials.');
      setError(msg);
    }
  };

  return (
    <Modal
      name="mercadopago-init"
      containerProps={{ style: { width: '32vw', minWidth: 360 } }}
    >
      {({ state }) => (
        <>
          <ModalHeader
            title={t('Set-up Mercado Pago')}
            rightContent={<ModalCloseButton onPress={() => state.close()} />}
          />
          <View style={{ display: 'flex', gap: 12 }}>
            <Text>
              <Trans>
                To enable bank sync with Mercado Pago, you will need to provide
                your production <strong>Access Token</strong>. You can find or
                generate your token in the{' '}
                <Link
                  variant="external"
                  to="https://www.mercadopago.com.br/developers/panel/app"
                  linkColor="purple"
                >
                  Mercado Pago Developers Portal
                </Link>
                .
              </Trans>
            </Text>

            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
              }}
            >
              <Text>
                <Trans>For this budget only</Trans>
              </Text>
              <Toggle
                id="mercadopago-per-budget-file"
                isOn={perBudgetFile}
                isDisabled={!canSetGlobalCredentials}
                onToggle={setPerBudgetFile}
              />
            </View>

            <FormField>
              <FormLabel
                title={t('Access Token (APP_USR-...):')}
                htmlFor="mercadopago-access-token"
              />
              <InitialFocus>
                <Input
                  id="mercadopago-access-token"
                  type="password"
                  value={accessToken}
                  placeholder="APP_USR-0000000000000000-..."
                  onChangeValue={value => {
                    setAccessToken(value);
                    setIsValid(true);
                  }}
                />
              </InitialFocus>
            </FormField>

            {!isValid && <Error>{error}</Error>}
          </View>

          <ModalButtons>
            <ButtonWithLoading
              variant="primary"
              isLoading={isLoading}
              onPress={() => {
                void onSubmit(() => state.close());
              }}
            >
              <Trans>Save and continue</Trans>
            </ButtonWithLoading>
          </ModalButtons>
        </>
      )}
    </Modal>
  );
};
