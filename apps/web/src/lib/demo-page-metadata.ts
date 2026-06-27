import type { Metadata } from 'next';
import { PRODUCT_NAME } from '@mesa/shared';

export function demoPageMetadata(suffix: string): Metadata {
  return { title: `${PRODUCT_NAME} ${suffix}` };
}
