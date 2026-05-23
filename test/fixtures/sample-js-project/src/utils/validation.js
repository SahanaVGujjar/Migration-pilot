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
  email: isEmail,
  required: isRequired,
  minLength: isMinLength,
  maxLength: isMaxLength,
  numeric: isNumeric,
  inRange: isInRange,
};

exports.isEmail = isEmail;
exports.isRequired = isRequired;
exports.isMinLength = isMinLength;
exports.isMaxLength = isMaxLength;
exports.isNumeric = isNumeric;
exports.isInRange = isInRange;
exports.validators = validators;
