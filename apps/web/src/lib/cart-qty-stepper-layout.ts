/**
 * Sole − / qty / + gap tokens for CartQtyStepper.
 * Cart drawer uses compact; detail / waiter / sushi review keep default.
 * Catalog MenuItemCard does not use CartQtyStepper (gold circle + qty pill).
 */
export const CART_QTY_STEPPER_GAP_CLASS = {
  default: 'gap-2',
  compact: 'gap-1',
} as const;

export type CartQtyStepperDensity = keyof typeof CART_QTY_STEPPER_GAP_CLASS;
