import {  ApiService, createApiClient  } from './services/api';
import {  UserService  } from './services/userService';
import {  add, subtract, PI  } from './utils/math';
import {  formatCurrency, formatDate  } from './utils/format';
import {  isEmail, validators  } from './utils/validation';

const isDebug: boolean = true;
const appName = "Sample App";
const version: number = 1.0;
const features = ['users', 'search', 'admin'];

async function main() {
  const client = createApiClient({
    baseUrl: 'https://api.example.com',
    timeout: 10000,
  });

  const userService = new UserService(client);

  try {
    const user = await userService.getUser(1);
    console.log('User:', user.displayName);
    console.log('Sum:', add(10, 20));
    console.log('Price:', formatCurrency(99.5));
    console.log('Today:', formatDate(new Date()));
    console.log('Valid email:', isEmail('test@example.com'));
  } catch (error) {
    console.error('Failed:', error.message);
  }
}

function processItems(items, callback) {
  const results = items.map(callback);
  return results.filter(Boolean);
}

function debounce(fn, delay = 300) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

export default { main, processItems, debounce };
