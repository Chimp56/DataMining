import { useState, useEffect } from 'react';
import { apiService } from '../services/api';

interface UseApiState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

export function useApi<T>(
  apiCall: () => Promise<{ data: T }>,
  dependencies: any[] = []
): UseApiState<T> & { refetch: () => void } {
  const [state, setState] = useState<UseApiState<T>>({
    data: null,
    loading: true,
    error: null,
  });

  const fetchData = async () => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      const response = await apiCall();
      setState({
        data: response.data,
        loading: false,
        error: null,
      });
    } catch (error: any) {
      setState({
        data: null,
        loading: false,
        error: error.response?.data?.message || error.message || 'An error occurred',
      });
    }
  };

  useEffect(() => {
    fetchData();
  }, dependencies);

  return {
    ...state,
    refetch: fetchData,
  };
}

// Specific hooks for common API calls
export function useDashboardStats() {
  return useApi(() => apiService.getDashboardStats());
}

export function useVesselSearch(query: string, searchType: 'mmsi' | 'name' | 'imo') {
  return useApi(
    () => apiService.searchVessels({ query, searchType }),
    [query, searchType]
  );
}

export function useVesselDetails(mmsi: string) {
  return useApi(
    () => apiService.getVesselDetails(mmsi),
    [mmsi]
  );
}

export function usePredictions(timeframe: string, riskLevel?: string) {
  return useApi(
    () => apiService.getPredictions({ timeframe, riskLevel }),
    [timeframe, riskLevel]
  );
}

export function useAnalyticsData(period: string, metric: string) {
  return useApi(
    () => apiService.getAnalyticsData({ period, metric }),
    [period, metric]
  );
}
