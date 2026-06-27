import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { UILanguage } from '@/lib/i18n';
import type { Order } from '@/types';
import {
  buildFeedbackInsights,
  buildTodayTopSellingItems,
} from '@/lib/dashboard-overview';
import { formatOrderDateTime, formatOverviewDate } from '@/lib/format-dashboard-date';

function order(partial: Partial<Order> & Pick<Order, 'id'>): Order {
  return {
    restaurant_id: 'r1',
    table_id: 't1',
    display_name: 'A1',
    status: 'done',
    items: [],
    total_amount: 12,
    created_at: '2026-06-27T14:30:00.000Z',
    updated_at: '2026-06-27T14:30:00.000Z',
    ...partial,
  };
}

/** Mirrors DashboardPageClient localized fields — one lang switch should update all display strings together. */
function localizedOverviewLabels(
  lang: UILanguage,
  todayOrders: Order[],
  recentOrders: Order[],
) {
  const feedbackSessions = [{ session_id: 's1', completed_at: '2026-06-27T12:00:00.000Z' }];
  const billedSplits = [{ session_id: 's1' }];
  const dishFeedbackRows = [
    {
      menu_item_id: 'd1',
      vote: 'down',
      reasons: ['cold'],
      menu_items: { name_zh: '鱼', name_pt: 'Peixe', name_en: 'Fish' },
    },
  ];

  const topItems = buildTodayTopSellingItems(todayOrders, lang);
  const feedback = buildFeedbackInsights(
    feedbackSessions,
    billedSplits,
    dishFeedbackRows,
    lang,
  );

  return {
    overviewDateLabel: formatOverviewDate(lang),
    topItemName: topItems[0]?.name ?? null,
    recentOrderTime: recentOrders[0]
      ? formatOrderDateTime(lang, recentOrders[0].created_at)
      : null,
    feedbackDishName: feedback.topIssues[0]?.dish_name ?? null,
  };
}

describe('dashboard overview client localization', () => {
  const todayOrders = [
    order({
      id: 'o1',
      items: [
        {
          id: 'd1',
          name: 'Fish',
          name_en: 'Fish',
          name_zh: '鱼',
          name_pt: 'Peixe',
          qty: 1,
          price: 12,
          emoji: '🐟',
        },
      ],
    }),
  ];
  const recentOrders = [order({ id: 'r1' })];

  it('updates all overview display fields when lang changes (no mixed locale)', () => {
    const zh = localizedOverviewLabels('zh', todayOrders, recentOrders);
    const en = localizedOverviewLabels('en', todayOrders, recentOrders);

    assert.match(zh.overviewDateLabel, /年/);
    assert.match(en.overviewDateLabel, /June/i);
    assert.equal(zh.topItemName, '鱼');
    assert.equal(en.topItemName, 'Fish');
    assert.equal(zh.feedbackDishName, '鱼');
    assert.equal(en.feedbackDishName, 'Fish');
    assert.notEqual(zh.recentOrderTime, en.recentOrderTime);
  });
});
