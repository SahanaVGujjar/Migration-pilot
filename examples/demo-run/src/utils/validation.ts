function isEmail( value: any) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(value);
}

function isRequired( value: any) {
  return value !== null && value !== undefined && value !== '';
}

const isMinLength = ( str: string | any[], min: number = 1) => {
  return str.length >= min;
};

const isMaxLength = ( str: string | any[], max: number = 255) => {
  return str.length <= max;
};

function isNumeric( value: any) {
  return !isNaN(parseFloat(value)) && isFinite(value);
}

function isInRange( num: any, min: any, max: any) {
  return num >= min && num <= max;
}

const validators = {
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
