export function add(a: number, b: number): number {
  return a + b;
}

export function subtract(a: number, b: number): number {
  return a - b;
}

export const multiply = (a: number, b: number): number => a * b;

export function divide(a: number, b: number): number {
  if (b === 0) {
    throw new Error('Division by zero');
  }
  return a / b;
}

export const PI: number = 3.14159;
export const MAX_RETRIES: number = 3;

export default { add, subtract, multiply, divide, PI, MAX_RETRIES };