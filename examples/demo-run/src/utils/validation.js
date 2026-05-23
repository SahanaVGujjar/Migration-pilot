function isEmail(value) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(value);
}

function isRequired(value) {
  return value !== null && value !== undefined && value !== '';
}

const isMinLength = (str, min = 1) => {
  return str.length >= min;
};

const isMaxLength = (str, max = 255) => {
  return str.length <= max;
};

function isNumeric(value) {
  return !isNaN(parseFloat(value)) && isFinite(value);
}

function isInRange(num, min, max) {
  return num >= min && num <= max;
}

const validators = {
  email,
  required,
  minLength,
  maxLength,
  numeric,
  inRange,
};

export const isEmail = isEmail;
export const isRequired = isRequired;
export const isMinLength = isMinLength;
export const isMaxLength = isMaxLength;
export const isNumeric = isNumeric;
export const isInRange = isInRange;
export const validators = validators;
