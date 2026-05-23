import { ApiService, createApiClient } from './services/api';
import { UserService } from './services/userService';
import { add, subtract, PI } from './utils/math';
import { formatCurrency, formatDate } from './utils/format';
import { isEmail, validators } from './utils/validation';

const isDebug: boolean = true;
const appName: string = "Sample App";
const version: number = 1.0;
const features: string[] = ['users', 'search', 'admin'];

async function main(): Promise<void> {
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

function processItems<T>(items: T[], callback: (item: T) => any): any[] {
  const results = items.map(callback);
  return results.filter(Boolean);
}

function debounce(fn: (...args: any[]) => void, delay: number = 300): (...args: any[]) => void {
  let timer: NodeJS.Timeout;
  return function (...args: any[]) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

export { main, processItems, debounce };