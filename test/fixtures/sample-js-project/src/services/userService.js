const { ApiService } = require('./api');
const { isEmail, isRequired } = require('../utils/validation');
const { capitalize } = require('../utils/format');

class UserService {
  constructor(apiClient) {
    this.api = apiClient;
    this.cache = new Map();
  }

  async getUser(id) {
    if (this.cache.has(id)) {
      return this.cache.get(id);
    }

    const user = await this.api.get(`/users/${id}`);
    user.displayName = capitalize(user.firstName) + ' ' + capitalize(user.lastName);
    this.cache.set(id, user);
    return user;
  }

  async createUser(userData) {
    const errors = this.validateUser(userData);
    if (errors.length > 0) {
      throw new Error(`Validation failed: ${errors.join(', ')}`);
    }

    const user = await this.api.post('/users', userData);
    this.cache.set(user.id, user);
    return user;
  }

  async updateUser(id, updates) {
    const user = await this.api.post(`/users/${id}`, updates);
    this.cache.set(id, user);
    return user;
  }

  validateUser(data) {
    const errors = [];

    if (!isRequired(data.email)) {
      errors.push('Email is required');
    } else if (!isEmail(data.email)) {
      errors.push('Invalid email format');
    }

    if (!isRequired(data.firstName)) {
      errors.push('First name is required');
    }

    if (!isRequired(data.lastName)) {
      errors.push('Last name is required');
    }

    return errors;
  }

  clearCache() {
    this.cache.clear();
  }
}

module.exports = { UserService };
