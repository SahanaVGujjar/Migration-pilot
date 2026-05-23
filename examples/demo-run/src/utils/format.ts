const formatCurrency = (amount, currency = 'USD') => {
  return `${currency} ${amount.toFixed(2)}`;
};

const formatDate = (date) => {
  const d = new Date(date);
  return d.toISOString().split('T')[0];
};

function capitalize(str) {
  if (!str || str.length === 0) return '';
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

function truncate(text, maxLength = 100) {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
}

const slugify = (text) => {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-');
};

export default {
  formatCurrency,
  formatDate,
  capitalize,
  truncate,
  slugify,
};
