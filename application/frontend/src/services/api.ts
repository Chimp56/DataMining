import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor
api.interceptors.request.use(
  (config) => {
    // Add auth token if available
    const token = localStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Handle unauthorized access
      localStorage.removeItem('authToken');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// API endpoints
export const apiService = {
  // Dashboard endpoints
  getDashboardStats: () => api.get('/api/dashboard/stats'),
  
  // Vessel endpoints
  searchVessels: (params: {
    query: string;
    searchType: 'mmsi' | 'name' | 'imo';
    limit?: number;
    offset?: number;
  }) => api.get('/api/vessels/search', { params }),
  
  getVesselDetails: (mmsi: string) => api.get(`/api/vessels/${mmsi}`),
  
  getVesselHistory: (mmsi: string, timeframe: string) => 
    api.get(`/api/vessels/${mmsi}/history`, { params: { timeframe } }),
  
  // Map endpoints
  getVesselPositions: (bounds?: { north: number; south: number; east: number; west: number }) =>
    api.get('/api/map/vessels', { params: bounds }),
  
  getAISEvents: (bounds?: { north: number; south: number; east: number; west: number }) =>
    api.get('/api/map/ais-events', { params: bounds }),
  
  getRiskHotspots: (bounds?: { north: number; south: number; east: number; west: number }) =>
    api.get('/api/map/hotspots', { params: bounds }),
  
  // Prediction endpoints
  getPredictions: (params: {
    timeframe: string;
    riskLevel?: string;
    limit?: number;
    offset?: number;
  }) => api.get('/api/predictions', { params }),
  
  getPredictionDetails: (predictionId: string) => 
    api.get(`/api/predictions/${predictionId}`),
  
  updatePredictionStatus: (predictionId: string, status: 'confirmed' | 'false_positive') =>
    api.patch(`/api/predictions/${predictionId}/status`, { status }),
  
  runPredictionAnalysis: (params: {
    vesselIds?: string[];
    timeframe: string;
    includeFactors: boolean;
  }) => api.post('/api/predictions/analyze', params),
  
  // Analytics endpoints
  getAnalyticsData: (params: {
    period: string;
    metric: string;
    groupBy?: string;
  }) => api.get('/api/analytics', { params }),
  
  getRiskTrends: (period: string) => 
    api.get('/api/analytics/risk-trends', { params: { period } }),
  
  getAISDisablingStats: (period: string) =>
    api.get('/api/analytics/ais-disabling', { params: { period } }),
  
  getVesselTypeDistribution: () => api.get('/api/analytics/vessel-types'),
  
  getFlagStateAnalysis: () => api.get('/api/analytics/flag-states'),
  
  getModelPerformance: () => api.get('/api/analytics/model-performance'),
  
  // Export endpoints
  exportVesselData: (format: 'csv' | 'json' | 'xlsx', filters?: any) =>
    api.post('/api/export/vessels', { format, filters }),
  
  exportPredictionReport: (format: 'pdf' | 'csv' | 'xlsx', filters?: any) =>
    api.post('/api/export/predictions', { format, filters }),
  
  exportAnalyticsReport: (format: 'pdf' | 'csv' | 'xlsx', period: string) =>
    api.post('/api/export/analytics', { format, period }),
};

export default api;
