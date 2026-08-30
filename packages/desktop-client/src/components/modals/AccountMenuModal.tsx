import { Fragment, useRef, useState } from 'react';
import type { ComponentProps, CSSProperties } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import {
  SvgClose,
  SvgDotsHorizontalTriple,
  SvgLockOpen,
} from '@actual-app/components/icons/v1';
import { SvgLockClosed, SvgNotesPaper } from '@actual-app/components/icons/v2';
import { Menu } from '@actual-app/components/menu';
import { Popover } from '@actual-app/components/popover';
import { Select } from '@actual-app/components/select';
import { styles } from '@actual-app/components/styles';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import type { AccountEntity, AccountType } from '@actual-app/core/types/models';

import { useUpdateAccountMutation } from '#accounts';
import {
  Modal,
  ModalCloseButton,
  ModalHeader,
  ModalTitle,
} from '#components/common/Modal';
import { Checkbox } from '#components/forms';
import { Notes } from '#components/Notes';
import { validateAccountName } from '#components/util/accountValidation';
import { useAccount } from '#hooks/useAccount';
import { useAccounts } from '#hooks/useAccounts';
import { useNotes } from '#hooks/useNotes';
import { useSyncedPref } from '#hooks/useSyncedPref';
import type { Modal as ModalType } from '#modals/modalsSlice';

type AccountMenuModalProps = Extract<
  ModalType,
  { name: 'account-menu' }
>['options'];

export function AccountMenuModal({
  accountId,
  onSave,
  onCloseAccount,
  onReopenAccount,
  onEditNotes,
  onClose,
  onReconcile,
  onToggleRunningBalance,
  onToggleReconciled,
}: AccountMenuModalProps) {
  const { t } = useTranslation();
  const account = useAccount(accountId);
  const { data: accounts = [] } = useAccounts();
  const originalNotes = useNotes(`account-${accountId}`);
  const [accountNameError, setAccountNameError] = useState('');
  const [currentAccountName, setCurrentAccountName] = useState(
    account?.name || t('New Account'),
  );

  const { mutate: updateAccount } = useUpdateAccountMutation();
  const handleSave = (updatedAccount: AccountEntity) => {
    if (onSave) {
      onSave(updatedAccount);
    } else {
      updateAccount({ account: updatedAccount });
    }
  };

  const onRename = (newName: string) => {
    newName = newName.trim();
    if (!account) {
      return;
    }
    if (!newName) {
      setCurrentAccountName(t('Account'));
    } else {
      setCurrentAccountName(newName);
    }

    if (newName !== account.name) {
      const renameAccountError = validateAccountName(
        newName,
        accountId,
        accounts,
      );
      if (renameAccountError) {
        setAccountNameError(renameAccountError);
      } else {
        setAccountNameError('');
        handleSave({
          ...account,
          name: newName,
        });
      }
    }
  };

  const onChangeType = (newType: AccountType) => {
    if (!account) {
      return;
    }

    handleSave({
      ...account,
      type: newType,
    });
  };

  const onChangeOffBudget = (newOffBudget: boolean) => {
    if (!account) {
      return;
    }

    handleSave({
      ...account,
      offbudget: newOffBudget ? 1 : 0,
    });
  };

  const _onEditNotes = () => {
    if (!account) {
      return;
    }

    onEditNotes?.(account.id);
  };

  const canReconcile = !!onReconcile;

  const buttonStyle: CSSProperties = {
    ...styles.mediumText,
    height: styles.mobileMinHeight,
    color: theme.formLabelText,
    // Adjust based on desired number of buttons per row.
    flexBasis: canReconcile ? '48%' : '100%',
  };

  if (!account) {
    return null;
  }

  return (
    <Modal
      name="account-menu"
      onClose={onClose}
      containerProps={{
        style: {
          height: '45vh',
          minHeight: 350,
          width: '30vw',
          minWidth: 400,
        },
      }}
    >
      {({ state }) => (
        <>
          <ModalHeader
            leftContent={
              <AdditionalAccountMenu
                account={account}
                onClose={onCloseAccount}
                onReopen={onReopenAccount}
                onToggleRunningBalance={onToggleRunningBalance}
                onToggleReconciled={onToggleReconciled}
              />
            }
            title={
              <Fragment>
                <ModalTitle
                  isEditable
                  title={currentAccountName}
                  onTitleUpdate={onRename}
                />
                {accountNameError && (
                  <View style={{ color: theme.warningText }}>
                    {accountNameError}
                  </View>
                )}
              </Fragment>
            }
            rightContent={<ModalCloseButton onPress={() => state.close()} />}
          />
          <View
            style={{
              flex: 1,
              flexDirection: 'column',
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 10,
                paddingBottom: 10,
                borderBottomWidth: 1,
                borderColor: theme.tableBorder,
              }}
            >
              <Text style={{ color: theme.pageTextSubdued, fontWeight: 500 }}>
                <Trans>Account type</Trans>
              </Text>
              <Select<AccountType>
                options={[
                  ['checking', t('Checking / Standard')],
                  ['credit', t('Credit Card')],
                  ['savings', t('Savings')],
                  ['investment', t('Investment')],
                  ['mortgage', t('Mortgage')],
                  ['debt', t('Debt / Loan')],
                  ['other', t('Other')],
                ]}
                value={(account.type as AccountType) || 'checking'}
                onChange={onChangeType}
              />
            </View>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 10,
                paddingBottom: 10,
                borderBottomWidth: 1,
                borderColor: theme.tableBorder,
              }}
            >
              <Text style={{ color: theme.pageTextSubdued, fontWeight: 500 }}>
                <Trans>Off budget</Trans>
              </Text>
              <Checkbox
                id="account-offbudget"
                checked={!!account.offbudget}
                onChange={e => onChangeOffBudget(e.target.checked)}
              />
            </View>
            <View
              style={{
                overflowY: 'auto',
                flex: 1,
              }}
            >
              <Notes
                notes={
                  originalNotes && originalNotes.length > 0
                    ? originalNotes
                    : t('No notes')
                }
                editable={false}
                focused={false}
                getStyle={() => ({
                  borderRadius: 6,
                  ...((!originalNotes || originalNotes.length === 0) && {
                    justifySelf: 'center',
                    alignSelf: 'center',
                    color: theme.pageTextSubdued,
                  }),
                })}
              />
            </View>
            <View
              style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                justifyContent: 'space-between',
                alignContent: 'space-between',
                paddingTop: 10,
              }}
            >
              <Button style={buttonStyle} onPress={_onEditNotes}>
                <SvgNotesPaper
                  width={20}
                  height={20}
                  style={{ paddingRight: 5 }}
                />
                <Trans>Edit notes</Trans>
              </Button>
              {canReconcile && (
                <Button style={buttonStyle} onPress={() => onReconcile?.()}>
                  <SvgLockClosed
                    width={20}
                    height={20}
                    style={{ paddingRight: 5 }}
                  />
                  <Trans>Reconcile</Trans>
                </Button>
              )}
            </View>
          </View>
        </>
      )}
    </Modal>
  );
}

