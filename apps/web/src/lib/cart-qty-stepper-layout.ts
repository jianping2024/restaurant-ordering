/**
 * Sole − / qty / + gap tokens for CartQtyStepper.
 * List MenuItemCard uses compact; cart / detail / waiter / sushi keep default.
 */
export const CART_QTY_STEPPER_GAP_CLASS = {
  default: 'gap-2',
  compact: 'gap-1',
} as const;

export type CartQtyStepperDensity = keyof typeof CART_QTY_STEPPER_GAP_CLASS;
