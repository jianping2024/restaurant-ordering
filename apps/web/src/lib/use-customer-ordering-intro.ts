'use client';

import { useCallback, useEffect, useState } from 'react';
import type { CustomerOrderingAudience } from '@/lib/customer-ordering-audience';
import {
  hasSeenCustomerOrderingIntro,
  markCustomerOrderingIntroSeen,
  shouldShowCustomerOrderingIntro,
} from '@/lib/customer-ordering-intro-preference';

type Params = {
  restaurantSlug: string;
  audience: CustomerOrderingAudience;
  sessionResolved: boolean;
};

export function useCustomerOrderingIntro({
  restaurantSlug,
  audience,
  sessionResolved,
}: Params) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!sessionResolved) return;
    const hasSeenIntro = hasSeenCustomerOrderingIntro(restaurantSlug);
    setVisible(
      shouldShowCustomerOrderingIntro({
        audience,
        sessionResolved,
        hasSeenIntro,
      }),
    );
  }, [audience, restaurantSlug, sessionResolved]);

  const dismiss = useCallback(() => {
    markCustomerOrderingIntroSeen(restaurantSlug);
    setVisible(false);
  }, [restaurantSlug]);

  return { visible, dismiss };
}
