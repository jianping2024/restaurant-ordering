'use client';

import { useMemo } from 'react';
import Select from 'react-select';
import type { MultiValue, StylesConfig } from 'react-select';
import type { RestaurantTableRow } from '@/lib/restaurant-tables';

export type DashboardTableOption = {
  value: string;
  label: string;
};

type Props = {
  tables: readonly RestaurantTableRow[];
  value: DashboardTableOption[];
  onChange: (next: DashboardTableOption[]) => void;
  /** Label prefix before display_name, e.g. `桌` / `Table` / `Mesa`. */
  tableWord: string;
  placeholder: string;
  noOptionsMessage: string;
  className?: string;
  classNamePrefix?: string;
  /** Accessible name for the control (when no visible label wraps it). */
  ariaLabel?: string;
};

/** Control chrome matches `@/components/ui/Input` (brand-card, rounded-lg, gold focus ring). */
const selectStyles: StylesConfig<DashboardTableOption, true> = {
  control: (base, state) => ({
    ...base,
    minHeight: 44,
    borderRadius: 8,
    backgroundColor: 'rgb(var(--color-brand-card))',
    borderColor: 'rgb(var(--color-brand-border))',
    boxShadow: state.isFocused ? '0 0 0 2px rgba(212, 175, 55, 0.5)' : 'none',
    '&:hover': { borderColor: 'rgb(var(--color-brand-border))' },
  }),
  placeholder: (base) => ({ ...base, color: 'rgb(var(--color-brand-text-muted))', fontSize: 14 }),
  menu: (base) => ({
    ...base,
    backgroundColor: 'rgb(var(--color-brand-card))',
    border: '1px solid rgb(var(--color-brand-border))',
    zIndex: 9999,
  }),
  menuPortal: (base) => ({ ...base, zIndex: 9999 }),
  menuList: (base) => ({ ...base, paddingTop: 4, paddingBottom: 4 }),
  option: (base, state) => ({
    ...base,
    fontSize: 14,
    color:
      state.isFocused || state.isSelected
        ? 'rgb(var(--color-brand-text))'
        : 'rgb(var(--color-brand-text-muted))',
    backgroundColor: state.isSelected
      ? 'rgba(212, 175, 55, 0.18)'
      : state.isFocused
        ? 'rgba(255, 255, 255, 0.06)'
        : 'transparent',
  }),
  multiValue: (base) => ({
    ...base,
    borderRadius: 6,
    backgroundColor: 'rgba(212, 175, 55, 0.16)',
    border: '1px solid rgba(212, 175, 55, 0.28)',
  }),
  multiValueLabel: (base) => ({ ...base, color: 'rgb(var(--color-brand-text))', fontSize: 13 }),
  multiValueRemove: (base) => ({
    ...base,
    color: 'rgb(var(--color-brand-text-muted))',
    ':hover': { backgroundColor: 'rgba(255,255,255,0.1)', color: 'rgb(var(--color-brand-text))' },
  }),
  input: (base) => ({ ...base, color: 'rgb(var(--color-brand-text))' }),
  singleValue: (base) => ({ ...base, color: 'rgb(var(--color-brand-text))' }),
  indicatorSeparator: (base) => ({ ...base, backgroundColor: 'rgb(var(--color-brand-border))' }),
  dropdownIndicator: (base) => ({ ...base, color: 'rgb(var(--color-brand-text-muted))' }),
  clearIndicator: (base) => ({ ...base, color: 'rgb(var(--color-brand-text-muted))' }),
};

/** Sole dashboard multi-select for restaurant table filter (order history + dish history). */
export function DashboardTableMultiSelect({
  tables,
  value,
  onChange,
  tableWord,
  placeholder,
  noOptionsMessage,
  className = 'w-full text-base',
  classNamePrefix = 'dashboard-table-select',
  ariaLabel,
}: Props) {
  const options = useMemo<DashboardTableOption[]>(
    () =>
      tables.map((row) => ({
        value: row.id,
        label: `${tableWord} ${row.display_name}`,
      })),
    [tableWord, tables],
  );

  return (
    <Select<DashboardTableOption, true>
      isMulti
      options={options}
      value={value}
      onChange={(next: MultiValue<DashboardTableOption>) => onChange([...next])}
      menuPortalTarget={typeof window !== 'undefined' ? window.document.body : null}
      menuPosition="fixed"
      placeholder={placeholder}
      styles={selectStyles}
      className={className}
      classNamePrefix={classNamePrefix}
      noOptionsMessage={() => noOptionsMessage}
      isClearable
      closeMenuOnSelect
      aria-label={ariaLabel ?? placeholder}
    />
  );
}
