import {
  CUSTOMER_MENU_CATEGORY_RAIL_WIDTH_CLASS,
  customerMenuShellRootClass,
} from '@/lib/customer-menu-chrome-layout';
import { CUSTOMER_MENU_ITEM_LIST_CLASS } from '@/lib/menu-item-card-layout';

export default function CustomerMenuLoading() {
  return (
    <div className={`min-h-screen bg-brand-bg ${customerMenuShellRootClass} animate-pulse`}>
      <div className="border-b border-brand-border/40 px-4 py-3">
        <div className="h-6 w-32 rounded bg-brand-border/40" />
        <div className="mt-2 h-4 w-20 rounded bg-brand-border/30" />
      </div>
      <div className="flex items-start">
        <div
          className={`${CUSTOMER_MENU_CATEGORY_RAIL_WIDTH_CLASS} shrink-0 space-y-2 border-r border-brand-border/40 px-1 py-3`}
        >
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="mx-auto h-8 w-10 rounded bg-brand-border/40" />
          ))}
        </div>
        <div className="min-w-0 flex-1 px-3 py-3">
          <div className={CUSTOMER_MENU_ITEM_LIST_CLASS}>
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="space-y-2 rounded-xl border border-brand-border/40 p-4">
                <div className="h-5 w-3/5 rounded bg-brand-border/40" />
                <div className="h-4 w-full rounded bg-brand-border/30" />
                <div className="flex justify-between pt-1">
                  <div className="h-8 w-20 rounded-lg bg-brand-border/40" />
                  <div className="h-8 w-8 rounded-full bg-brand-border/40" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
