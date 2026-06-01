export const MAX_ORDER_NUMBER = 100;

/** Keyingi buyurtma raqami: 1..100, keyin yana 1. */
export function getNextOrderNumber(lastOrderNumber) {
  const last = Number(lastOrderNumber) || 0;
  return last >= MAX_ORDER_NUMBER ? 1 : last + 1;
}
