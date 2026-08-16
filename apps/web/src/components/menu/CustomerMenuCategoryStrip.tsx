'use client';

import { CUSTOMER_MENU_TYPE } from '@/lib/customer-menu-type';

export type CustomerMenuCategoryOption = {
  id: string;
  label: string;
};

type Props = {
  topCategories: CustomerMenuCategoryOption[];
  activeTopId: string;
  onSelectTop: (id: string) => void;
  subCategories: CustomerMenuCategoryOption[];
  activeSubpath: string;
  onSelectSubpath: (id: string) => void;
  subcategoryAllLabel: string;
};

const topIdleClass = 'border-transparent text-brand-text';
const topActiveClass = `border-brand-gold text-brand-gold ${CUSTOMER_MENU_TYPE.categoryTopActive}`;
const subIdleClass = 'border-brand-border text-brand-text';
const subActiveClass = 'bg-brand-gold/20 border-brand-gold/40 text-brand-gold';

/** Sole top + sub category chip strip for customer menu (standard + sushi). */
export function CustomerMenuCategoryStrip({
  topCategories,
  activeTopId,
  onSelectTop,
  subCategories,
  activeSubpath,
  onSelectSubpath,
  subcategoryAllLabel,
}: Props) {
  return (
    <>
      <div className="mesa-chip-scroll flex gap-0 px-4 pb-3">
        {topCategories.map((cat) => (
          <button
            key={cat.id}
            type="button"
            title={cat.label}
            onClick={() => onSelectTop(cat.id)}
            className={`max-w-[9.5rem] flex-shrink-0 truncate px-4 py-2.5 ${CUSTOMER_MENU_TYPE.categoryTop} transition-all border-b-2 ${
              activeTopId === cat.id ? topActiveClass : topIdleClass
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {subCategories.length > 0 ? (
        <div className="mesa-chip-scroll flex gap-2 px-4 pb-3">
          <button
            type="button"
            onClick={() => onSelectSubpath('')}
            className={`flex-shrink-0 px-3 py-2 ${CUSTOMER_MENU_TYPE.categorySub} rounded-full border transition-colors ${
              activeSubpath === '' ? subActiveClass : subIdleClass
            }`}
          >
            {subcategoryAllLabel}
          </button>
          {subCategories.map((sub) => (
            <button
              key={sub.id}
              type="button"
              title={sub.label}
              onClick={() => onSelectSubpath(sub.id)}
              className={`max-w-[9.5rem] flex-shrink-0 truncate px-3 py-2 ${CUSTOMER_MENU_TYPE.categorySub} rounded-full border transition-colors ${
                activeSubpath === sub.id ? subActiveClass : subIdleClass
              }`}
            >
              {sub.label}
            </button>
          ))}
        </div>
      ) : null}
    </>
  );
}
