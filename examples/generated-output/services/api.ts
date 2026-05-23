import {  formatDate  } from '../utils/format';

const BASE_URL = 'https://api.example.com';
const DEFAULT_TIMEOUT: number = 5000;

class ApiService {
  constructor(baseUrl, options = {}) {
    this.baseUrl = baseUrl || BASE_URL;
    this.timeout = options.timeout || DEFAULT_TIMEOUT;
    this.headers = options.headers || {};
    this.retryCount = 0;
  }

  async get(endpoint, params = {}) {
    const url = this.buildUrl(endpoint, params);
    const response = await fetch(url, {
      method: 'GET',
      headers: this.getHeaders(),
      signal: AbortSignal.timeout(this.timeout),
    });
    return this.handleResponse(response);
  }

  async post(endpoint, data) {
    const url = this.buildUrl(endpoint);
    const response = await fetch(url, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });
    return this.handleResponse(response);
  }

  buildUrl(endpoint, params = {}) {
    const url = new URL(endpoint, this.baseUrl);
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.set(key, String(value));
    });
    return url.toString();
  }

  getHeaders() {
    return {
      'Content-Type': 'application/json',
      ...this.headers,
    };
  }

  async handleResponse(response) {
    if (!response.ok) {
      const error = new Error(`API Error: ${response.status}`);
      error.status = response.status;
      throw error;
    }
    const data = await response.json();
    data._fetchedAt = formatDate(new Date());
    return data;
  }
}

const createApiClient = (config) => {
  return new ApiService(config.baseUrl, config);
};

export default { ApiService, createApiClient, BASE_URL };
