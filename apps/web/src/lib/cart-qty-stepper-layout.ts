/**
 * Sole − / qty / + gap tokens for CartQtyStepper.
 * List MenuItemCard + cart drawer use compact; detail / waiter / sushi review keep default.
 */
export const CART_QTY_STEPPER_GAP_CLASS = {
  default: 'gap-2',
  compact: 'gap-1',
} as const;

export type CartQtyStepperDensity = keyof typeof CART_QTY_STEPPER_GAP_CLASS;
