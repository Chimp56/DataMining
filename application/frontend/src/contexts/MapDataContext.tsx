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

      // Load from API with timeout and progressive loading
      console.log('Loading MPA data from API...');
      let response;
      const initialLimit = 100; // Start small for faster response
      try {
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('MPA API call timed out after 60 seconds')), 60000)
        );
        
        // First, load a small batch quickly
        response = await Promise.race([
          apiService.getMPAForMap({ limit: initialLimit, simplify_tolerance: 0.01 }),
          timeoutPromise
        ]) as any;
        
        console.log('MPA API Response received:', response);
        console.log('MPA API Response.data:', response?.data);
        console.log('MPA API Response.data.items:', response?.data?.items);
        console.log('MPA API Response.data.items type:', typeof response?.data?.items);
        console.log('MPA API Response.data.items isArray:', Array.isArray(response?.data?.items));
      } catch (apiErr: any) {
        console.error('MPA API call failed:', apiErr);
        console.error('MPA API error details:', {
          message: apiErr?.message,
          response: apiErr?.response,
          status: apiErr?.response?.status,
          data: apiErr?.response?.data
        });
        throw apiErr; // Re-throw to be caught by outer catch
      }
      
      if (response && response.data) {
        // Check if items exists and is an array
        const items = response.data.items;
        if (items && Array.isArray(items)) {
          console.log(`MPA items received: ${items.length}`, items.length > 0 ? items.slice(0, 2) : 'empty array');
          if (items.length > 0) {
            setMpaData(items);
            saveMPAToCache(items);
            console.log(`✓ Loaded ${items.length} MPAs from API (initial batch)`);
            
            // Load full dataset in background if we got a partial result
            if (items.length === initialLimit) {
              console.log('Loading full MPA dataset in background...');
              apiService.getMPAForMap({ limit: 1000, simplify_tolerance: 0.001 })
                .then((fullResponse) => {
                  if (fullResponse?.data?.items && Array.isArray(fullResponse.data.items) && fullResponse.data.items.length > items.length) {
                    setMpaData(fullResponse.data.items);
                    saveMPAToCache(fullResponse.data.items);
                    console.log(`✓ Loaded full MPA dataset: ${fullResponse.data.items.length} MPAs`);
                  }
                })
                .catch((err) => {
                  console.warn('Background MPA load failed:', err);
                  // Keep the initial batch
                });
            }
          } else {
            console.warn('MPA API returned empty items array');
            setMpaData([]);
          }
        } else if (items === undefined || items === null) {
          console.warn('MPA API response missing items array. Response structure:', {
            hasData: !!response.data,
            dataKeys: response.data ? Object.keys(response.data) : [],
            dataValues: response.data,
            fullResponse: response
          });
          setMpaData([]);
        } else {
          console.warn('MPA API response items is not an array:', {
            type: typeof items,
            value: items,
            constructor: items?.constructor?.name
          });
          setMpaData([]);
        }
      } else {
        console.warn('MPA API response missing data property. Full response:', response);
        setMpaData([]);
      }
    } catch (err: any) {
      console.error('Error loading MPA data:', err);
      console.error('Error details:', {
        message: err.message,
        response: err.response,
        stack: err.stack
      });
      setError(err.message || 'Failed to load MPA data');
      setMpaData([]); // Set empty array on error
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
      
      console.log('MapDataContext: Starting to load map data...');
      
      // Load both in parallel, but handle errors separately
      try {
        await Promise.allSettled([
          loadEEZBoundaries(),
          loadMPAData()
        ]);
        console.log('MapDataContext: Finished loading map data');
      } catch (err) {
        console.error('MapDataContext: Error loading map data:', err);
      } finally {
        setLoading(false);
      }
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

