function isEmail(value: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(value);
}

function isRequired(value: any): boolean {
  return value !== null && value !== undefined && value !== '';
}

const isMinLength = (str: string, min: number = 1): boolean => {
  return str.length >= min;
};

const isMaxLength = (str: string, max: number = 255): boolean => {
  return str.length <= max;
};

function isNumeric(value: any): boolean {
  return !isNaN(parseFloat(value)) && isFinite(value);
}

function isInRange(num: number, min: number, max: number): boolean {
  return num >= min && num <= max;
}

const validators: { [key: string]: Function } = {
  email: isEmail,
  required: isRequired,
  minLength: isMinLength,
  maxLength: isMaxLength,
  numeric: isNumeric,
  inRange: isInRange,
};

export const isEmail = isEmail;
export const isRequired = isRequired;
export const isMinLength = isMinLength;
export const isMaxLength = isMaxLength;
export const isNumeric = isNumeric;
export const isInRange = isInRange;
export const validators = validators;