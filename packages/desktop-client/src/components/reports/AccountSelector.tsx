import React, { useId, useMemo, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import {
  SvgCheckAll,
  SvgUncheckAll,
  SvgViewHide,
  SvgViewShow,
} from '@actual-app/components/icons/v2';
import { Text } from '@actual-app/components/text';
import { View } from '@actual-app/components/view';
import type { AccountEntity } from '@actual-app/core/types/models';

import { Checkbox } from '#components/forms';

import { GraphButton } from './GraphButton';

type AccountSelectorProps = {
  accounts: AccountEntity[];
  selectedAccountIds: string[];
  setSelectedAccountIds: (selectedAccountIds: string[]) => void;
};

export function AccountSelector({
  accounts,
  selectedAccountIds,
  setSelectedAccountIds,
}: AccountSelectorProps) {
  const { t } = useTranslation();
  const idPrefix = useId();
  const [uncheckedHidden, setUncheckedHidden] = useState(false);

  // Group accounts by checking, credit cards, off-budget, and closed
  const groupedAccounts = useMemo(() => {
    const checking = accounts.filter(
      account =>
        !account.offbudget && !account.closed && account.type !== 'credit',
    );
    const credit = accounts.filter(
      account =>
        !account.offbudget && !account.closed && account.type === 'credit',
    );
    const offBudget = accounts.filter(
      account => account.offbudget && !account.closed,
    );
    const closed = accounts.filter(account => account.closed);
    return { checking, credit, offBudget, closed };
  }, [accounts]);

  const selectedAccountMap = useMemo(
    () => new Set(selectedAccountIds),
    [selectedAccountIds],
  );

  const onBudgetAccountIds = useMemo(
    () => [
      ...groupedAccounts.checking.map(a => a.id),
      ...groupedAccounts.credit.map(a => a.id),
    ],
    [groupedAccounts],
  );

  // Calculate selection states for each group
  const onBudgetSelected =
    onBudgetAccountIds.length > 0 &&
    onBudgetAccountIds.every(id => selectedAccountMap.has(id));
  const checkingSelected =
    groupedAccounts.checking.length > 0 &&
    groupedAccounts.checking.every(account =>
      selectedAccountMap.has(account.id),
    );
  const creditSelected =
    groupedAccounts.credit.length > 0 &&
    groupedAccounts.credit.every(account => selectedAccountMap.has(account.id));
  const offBudgetSelected =
    groupedAccounts.offBudget.length > 0 &&
    groupedAccounts.offBudget.every(account =>
      selectedAccountMap.has(account.id),
    );
  const closedSelected =
    groupedAccounts.closed.length > 0 &&
    groupedAccounts.closed.every(account => selectedAccountMap.has(account.id));

  const allAccountsSelected =
    (onBudgetAccountIds.length === 0 || onBudgetSelected) &&
    (groupedAccounts.offBudget.length === 0 || offBudgetSelected) &&
    (groupedAccounts.closed.length === 0 || closedSelected);
  const allAccountsUnselected = !selectedAccountIds.length;

  function toggleAccountGroup(
    groupAccountIds: string[],
    isAllSelected: boolean,
  ) {
    if (isAllSelected) {
      setSelectedAccountIds(
        selectedAccountIds.filter(id => !groupAccountIds.includes(id)),
      );
    } else {
      const newSelection = [...selectedAccountIds];
      groupAccountIds.forEach(id => {
        if (!newSelection.includes(id)) {
          newSelection.push(id);
        }
      });
      setSelectedAccountIds(newSelection);
    }
  }

  return (
    <View>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          marginBottom: 5,
          flexShrink: 0,
        }}
      >
        <Button
          variant="bare"
          onPress={() => setUncheckedHidden(state => !state)}
          style={{ padding: 8 }}
        >
          <View>
            {uncheckedHidden ? (
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <SvgViewShow
                  width={15}
                  height={15}
                  style={{ marginRight: 5 }}
                />
                <Text style={{ whiteSpace: 'nowrap' }}>
                  <Trans>Show unchecked</Trans>
                </Text>
              </View>
            ) : (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                }}
              >
                <SvgViewHide
                  width={15}
                  height={15}
                  style={{ marginRight: 5 }}
                />
                <Text style={{ whiteSpace: 'nowrap' }}>
                  <Trans>Hide unchecked</Trans>
                </Text>
              </View>
            )}
          </View>
        </Button>
        <View style={{ flex: 1 }} />
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <GraphButton
            selected={allAccountsSelected}
            title={t('Select All')}
            onSelect={() => {
              setSelectedAccountIds(accounts.map(account => account.id));
            }}
            style={{ marginRight: 5, padding: 8 }}
          >
            <SvgCheckAll width={15} height={15} />
          </GraphButton>
          <GraphButton
            selected={allAccountsUnselected}
            title={t('Unselect All')}
            onSelect={() => {
              setSelectedAccountIds([]);
            }}
            style={{ padding: 8 }}
          >
            <SvgUncheckAll width={15} height={15} />
          </GraphButton>
        </View>
      </View>

      <ul
        style={{
          listStyle: 'none',
          marginLeft: 0,
          paddingLeft: 0,
          paddingRight: 10,
          flexGrow: 1,
          overflowY: 'auto',
        }}
      >
        {/* On Budget Section */}
        {onBudgetAccountIds.length > 0 && (
          <>
            <li
              style={{
                display: !onBudgetSelected && uncheckedHidden ? 'none' : 'flex',
                flexDirection: 'row',
                alignItems: 'center',
                marginBottom: 8,
                marginTop: 8,
              }}
            >
              <Checkbox
                id={`${idPrefix}-group-onbudget`}
                checked={onBudgetSelected}
                onChange={() =>
                  toggleAccountGroup(onBudgetAccountIds, onBudgetSelected)
                }
              />
              <label
                htmlFor={`${idPrefix}-group-onbudget`}
                style={{ userSelect: 'none', fontWeight: 'bold' }}
              >
                <Trans>On Budget</Trans>
              </label>
            </li>

            {/* Checking Accounts Subgroup */}
            {groupedAccounts.checking.length > 0 && (
              <>
                <li
                  style={{
                    display:
                      !checkingSelected && uncheckedHidden ? 'none' : 'flex',
                    flexDirection: 'row',
                    alignItems: 'center',
                    marginBottom: 6,
                    marginTop: 4,
                    marginLeft: 16,
                  }}
                >
                  <Checkbox
                    id={`${idPrefix}-subgroup-checking`}
                    checked={checkingSelected}
                    onChange={() =>
                      toggleAccountGroup(
                        groupedAccounts.checking.map(a => a.id),
                        checkingSelected,
                      )
                    }
                  />
                  <label
                    htmlFor={`${idPrefix}-subgroup-checking`}
                    style={{ userSelect: 'none', fontWeight: 600 }}
                  >
                    <Trans>Checking accounts</Trans>
                  </label>
                </li>
                {groupedAccounts.checking.map(account => {
                  const isChecked = selectedAccountMap.has(account.id);
                  const inputId = `${idPrefix}-account-${account.id}`;
                  return (
                    <li
                      key={account.id}
                      style={{
                        display:
                          !isChecked && uncheckedHidden ? 'none' : 'flex',
                        flexDirection: 'row',
                        alignItems: 'center',
                        marginBottom: 4,
                        marginLeft: 32,
                      }}
                    >
                      <Checkbox
                        id={inputId}
                        checked={isChecked}
                        onChange={() => {
                          if (isChecked) {
                            setSelectedAccountIds(
                              selectedAccountIds.filter(
                                id => id !== account.id,
                              ),
                            );
                          } else {
                            setSelectedAccountIds([
                              ...selectedAccountIds,
                              account.id,
                            ]);
                          }
                        }}
                      />
                      <label htmlFor={inputId} style={{ userSelect: 'none' }}>
                        {account.name}
                      </label>
                    </li>
                  );
                })}
              </>
            )}

            {/* Credit Card Accounts Subgroup */}
            {groupedAccounts.credit.length > 0 && (
              <>
                <li
                  style={{
                    display:
                      !creditSelected && uncheckedHidden ? 'none' : 'flex',
                    flexDirection: 'row',
                    alignItems: 'center',
                    marginBottom: 6,
                    marginTop: 8,
                    marginLeft: 16,
                  }}
                >
                  <Checkbox
                    id={`${idPrefix}-subgroup-credit`}
                    checked={creditSelected}
                    onChange={() =>
                      toggleAccountGroup(
                        groupedAccounts.credit.map(a => a.id),
                        creditSelected,
                      )
                    }
                  />
                  <label
                    htmlFor={`${idPrefix}-subgroup-credit`}
                    style={{ userSelect: 'none', fontWeight: 600 }}
                  >
                    <Trans>Credit cards</Trans>
                  </label>
                </li>
                {groupedAccounts.credit.map(account => {
                  const isChecked = selectedAccountMap.has(account.id);
                  const inputId = `${idPrefix}-account-${account.id}`;
                  return (
                    <li
                      key={account.id}
                      style={{
                        display:
                          !isChecked && uncheckedHidden ? 'none' : 'flex',
                        flexDirection: 'row',
                        alignItems: 'center',
                        marginBottom: 4,
                        marginLeft: 32,
                      }}
                    >
                      <Checkbox
                        id={inputId}
                        checked={isChecked}
                        onChange={() => {
                          if (isChecked) {
                            setSelectedAccountIds(
                              selectedAccountIds.filter(
                                id => id !== account.id,
                              ),
                            );
                          } else {
                            setSelectedAccountIds([
                              ...selectedAccountIds,
                              account.id,
                            ]);
                          }
                        }}
                      />
                      <label htmlFor={inputId} style={{ userSelect: 'none' }}>
                        {account.name}
                      </label>
                    </li>
                  );
                })}
              </>
            )}
          </>
        )}

        {/* Off Budget Accounts */}
        {groupedAccounts.offBudget.length > 0 && (
          <>
            <li
              style={{
                display:
                  !offBudgetSelected && uncheckedHidden ? 'none' : 'flex',
                flexDirection: 'row',
                alignItems: 'center',
                marginBottom: 8,
                marginTop: 16,
              }}
            >
              <Checkbox
                id={`${idPrefix}-group-offbudget`}
                checked={offBudgetSelected}
                onChange={() =>
                  toggleAccountGroup(
                    groupedAccounts.offBudget.map(a => a.id),
                    offBudgetSelected,
                  )
                }
              />
              <label
                htmlFor={`${idPrefix}-group-offbudget`}
                style={{ userSelect: 'none', fontWeight: 'bold' }}
              >
                <Trans>Off Budget</Trans>
              </label>
            </li>
            {groupedAccounts.offBudget.map(account => {
              const isChecked = selectedAccountMap.has(account.id);
              const inputId = `${idPrefix}-account-${account.id}`;
              return (
                <li
                  key={account.id}
                  style={{
                    display: !isChecked && uncheckedHidden ? 'none' : 'flex',
                    flexDirection: 'row',
                    alignItems: 'center',
                    marginBottom: 4,
                    marginLeft: 16,
                  }}
                >
                  <Checkbox
                    id={inputId}
                    checked={isChecked}
                    onChange={() => {
                      if (isChecked) {
                        setSelectedAccountIds(
                          selectedAccountIds.filter(id => id !== account.id),
                        );
                      } else {
                        setSelectedAccountIds([
                          ...selectedAccountIds,
                          account.id,
                        ]);
                      }
                    }}
                  />
                  <label htmlFor={inputId} style={{ userSelect: 'none' }}>
                    {account.name}
                  </label>
                </li>
              );
            })}
          </>
        )}

        {/* Closed Accounts */}
        {groupedAccounts.closed.length > 0 && (
          <>
            <li
              style={{
                display: !closedSelected && uncheckedHidden ? 'none' : 'flex',
                flexDirection: 'row',
                alignItems: 'center',
                marginBottom: 8,
                marginTop: 16,
              }}
            >
              <Checkbox
                id={`${idPrefix}-group-closed`}
                checked={closedSelected}
                onChange={() =>
                  toggleAccountGroup(
                    groupedAccounts.closed.map(a => a.id),
                    closedSelected,
                  )
                }
              />
              <label
                htmlFor={`${idPrefix}-group-closed`}
                style={{ userSelect: 'none', fontWeight: 'bold' }}
              >
                <Trans>Closed</Trans>
              </label>
            </li>
            {groupedAccounts.closed.map(account => {
              const isChecked = selectedAccountMap.has(account.id);
              const inputId = `${idPrefix}-account-${account.id}`;
              return (
                <li
                  key={account.id}
                  style={{
                    display: !isChecked && uncheckedHidden ? 'none' : 'flex',
                    flexDirection: 'row',
                    alignItems: 'center',
                    marginBottom: 4,
                    marginLeft: 16,
                  }}
                >
                  <Checkbox
                    id={inputId}
                    checked={isChecked}
                    onChange={() => {
                      if (isChecked) {
                        setSelectedAccountIds(
                          selectedAccountIds.filter(id => id !== account.id),
                        );
                      } else {
                        setSelectedAccountIds([
                          ...selectedAccountIds,
                          account.id,
                        ]);
                      }
                    }}
                  />
                  <label htmlFor={inputId} style={{ userSelect: 'none' }}>
                    {account.name}
                  </label>
                </li>
              );
            })}
          </>
        )}
      </ul>
    </View>
  );
}
