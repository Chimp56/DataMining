import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { apiService } from '../services/api';

interface EEZBoundaryItem {
  id?: number;
  line_id: number | null;
  line_name: string | null;
  line_type: string | null;
  territory1: string | null;
  sovereign1: string | null;
  territory2: string | null;
  sovereign2: string | null;
  eez1: string | null;
  eez2: string | null;
  length_km: number | null;
  geometry?: any; // GeoJSON geometry
}

interface MPAItem {
  id?: number;
  wdpaid: number | null;
  name: string | null;
  orig_name: string | null;
  desig_eng: string | null;
  iucn_cat: string | null;
  iso3: string | null;
  gis_m_area: number | null;
  status: string | null;
  geometry?: any; // GeoJSON geometry
}

interface MapDataContextType {
  eezBoundaries: EEZBoundaryItem[];
  mpaData: MPAItem[];
  loading: boolean;
  error: string | null;
  refreshEEZ: () => Promise<void>;
  refreshMPA: () => Promise<void>;
}

const MapDataContext = createContext<MapDataContextType | undefined>(undefined);

const CACHE_KEY_EEZ = 'eez_boundaries_cache';
const CACHE_KEY_MPA = 'mpa_data_cache';
const CACHE_TTL = 3600000; // 1 hour in milliseconds

export const MapDataProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [eezBoundaries, setEezBoundaries] = useState<EEZBoundaryItem[]>([]);
  const [mpaData, setMpaData] = useState<MPAItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadEEZFromCache = (): EEZBoundaryItem[] | null => {
    try {
      const cached = localStorage.getItem(CACHE_KEY_EEZ);
      const cacheTime = localStorage.getItem(`${CACHE_KEY_EEZ}_time`);
      const now = Date.now();

      if (cached && cacheTime && (now - parseInt(cacheTime)) < CACHE_TTL) {
        return JSON.parse(cached);
      }
    } catch (e) {
      console.warn('Failed to load EEZ boundaries from cache', e);
    }
    return null;
  };

  const loadMPAFromCache = (): MPAItem[] | null => {
    try {
      const cached = localStorage.getItem(CACHE_KEY_MPA);
      const cacheTime = localStorage.getItem(`${CACHE_KEY_MPA}_time`);
      const now = Date.now();

      if (cached && cacheTime && (now - parseInt(cacheTime)) < CACHE_TTL) {
        return JSON.parse(cached);
      }
    } catch (e) {
      console.warn('Failed to load MPA data from cache', e);
    }
    return null;
  };

  const saveEEZToCache = (data: EEZBoundaryItem[]) => {
    try {
      localStorage.setItem(CACHE_KEY_EEZ, JSON.stringify(data));
      localStorage.setItem(`${CACHE_KEY_EEZ}_time`, Date.now().toString());
    } catch (e) {
      console.warn('Failed to save EEZ boundaries to cache', e);
    }
  };

  const saveMPAToCache = (data: MPAItem[]) => {
    try {
      localStorage.setItem(CACHE_KEY_MPA, JSON.stringify(data));
      localStorage.setItem(`${CACHE_KEY_MPA}_time`, Date.now().toString());
    } catch (e) {
      console.warn('Failed to save MPA data to cache', e);
    }
  };

  const loadEEZBoundaries = async (useCache: boolean = true) => {
    try {
      // Try cache first
      if (useCache) {
        const cached = loadEEZFromCache();
        if (cached) {
          setEezBoundaries(cached);
          console.log(`Loaded ${cached.length} EEZ boundaries from cache`);
          return;
        }
      }

      // Load from API - start with smaller limit for faster initial load
      const response = await apiService.getEEZBoundariesForMap({ limit: 500 });
      if (response.data && response.data.items) {
        setEezBoundaries(response.data.items);
        saveEEZToCache(response.data.items);
        console.log(`Loaded ${response.data.items.length} EEZ boundaries from API`);

        // Load more in background if available
        if (response.data.total > 500) {
          setTimeout(async () => {
            try {
              const fullResponse = await apiService.getEEZBoundariesForMap({ limit: 2000 });
              if (fullResponse.data && fullResponse.data.items) {
                setEezBoundaries(fullResponse.data.items);
                saveEEZToCache(fullResponse.data.items);
                console.log(`Loaded full EEZ boundaries set (${fullResponse.data.items.length} features)`);
              }
            } catch (err) {
              console.warn('Failed to load full EEZ boundaries set', err);
            }
          }, 2000);
        }
      }
    } catch (err: any) {
      console.error('Error loading EEZ boundaries:', err);
      setError(err.message || 'Failed to load EEZ boundaries');
    }
  };

  const loadMPAData = async (useCache: boolean = true) => {
    try {
      // Try cache first
      if (useCache) {
        const cached = loadMPAFromCache();
        if (cached) {
          setMpaData(cached);
          console.log(`Loaded ${cached.length} MPAs from cache`);
          return;
        }
      }

      // Load from API
      const response = await apiService.getMPAForMap({ limit: 1000 });
      if (response.data && response.data.items) {
        setMpaData(response.data.items);
        saveMPAToCache(response.data.items);
        console.log(`Loaded ${response.data.items.length} MPAs from API`);
      }
    } catch (err: any) {
      console.error('Error loading MPA data:', err);
      setError(err.message || 'Failed to load MPA data');
    }
  };

  const refreshEEZ = async () => {
    await loadEEZBoundaries(false); // Force refresh, skip cache
  };

  const refreshMPA = async () => {
    await loadMPAData(false); // Force refresh, skip cache
  };

  // Load data on mount
  useEffect(() => {
    const loadAllData = async () => {
      setLoading(true);
      setError(null);
      
      // Load both in parallel
      await Promise.all([
        loadEEZBoundaries(),
        loadMPAData()
      ]);
      
      setLoading(false);
    };

    loadAllData();
  }, []);

  return (
    <MapDataContext.Provider
      value={{
        eezBoundaries,
        mpaData,
        loading,
        error,
        refreshEEZ,
        refreshMPA,
      }}
    >
      {children}
    </MapDataContext.Provider>
  );
};

export const useMapData = () => {
  const context = useContext(MapDataContext);
  if (context === undefined) {
    throw new Error('useMapData must be used within a MapDataProvider');
  }
  return context;
};