type AdditionalAccountMenuProps = {
  account: AccountEntity;
  onClose?: (accountId: string) => void;
  onReopen?: (accountId: string) => void;
  onToggleRunningBalance?: () => void;
  onToggleReconciled?: () => void;
};

function AdditionalAccountMenu({
  account,
  onClose,
  onReopen,
  onToggleRunningBalance,
  onToggleReconciled,
}: AdditionalAccountMenuProps) {
  const { t } = useTranslation();
  const triggerRef = useRef(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const itemStyle: CSSProperties = {
    ...styles.mediumText,
    height: styles.mobileMinHeight,
  };

  const getItemStyle: ComponentProps<typeof Menu>['getItemStyle'] = item => ({
    ...itemStyle,
    ...(item.name === 'close' && { color: theme.errorTextMenu }),
  });
  const [showBalances] = useSyncedPref(`show-balances-${account.id}`);
  const [hideReconciled] = useSyncedPref(`hide-reconciled-${account.id}`);

  return (
    <View>
      <Button
        ref={triggerRef}
        variant="bare"
        aria-label={t('Menu')}
        onPress={() => {
          setMenuOpen(true);
        }}
      >
        <SvgDotsHorizontalTriple
          width={17}
          height={17}
          style={{ color: 'currentColor' }}
        />
        <Popover
          triggerRef={triggerRef}
          isOpen={menuOpen}
          placement="bottom start"
          onOpenChange={() => setMenuOpen(false)}
        >
          <Menu
            getItemStyle={getItemStyle}
            items={[
              {
                name: 'balance',
                text:
                  showBalances === 'true'
                    ? t('Hide running balance')
                    : t('Show running balance'),
              },
              {
                name: 'toggle-reconciled',
                text:
                  hideReconciled !== 'true'
                    ? t('Hide reconciled transactions')
                    : t('Show reconciled transactions'),
              },
              account.closed
                ? {
                    name: 'reopen',
                    text: t('Reopen account'),
                    icon: SvgLockOpen,
                    iconSize: 15,
                  }
                : {
                    name: 'close',
                    text: t('Close account'),
                    icon: SvgClose,
                    iconSize: 15,
                  },
            ]}
            onMenuSelect={name => {
              setMenuOpen(false);
              switch (name) {
                case 'close':
                  onClose?.(account.id);
                  break;
                case 'reopen':
                  onReopen?.(account.id);
                  break;
                case 'balance':
                  onToggleRunningBalance?.();
                  break;
                case 'toggle-reconciled':
                  onToggleReconciled?.();
                  break;
                default:
                  throw new Error(`Unrecognized menu option: ${String(name)}`);
              }
            }}
          />
        </Popover>
      </Button>
    </View>
  );
}
