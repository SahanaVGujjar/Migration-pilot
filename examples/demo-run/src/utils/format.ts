const formatCurrency = ( amount: any, currency: string = 'USD') => {
  return `${currency} ${amount.toFixed(2)}`;
};

const formatDate = ( date: any) => {
  const d = new Date(date);
  return d.toISOString().split('T')[0];
};

function capitalize( str: string) {
  if (!str || str.length === 0) return '';
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

function truncate( text: string, maxLength: number = 100) {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
}

const slugify = ( text: string) => {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-');
};

export { formatCurrency };
export { formatDate };
export { capitalize };
export { truncate };
export { slugify };
