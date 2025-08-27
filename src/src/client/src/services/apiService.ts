import axios, { AxiosInstance, AxiosResponse } from 'axios';

class ApiService {
  private api: AxiosInstance;
  
  constructor() {
    this.api = axios.create({
      baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add request interceptor to include auth token
    this.api.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem('authToken');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Add response interceptor to handle auth errors
    this.api.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          // Clear auth token and redirect to login
          localStorage.removeItem('authToken');
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
    );
  }

  setAuthToken(token: string) {
    localStorage.setItem('authToken', token);
  }

  clearAuthToken() {
    localStorage.removeItem('authToken');
  }

  // Auth endpoints
  async getCurrentUser() {
    const response = await this.api.get('/auth/me');
    return response.data;
  }

  async logout() {
    try {
      await this.api.post('/auth/logout');
    } finally {
      this.clearAuthToken();
    }
  }

  // User endpoints
  async getUserProfile() {
    const response = await this.api.get('/users/profile');
    return response.data;
  }

  async updateUserProfile(data: { name: string; email: string }) {
    const response = await this.api.put('/users/profile', data);
    return response.data;
  }

  async getUserStats() {
    const response = await this.api.get('/users/stats');
    return response.data;
  }

  async getUserActivity(page = 1, limit = 20) {
    const response = await this.api.get(`/users/activity?page=${page}&limit=${limit}`);
    return response.data;
  }

  // Repository endpoints
  async getRepositories() {
    const response = await this.api.get('/repositories');
    return response.data;
  }

  async getGitHubRepositories() {
    const response = await this.api.get('/repositories/github');
    return response.data;
  }

  async importRepository(repositoryId: string, provider = 'GITHUB') {
    const response = await this.api.post('/repositories/import', {
      repositoryId,
      provider
    });
    return response.data;
  }

  async getRepository(id: string) {
    const response = await this.api.get(`/repositories/${id}`);
    return response.data;
  }

  async analyzeRepository(id: string, options = {}) {
    const response = await this.api.post(`/repositories/${id}/analyze`, options);
    return response.data;
  }

  async deleteRepository(id: string) {
    const response = await this.api.delete(`/repositories/${id}`);
    return response.data;
  }

  async getRepositoryAnalyses(id: string, page = 1, limit = 20) {
    const response = await this.api.get(`/repositories/${id}/analyses?page=${page}&limit=${limit}`);
    return response.data;
  }

  // Analysis endpoints
  async getAnalysis(id: string) {
    const response = await this.api.get(`/analysis/${id}`);
    return response.data;
  }

  async getAnalysisSummary(options = {}) {
    const params = new URLSearchParams(options as any).toString();
    const response = await this.api.get(`/analysis?${params}`);
    return response.data;
  }

  async getAnalysisTrends(repositoryId?: string, days = 30) {
    const params = new URLSearchParams();
    if (repositoryId) params.append('repositoryId', repositoryId);
    params.append('days', days.toString());
    
    const response = await this.api.get(`/analysis/trends/chart?${params}`);
    return response.data;
  }

  async compareAnalyses(analysisId1: string, analysisId2: string) {
    const response = await this.api.get(`/analysis/compare/${analysisId1}/${analysisId2}`);
    return response.data;
  }

  // Subscription endpoints
  async getCurrentSubscription() {
    const response = await this.api.get('/subscriptions/current');
    return response.data;
  }

  async getPlans() {
    const response = await this.api.get('/subscriptions/plans');
    return response.data;
  }

  async createCheckoutSession(plan: string, billingInterval = 'MONTH') {
    const response = await this.api.post('/subscriptions/checkout', {
      plan,
      billingInterval
    });
    return response.data;
  }

  async createPortalSession() {
    const response = await this.api.post('/subscriptions/portal');
    return response.data;
  }

  async getBillingHistory() {
    const response = await this.api.get('/subscriptions/billing-history');
    return response.data;
  }

  async cancelSubscription(reason?: string) {
    const response = await this.api.post('/subscriptions/cancel', { reason });
    return response.data;
  }

  async reactivateSubscription() {
    const response = await this.api.post('/subscriptions/reactivate');
    return response.data;
  }

  async getUsageStats(timeframe = '30d') {
    const response = await this.api.get(`/subscriptions/usage?timeframe=${timeframe}`);
    return response.data;
  }
}

export const apiService = new ApiService();