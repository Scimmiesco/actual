import React, { useMemo, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { useResponsive } from '@actual-app/components/hooks/useResponsive';
import { InitialFocus } from '@actual-app/components/initial-focus';
import { Input } from '@actual-app/components/input';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import { send } from '@actual-app/core/platform/client/connection';
import type { TransactionEntity } from '@actual-app/core/types/models';
import { addMonths, format, parseISO } from 'date-fns';
import { v4 as uuidv4 } from 'uuid';

import {
  Modal,
  ModalButtons,
  ModalCloseButton,
  ModalHeader,
} from '#components/common/Modal';
import { FinancialText } from '#components/FinancialText';
import { FormField, FormLabel } from '#components/forms';
import { useDateFormat } from '#hooks/useDateFormat';
import { useFormat } from '#hooks/useFormat';
import type { Modal as ModalType } from '#modals/modalsSlice';

type CreateInstallmentsModalProps = Extract<
  ModalType,
  { name: 'create-installments' }
>['options'];

export function CreateInstallmentsModal({
  transaction,
  onSave,
}: CreateInstallmentsModalProps) {
  const { t } = useTranslation();
  const formatAmount = useFormat();
  const dateFormat = useDateFormat() || 'yyyy-MM-dd';
  const { isNarrowWidth } = useResponsive();

  const [count, setCount] = useState<number>(2);
  const [firstChargeDate, setFirstChargeDate] = useState<string>(
    transaction.charge_date ||
      transaction.date ||
      format(new Date(), 'yyyy-MM-dd'),
  );
  const [purchaseDate, setPurchaseDate] = useState<string>(
    transaction.date || format(new Date(), 'yyyy-MM-dd'),
  );
  const [baseNote, setBaseNote] = useState<string>(
    transaction.notes?.replace(/^\[\d+\/\d+\]\s*/, '') || '',
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  const safeCount = Math.max(2, Math.min(60, Number(count) || 2));

  const installments = useMemo(() => {
    const total = transaction.amount;
    const baseAmount = Math.trunc(total / safeCount);
    const remainder = total - baseAmount * safeCount;

    let baseChargeDate = new Date();
    try {
      baseChargeDate = parseISO(firstChargeDate);
      if (isNaN(baseChargeDate.getTime())) {
        baseChargeDate = new Date();
      }
    } catch {
      baseChargeDate = new Date();
    }

    return Array.from({ length: safeCount }, (_, i) => {
      const amount = i === 0 ? baseAmount + remainder : baseAmount;
      const chargeDate = format(addMonths(baseChargeDate, i), 'yyyy-MM-dd');
      const noteLabel = `[${i + 1}/${safeCount}]${baseNote ? ' ' + baseNote.trim() : ''}`;

      return {
        index: i + 1,
        amount,
        charge_date: chargeDate,
        notes: noteLabel,
      };
    });
  }, [transaction.amount, safeCount, firstChargeDate, baseNote]);

  const handleSubmit = async (close: () => void) => {
    if (isSubmitting) {
      return;
    }
    setIsSubmitting(true);

    try {
      const firstInstallment = installments[0];
      const updatedTx = {
        ...transaction,
        amount: firstInstallment.amount,
        date: purchaseDate,
        charge_date: firstInstallment.charge_date,
        notes: firstInstallment.notes,
      };

      const addedTxs: TransactionEntity[] = installments.slice(1).map(inst => ({
        id: uuidv4(),
        account: transaction.account,
        date: purchaseDate,
        charge_date: inst.charge_date,
        amount: inst.amount,
        payee: transaction.payee,
        category: transaction.category,
        notes: inst.notes,
        cleared: false,
        reconciled: false,
      }));

      await send('transactions-batch-update', {
        updated: [updatedTx],
        added: addedTxs,
      });

      close();
      onSave?.();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      name="create-installments"
      containerProps={{
        style: {
          width: isNarrowWidth ? '95vw' : 580,
          maxHeight: '85vh',
        },
      }}
    >
      {({ state }) => (
        <>
          <ModalHeader
            title={t('Split into installments')}
            rightContent={<ModalCloseButton onPress={() => state.close()} />}
          />

          <View style={{ gap: 14, marginTop: 10, overflowY: 'auto' }}>
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                backgroundColor: theme.pillBackground,
                padding: '10px 14px',
                borderRadius: 8,
                alignItems: 'center',
              }}
            >
              <Text style={{ fontWeight: 600 }}>
                <Trans>Total transaction amount:</Trans>
              </Text>
              <FinancialText
                style={{
                  fontSize: 16,
                  fontWeight: 700,
                  color:
                    transaction.amount < 0 ? theme.errorText : theme.noticeText,
                }}
              >
                {formatAmount(transaction.amount, 'financial')}
              </FinancialText>
            </View>

            <View style={{ flexDirection: 'row', gap: 12 }}>
              <FormField style={{ flex: 1 }}>
                <FormLabel
                  title={t('Number of installments')}
                  htmlFor="count-input"
                />
                <InitialFocus>
                  <Input
                    id="count-input"
                    type="number"
                    min={2}
                    max={60}
                    value={String(count)}
                    onChange={e =>
                      setCount(
                        Math.max(
                          2,
                          Math.min(60, parseInt(e.target.value, 10) || 2),
                        ),
                      )
                    }
                    style={{ width: '100%' }}
                  />
                </InitialFocus>
              </FormField>

              <FormField style={{ flex: 1 }}>
                <FormLabel
                  title={t('First charge date')}
                  htmlFor="charge-date-input"
                />
                <Input
                  id="charge-date-input"
                  type="date"
                  value={firstChargeDate}
                  onChange={e => setFirstChargeDate(e.target.value)}
                  style={{ width: '100%' }}
                />
              </FormField>
            </View>

            <View style={{ flexDirection: 'row', gap: 12 }}>
              <FormField style={{ flex: 1 }}>
                <FormLabel
                  title={t('Purchase date')}
                  htmlFor="purchase-date-input"
                />
                <Input
                  id="purchase-date-input"
                  type="date"
                  value={purchaseDate}
                  onChange={e => setPurchaseDate(e.target.value)}
                  style={{ width: '100%' }}
                />
              </FormField>

              <FormField style={{ flex: 1 }}>
                <FormLabel
                  title={t('Description / Base note')}
                  htmlFor="note-input"
                />
                <Input
                  id="note-input"
                  type="text"
                  value={baseNote}
                  placeholder={t('e.g. Smart TV')}
                  onChange={e => setBaseNote(e.target.value)}
                  style={{ width: '100%' }}
                />
              </FormField>
            </View>

            <View style={{ marginTop: 6 }}>
              <Text style={{ fontWeight: 600, marginBottom: 6, fontSize: 13 }}>
                <Trans>Installments preview ({{ count: safeCount }}):</Trans>
              </Text>
              <View
                style={{
                  maxHeight: 180,
                  overflowY: 'auto',
                  border: `1px solid ${theme.tableBorder}`,
                  borderRadius: 6,
                  backgroundColor: theme.tableBackground,
                }}
              >
                {installments.map((inst, idx) => (
                  <View
                    key={inst.index}
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '6px 12px',
                      borderBottom:
                        idx < installments.length - 1
                          ? `1px solid ${theme.tableBorderSeparator}`
                          : undefined,
                      fontSize: 12,
                    }}
                  >
                    <View
                      style={{
                        flexDirection: 'row',
                        gap: 8,
                        alignItems: 'center',
                      }}
                    >
                      <Text
                        style={{
                          fontWeight: 700,
                          backgroundColor: theme.pillBackground,
                          color: theme.pillText,
                          padding: '1px 6px',
                          borderRadius: 4,
                        }}
                      >
                        {inst.index}/{safeCount}
                      </Text>
                      <Text style={{ color: theme.pageTextSubdued }}>
                        {format(parseISO(inst.charge_date), dateFormat)}
                      </Text>
                      <Text style={{ fontWeight: 500 }}>{inst.notes}</Text>
                    </View>
                    <FinancialText style={{ fontWeight: 600 }}>
                      {formatAmount(inst.amount, 'financial')}
                    </FinancialText>
                  </View>
                ))}
              </View>
            </View>

            <ModalButtons style={{ marginTop: 10 }}>
              <Button onPress={() => state.close()} isDisabled={isSubmitting}>
                <Trans>Cancel</Trans>
              </Button>
              <Button
                variant="primary"
                onPress={() => handleSubmit(() => state.close())}
                isDisabled={isSubmitting}
                style={{ marginLeft: 8 }}
              >
                <Trans>Create {{ count: safeCount }} installments</Trans>
              </Button>
            </ModalButtons>
          </View>
        </>
      )}
    </Modal>
  );
}
