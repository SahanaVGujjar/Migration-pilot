/**
 * @param {Number} a
 * @param {Number} b
 */
function add(a, b) {
  return a + b;
}

function subtract(a, b) {
  return a - b;
}

const multiply = (a, b) => a * b;

function divide(a, b) {
  if (b === 0) {
    throw new Error('Division by zero');
  }
  return a / b;
}

const PI= 3.14159;
const MAX_RETRIES= 3;

export default { add, subtract, multiply, divide, PI, MAX_RETRIES };
