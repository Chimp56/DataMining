const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// Helper function to build query string from params
function buildQueryString(params: Record<string, any>): string {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      searchParams.append(key, String(value));
    }
  });
  const queryString = searchParams.toString();
  return queryString ? `?${queryString}` : '';
}

// Helper function to get auth headers
function getAuthHeaders(): HeadersInit {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  
  const token = localStorage.getItem('authToken');
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  return headers;
}

// Helper function to handle response
async function handleResponse<T>(response: Response): Promise<{ data: T }> {
  if (!response.ok) {
    if (response.status === 401) {
      // Handle unauthorized access
      localStorage.removeItem('authToken');
      window.location.href = '/login';
    }
    const error = await response.json().catch(() => ({ detail: response.statusText }));
    throw { response: { status: response.status, data: error } };
  }
  
  const data = await response.json();
  return { data };
}

// API client using fetch
const api = {
  get: async <T = any>(url: string, config?: { params?: Record<string, any> }): Promise<{ data: T }> => {
    const queryString = config?.params ? buildQueryString(config.params) : '';
    const fullUrl = `${API_BASE_URL}${url}${queryString}`;
    
    const response = await fetch(fullUrl, {
      method: 'GET',
      headers: getAuthHeaders(),
    });
    
    return handleResponse<T>(response);
  },
  
  post: async <T = any>(url: string, data?: any, config?: { params?: Record<string, any> }): Promise<{ data: T }> => {
    const queryString = config?.params ? buildQueryString(config.params) : '';
    const fullUrl = `${API_BASE_URL}${url}${queryString}`;
    
    const response = await fetch(fullUrl, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: data ? JSON.stringify(data) : undefined,
    });
    
    return handleResponse<T>(response);
  },
  
  patch: async <T = any>(url: string, data?: any): Promise<{ data: T }> => {
    const response = await fetch(`${API_BASE_URL}${url}`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: data ? JSON.stringify(data) : undefined,
    });
    
    return handleResponse<T>(response);
  },
  
  put: async <T = any>(url: string, data?: any): Promise<{ data: T }> => {
    const response = await fetch(`${API_BASE_URL}${url}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: data ? JSON.stringify(data) : undefined,
    });
    
    return handleResponse<T>(response);
  },
  
  delete: async <T = any>(url: string): Promise<{ data: T }> => {
    const response = await fetch(`${API_BASE_URL}${url}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    
    return handleResponse<T>(response);
  },
};

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
  
  // Model training endpoints
  trainModel: (retrain: boolean = true) =>
    api.post('/api/model/train', undefined, { params: { retrain: retrain } }),
  
  // Hotspot analysis endpoints
  getGlobalHotspots: (params: { start_year?: number; end_year?: number }) =>
    api.get('/api/hotspots/global', { params }),
  
  getVesselHotspots: (mmsi: string, params: { start_year?: number; end_year?: number }) =>
    api.get(`/api/hotspots/vessel/${mmsi}`, { params }),
};

export default api;
