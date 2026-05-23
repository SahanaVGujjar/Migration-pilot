/**
 * @param {Number} a
 * @param {Number} b
 */
function add( a: any, b: any) {
  return a + b;
}

function subtract( a: any, b: any) {
  return a - b;
}

const multiply = ( a: any, b: any) => a * b;

function divide( a: any, b: any) {
  if (b === 0) {
    throw new Error('Division by zero');
  }
  return a / b;
}

const PI: number = 3.14159;
const MAX_RETRIES: number = 3;

export { add };
export { subtract };
export { multiply };
export { divide };
export { PI };
export { MAX_RETRIES };
