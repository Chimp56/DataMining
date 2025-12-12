import React, { useMemo, useState, useEffect } from 'react';
import {
  TileLayer,
  CircleMarker,
  Polyline,
  Polygon,
  Tooltip,
  Popup,
} from 'react-leaflet';
import { GeoJSON } from 'react-leaflet';
import MapWrapper from '../components/MapWrapper';
import { apiService } from '../services/api';
import { useMapData } from '../contexts/MapDataContext';
import hotspotDataRaw from '../utils/HOTSPOT_FINAL_DATA.json';
// Leaflet icon fix is handled globally in src/index.tsx

const hotspotData = hotspotDataRaw as HotspotData;

type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

interface Vessel {
  id: string;
  name: string;
  mmsi: string;
  flag: string;
  type: string;
  tonnage: number;
  lastSeen: string;
  risk: RiskLevel;
  anomalyScore: number;
  avgSpeed: number;
  eezCrossings: number;
  timeDisabledHours: number;
  trajectory: Array<{ lat: number; lng: number; timestamp: string }>;
  predictedPoint: { lat: number; lng: number; eta: string };
}

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

interface HotspotData {
  metadata?: any;
  temporal_summary?: any[];
  fishing_cells?: Array<{ lat: number; lon: number; fishing_hours?: number }>;
  fishing_cluster_centers?: Array<{ cluster: number; lat: number; lon: number }>;
  fishing_cluster_summary?: any;
  fishing_heatmap_grid?: any;
  fishing_top2?: any;
  ais_events?: any[];
  ais_unique_points?: any[];
  ais_cluster_centers?: Array<{ cluster: number; lat: number; lon: number }>;
  ais_cluster_summary?: any;
}

// Helper function to determine risk level from anomaly score
const getRiskFromScore = (score: number): RiskLevel => {
  if (score >= 0.8) return 'critical';
  if (score >= 0.6) return 'high';
  if (score >= 0.4) return 'medium';
  return 'low';
};

const riskColor = (risk: RiskLevel) => {
  switch (risk) {
    case 'low':
      return '#10B981';
    case 'medium':
      return '#F59E0B';
    case 'high':
      return '#EF4444';
    case 'critical':
      return '#B91C1C';
    default:
      return '#6B7280';
  }
};

// Helper function to get hotspot color based on intensity (0-1)
// Gradient from green (low) -> yellow -> orange -> red (high)
const getHotspotColor = (intensity: number): string => {
  if (intensity <= 0.25) {
    // Green to yellow-green (low intensity)
    const ratio = intensity / 0.25;
    const r = Math.round(34 + (220 - 34) * ratio); // 34 (green) to 220 (yellow-green)
    const g = Math.round(197 + (220 - 197) * ratio); // 197 to 220
    const b = Math.round(34 + (20 - 34) * ratio); // 34 to 20
    return `rgb(${r}, ${g}, ${b})`;
  } else if (intensity <= 0.5) {
    // Yellow-green to yellow (medium-low)
    const ratio = (intensity - 0.25) / 0.25;
    const r = Math.round(220 + (255 - 220) * ratio); // 220 to 255
    const g = Math.round(220 + (255 - 220) * ratio); // 220 to 255
    const b = Math.round(20 - 20 * ratio); // 20 to 0
    return `rgb(${r}, ${g}, ${b})`;
  } else if (intensity <= 0.75) {
    // Yellow to orange (medium-high)
    const ratio = (intensity - 0.5) / 0.25;
    const r = 255; // Stay at max red
    const g = Math.round(255 - (140 - 100) * ratio); // 255 to ~215 (orange)
    const b = 0; // Stay at 0
    return `rgb(${r}, ${g}, ${b})`;
  } else {
    // Orange to red (high intensity)
    const ratio = (intensity - 0.75) / 0.25;
    const r = 255; // Stay at max red
    const g = Math.round(140 - 140 * ratio); // 140 to 0
    const b = 0; // Stay at 0
    return `rgb(${r}, ${g}, ${b})`;
  }
};

// Helper function to get hotspot opacity based on intensity
const getHotspotOpacity = (intensity: number): number => {
  // Opacity ranges from 0.3 (low) to 0.9 (high)
  return 0.3 + (intensity * 0.6);
};

// Helper function to get hotspot radius based on intensity
const getHotspotRadius = (intensity: number): number => {
  // Radius ranges from 8 (low) to 25 (high)
  return 8 + (intensity * 17);
};

const riskBadgeClass = (risk: RiskLevel) => {
  switch (risk) {
    case 'low':
      return 'text-green-700 bg-green-100';
    case 'medium':
      return 'text-yellow-700 bg-yellow-100';
    case 'high':
      return 'text-orange-700 bg-orange-100';
    case 'critical':
      return 'text-red-700 bg-red-100';
    default:
      return 'text-gray-700 bg-gray-100';
  }
};

const MainPage: React.FC = () => {
  const [activeLayers, setActiveLayers] = useState<Record<'eez' | 'mpa', boolean>>({
    eez: true,
    mpa: false,
  });
  const [vessels, setVessels] = useState<Vessel[]>([]);
  const [selectedVessel, setSelectedVessel] = useState<Vessel | null>(null);
  const [mmsiInput, setMmsiInput] = useState('');
  const [reportNotes, setReportNotes] = useState('');
  const [showAggregated, setShowAggregated] = useState(true);
  const [showTrails, setShowTrails] = useState(true);
  const [searchError, setSearchError] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hotspotCenters, setHotspotCenters] = useState<Array<{ lat: number; lng: number; intensity: number }>>([]);
  
  // Use map data from context (loaded on app startup)
  const { eezBoundaries: eezBoundariesData, mpaData, loading: mapDataLoading } = useMapData();

  // Load vessels and hotspots on mount
  useEffect(() => {
    loadVessels();
    loadHotspots();
  }, []);

  // Debug: Log MPA data when it changes
  useEffect(() => {
    if (mpaData.length > 0) {
      const withGeometry = mpaData.filter(m => m.geometry).length;
      console.log('MPA Data Status:', {
        total: mpaData.length,
        withGeometry,
        withoutGeometry: mpaData.length - withGeometry,
        activeLayer: activeLayers.mpa,
        sample: mpaData[0]
      });
    }
  }, [mpaData, activeLayers.mpa]);

  const loadVessels = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Fetch predictions which include vessel data with anomaly scores
      const response = await apiService.getPredictions({
        timeframe: 'all',
        limit: 50, // Top 50 vessels by risk
        offset: 0,
      });
      
      if (response.data && response.data.items) {
        // Map items to vessels
        const allVessels: Vessel[] = response.data.items.map((item: any) => {
          const anomalyScore = item.anomaly_score || 0;
          const risk = getRiskFromScore(anomalyScore);
          
          // Extract vessel features from nested object or flat fields
          const vesselFeatures = item.vessel_features || {};
          const flag = item.flag || vesselFeatures.flag_ais || vesselFeatures.flag_registry || vesselFeatures.flag_gfw || 'UNK';
          const vesselType = item.vessel_type || vesselFeatures.vessel_class_inferred || vesselFeatures.vessel_class_registry || vesselFeatures.vessel_class_gfw || 'Unknown';
          const tonnage = item.tonnage || vesselFeatures.tonnage_gt_inferred || vesselFeatures.tonnage_gt_registry || vesselFeatures.tonnage_gt_gfw || 0;
          const avgSpeed = item.avg_speed || vesselFeatures.mean_speed || 0;
          const eezCrossings = item.eez_crossings || vesselFeatures.eez_crossings || 0;
          const timeDisabledHours = item.time_disabled_hours || vesselFeatures.total_disable_hours || 0;
          
          return {
            id: item.id || `vessel_${item.mmsi}`,
            name: item.vesselName || `Vessel ${item.mmsi}`,
            mmsi: String(item.mmsi),
            flag: flag,
            type: vesselType,
            tonnage: tonnage,
            lastSeen: item.timestamp || item.last_seen || new Date().toISOString(),
            risk: risk,
            anomalyScore: anomalyScore,
            avgSpeed: avgSpeed,
            eezCrossings: eezCrossings,
            timeDisabledHours: timeDisabledHours,
            trajectory: item.trajectory || [],
            predictedPoint: item.predicted_point || { lat: 0, lng: 0, eta: '' },
          };
        });
        
        // Deduplicate by MMSI - keep the one with highest anomaly score
        const uniqueVesselsMap = new Map<string, Vessel>();
        for (const vessel of allVessels) {
          const existing = uniqueVesselsMap.get(vessel.mmsi);
          if (!existing || vessel.anomalyScore > existing.anomalyScore) {
            uniqueVesselsMap.set(vessel.mmsi, vessel);
          }
        }
        
        const vesselData = Array.from(uniqueVesselsMap.values());
        
        setVessels(vesselData);
        if (vesselData.length > 0 && !selectedVessel) {
          setSelectedVessel(vesselData[0]);
        }
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || 'Failed to load vessels');
      console.error('Error loading vessels:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadHotspots = async () => {
    try {
      // Use local hotspot data from JSON file
      const hotspots: Array<{ lat: number; lng: number; intensity: number }> = [];
      
      // Process fishing cluster centers
      if (hotspotData.fishing_cluster_centers && Array.isArray(hotspotData.fishing_cluster_centers)) {
        hotspotData.fishing_cluster_centers.forEach((cluster: any) => {
          if (cluster.lat != null && cluster.lon != null) {
            hotspots.push({
              lat: cluster.lat,
              lng: cluster.lon,
              intensity: 0.8, // High intensity for fishing clusters
            });
          }
        });
      }
      
      // Process AIS cluster centers (with slightly lower intensity)
      if (hotspotData.ais_cluster_centers && Array.isArray(hotspotData.ais_cluster_centers)) {
        hotspotData.ais_cluster_centers.forEach((cluster: any) => {
          if (cluster.lat != null && cluster.lon != null) {
            hotspots.push({
              lat: cluster.lat,
              lng: cluster.lon,
              intensity: 0.6, // Medium intensity for AIS clusters
            });
          }
        });
      }
      
      // Also use fishing cells for additional hotspots (top cells by fishing hours)
      if (hotspotData.fishing_cells && Array.isArray(hotspotData.fishing_cells)) {
        // Sort by fishing_hours and take top cells
        const topCells = [...hotspotData.fishing_cells]
          .sort((a: any, b: any) => (b.fishing_hours || 0) - (a.fishing_hours || 0))
          .slice(0, 50); // Top 50 fishing cells
        
        topCells.forEach((cell: any) => {
          if (cell.lat != null && cell.lon != null && cell.fishing_hours > 0) {
            // Normalize intensity based on fishing hours (max around 1000 hours)
            const intensity = Math.min(1.0, (cell.fishing_hours || 0) / 1000);
            hotspots.push({
              lat: cell.lat,
              lng: cell.lon,
              intensity: intensity * 0.5, // Lower intensity for individual cells
            });
          }
        });
      }
      
      console.log(`Loaded ${hotspots.length} hotspots from local data`);
      setHotspotCenters(hotspots);
    } catch (err: any) {
      console.error('Error loading hotspots:', err);
      // Don't set error state for hotspots, just log
    }
  };

  const vesselList = useMemo(
    () => [...vessels].sort((a, b) => b.anomalyScore - a.anomalyScore),
    [vessels]
  );

  // Fetch full vessel details when a vessel is selected
  const handleVesselSelect = async (vessel: Vessel) => {
    setSelectedVessel(vessel);
    
    // If vessel doesn't have complete data (no trajectory, missing features), fetch full details
    if (!vessel.trajectory || vessel.trajectory.length === 0 || vessel.tonnage === 0) {
      try {
        const response = await apiService.getVesselDetails(vessel.mmsi);
        if (response.data) {
          const item = response.data;
          const vesselFeatures = item.vessel_features || {};
          const flag = item.flag || vesselFeatures.flag_ais || vesselFeatures.flag_registry || vesselFeatures.flag_gfw || 'UNK';
          const vesselType = item.vessel_type || vesselFeatures.vessel_class_inferred || vesselFeatures.vessel_class_registry || vesselFeatures.vessel_class_gfw || 'Unknown';
          const tonnage = item.tonnage || vesselFeatures.tonnage_gt_inferred || vesselFeatures.tonnage_gt_registry || vesselFeatures.tonnage_gt_gfw || 0;
          const avgSpeed = item.avg_speed || vesselFeatures.mean_speed || 0;
          const eezCrossings = item.eez_crossings || vesselFeatures.eez_crossings || 0;
          const timeDisabledHours = item.time_disabled_hours || vesselFeatures.total_disable_hours || 0;
          
          const updatedVessel: Vessel = {
            ...vessel,
            name: item.vessel_name || vessel.name,
            flag: flag,
            type: vesselType,
            tonnage: tonnage,
            avgSpeed: avgSpeed,
            eezCrossings: eezCrossings,
            timeDisabledHours: timeDisabledHours,
            trajectory: item.trajectory || vessel.trajectory || [],
            lastSeen: item.last_seen || vessel.lastSeen,
          };
          
          // Update both selectedVessel and the vessel in the vessels array
          setSelectedVessel(updatedVessel);
          setVessels(prevVessels => 
            prevVessels.map(v => 
              v.mmsi === vessel.mmsi ? updatedVessel : v
            )
          );
          
          console.log('Vessel trajectory loaded:', {
            mmsi: vessel.mmsi,
            trajectoryLength: updatedVessel.trajectory?.length || 0,
            hasTrajectory: (updatedVessel.trajectory?.length || 0) > 0
          });
        }
      } catch (err: any) {
        console.error('Error loading full vessel details:', err);
        // Keep the selected vessel even if details fetch fails
      }
    }
  };

  const handleMmsiLookup = async () => {
    const mmsi = mmsiInput.trim();
    if (!mmsi) {
      setSearchError('Please enter an MMSI');
      return;
    }
    
    try {
      setSearchError('');
      const response = await apiService.getVesselDetails(mmsi);
      
      if (response.data) {
        const item = response.data;
        const anomalyScore = item.anomaly_score || 0;
        const risk = getRiskFromScore(anomalyScore);
        
        // Extract vessel features from nested object or flat fields
        const vesselFeatures = item.vessel_features || {};
        const flag = item.flag || vesselFeatures.flag_ais || vesselFeatures.flag_registry || vesselFeatures.flag_gfw || 'UNK';
        const vesselType = item.vessel_type || vesselFeatures.vessel_class_inferred || vesselFeatures.vessel_class_registry || vesselFeatures.vessel_class_gfw || 'Unknown';
        const tonnage = item.tonnage || vesselFeatures.tonnage_gt_inferred || vesselFeatures.tonnage_gt_registry || vesselFeatures.tonnage_gt_gfw || 0;
        const avgSpeed = item.avg_speed || vesselFeatures.mean_speed || 0;
        const eezCrossings = item.eez_crossings || vesselFeatures.eez_crossings || 0;
        const timeDisabledHours = item.time_disabled_hours || vesselFeatures.total_disable_hours || 0;
        
        const vessel: Vessel = {
          id: `vessel_${mmsi}`,
          name: item.vessel_name || `Vessel ${mmsi}`,
          mmsi: String(mmsi),
          flag: flag,
          type: vesselType,
          tonnage: tonnage,
          lastSeen: item.last_seen || new Date().toISOString(),
          risk: risk,
          anomalyScore: anomalyScore,
          avgSpeed: avgSpeed,
          eezCrossings: eezCrossings,
          timeDisabledHours: timeDisabledHours,
          trajectory: item.trajectory || [],
          predictedPoint: item.predicted_point || { lat: 0, lng: 0, eta: '' },
        };
        
        console.log('Vessel details loaded:', {
          mmsi,
          vessel_name: item.vessel_name,
          vessel_type: item.vessel_type,
          flag: item.flag,
          tonnage: item.tonnage,
          avg_speed: item.avg_speed,
          eez_crossings: item.eez_crossings,
          time_disabled_hours: item.time_disabled_hours,
          trajectory_length: item.trajectory?.length || 0,
          vessel_features: item.vessel_features ? 'present' : 'missing'
        });
        
        handleVesselSelect(vessel);
        // Add to vessels list if not already there
        if (!vessels.find(v => v.mmsi === mmsi)) {
          setVessels(prev => [...prev, vessel]);
        }
      }
    } catch (err: any) {
      setSearchError(err.response?.data?.detail || 'No vessel found with that MMSI');
      console.error('Error looking up vessel:', err);
    }
  };

  const toggleLayer = (id: 'eez' | 'mpa') => {
    setActiveLayers((prev) => ({ ...prev, [id]: !prev[id] }));
    // Data is already loaded by MapDataContext on app startup
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Main Page</h1>
        <p className="mt-1 text-sm text-gray-500">
          Explore vessel activity, toggle spatial overlays, and review vessel behavior summaries.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[320px,1fr]">
        {/* Sidebar */}
        <div className="space-y-4">
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-medium text-gray-900">Overlays</h3>
                <p className="text-sm text-gray-500">Spatial context layers</p>
              </div>
            </div>
            <div className="space-y-3">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 text-primary-600 rounded border-gray-300"
                  checked={activeLayers.eez}
                  onChange={() => toggleLayer('eez')}
                />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900">EEZ (200nm)</span>
                    <span
                      className="inline-block h-2 w-8 rounded-full"
                      style={{ backgroundColor: '#2563EB' }}
                    />
                  </div>
                  <p className="text-sm text-gray-600">Exclusive Economic Zones with jurisdiction boundaries.</p>
                  {mapDataLoading && (
                    <p className="text-xs text-blue-500 mt-1">Loading boundaries...</p>
                  )}
                  {!mapDataLoading && eezBoundariesData.length > 0 && (
                    <p className="text-xs text-gray-500 mt-1">{eezBoundariesData.length} boundaries loaded</p>
                  )}
                </div>
              </label>
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 text-primary-600 rounded border-gray-300"
                  checked={activeLayers.mpa}
                  onChange={() => toggleLayer('mpa')}
                />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900">Marine Protected Areas</span>
                    <span
                      className="inline-block h-2 w-8 rounded-full"
                      style={{ backgroundColor: '#16A34A' }}
                    />
                  </div>
                  <p className="text-sm text-gray-600">Restricted fishing zones and conservation areas.</p>
                  {mapDataLoading && (
                    <p className="text-xs text-blue-500 mt-1">Loading MPAs...</p>
                  )}
                  {!mapDataLoading && mpaData.length > 0 && (
                    <p className="text-xs text-gray-500 mt-1">
                      {mpaData.length} MPAs loaded
                      {mpaData.filter(m => m.geometry).length > 0 && (
                        <span className="text-green-600"> ({mpaData.filter(m => m.geometry).length} with geometry)</span>
                      )}
                    </p>
                  )}
                  {!mapDataLoading && mpaData.length > 0 && mpaData.every(m => !m.geometry) && (
                    <p className="text-xs text-yellow-600 mt-1">
                      No geometry data available. Check backend geopandas installation.
                    </p>
                  )}
                </div>
              </label>
              <label className="flex items-center gap-3 pt-1 border-t border-gray-200">
                <input
                  type="checkbox"
                  className="h-4 w-4 text-primary-600 rounded border-gray-300"
                  checked={showAggregated}
                  onChange={() => setShowAggregated((v) => !v)}
                />
                <div>
                  <p className="text-sm font-medium text-gray-900">Aggregated Vessel Overlay</p>
                  <p className="text-sm text-gray-600">Density and IUU risk hotspots.</p>
                </div>
              </label>
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  className="h-4 w-4 text-primary-600 rounded border-gray-300"
                  checked={showTrails}
                  onChange={() => setShowTrails((v) => !v)}
                />
                <div>
                  <p className="text-sm font-medium text-gray-900">Show Vessel Trajectories</p>
                  <p className="text-sm text-gray-600">Spatial temporal playback lines.</p>
                </div>
              </label>
            </div>
          </div>

          <div className="card space-y-3">
            <h3 className="text-lg font-medium text-gray-900">Enter Vessel Identifier</h3>
            <input
              className="input-field"
              placeholder="Enter MMSI..."
              value={mmsiInput}
              onChange={(e) => setMmsiInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleMmsiLookup()}
            />
            <button className="btn-primary w-full" onClick={handleMmsiLookup}>
              Locate Vessel
            </button>
            {searchError && <p className="text-sm text-red-600">{searchError}</p>}
          </div>

          <div className="card">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-medium text-gray-900">Vessels List</h3>
              <span className="text-xs text-gray-500">Ranked by anomaly</span>
            </div>
            <div className="space-y-2">
              {loading && (
                <div className="text-center py-4">
                  <p className="text-sm text-gray-500">Loading vessels...</p>
                </div>
              )}
              {!loading && vesselList.length === 0 && (
                <div className="text-center py-4">
                  <p className="text-sm text-gray-500">No vessels found</p>
                </div>
              )}
              {!loading && vesselList.map((vessel) => (
                <div
                  key={vessel.id}
                  className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
                    selectedVessel && vessel.id === selectedVessel.id
                      ? 'border-primary-200 bg-primary-50'
                      : 'border-gray-200 hover:bg-gray-50'
                  }`}
                  onClick={() => handleVesselSelect(vessel)}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-gray-900">{vessel.name}</p>
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-semibold ${riskBadgeClass(
                          vessel.risk
                        )}`}
                      >
                        {vessel.risk.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600">
                      MMSI {vessel.mmsi} • Score {(vessel.anomalyScore * 100).toFixed(0)}%
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500">Last seen</p>
                    <p className="text-sm text-gray-900">{vessel.lastSeen}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Map and detail column */}
        <div className="space-y-4">
          <div className="card p-0 relative">
            <MapWrapper
              center={[5, -40]}
              zoom={3}
              style={{ height: 520, width: '100%' }}
              scrollWheelZoom
            >
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              />

              {/* EEZ Boundaries Layer */}
              {activeLayers.eez && eezBoundariesData.length > 0 && eezBoundariesData.map((boundary, idx) => {
                if (boundary.geometry) {
                  const geoJsonFeature = {
                    type: "Feature" as const,
                    properties: {
                      line_id: boundary.line_id,
                      line_name: boundary.line_name,
                      line_type: boundary.line_type,
                      territory1: boundary.territory1,
                      sovereign1: boundary.sovereign1,
                      territory2: boundary.territory2,
                      sovereign2: boundary.sovereign2,
                      length_km: boundary.length_km,
                    },
                    geometry: boundary.geometry
                  };
                  
                  return (
                    <GeoJSON
                      key={`eez-boundary-${boundary.line_id || idx}`}
                      data={geoJsonFeature}
                      style={{
                        color: "#2563EB",
                        weight: 2,
                        opacity: 0.7
                      }}
                    />
                  );
                }
                return null;
              })}

              {/* MPA Layer */}
              {activeLayers.mpa && mpaData.length > 0 && (
                <>
                  {mpaData.map((mpa, idx) => {
                    if (mpa.geometry) {
                      const geoJsonFeature = {
                        type: "Feature" as const,
                        properties: {
                          wdpaid: mpa.wdpaid,
                          name: mpa.name,
                          orig_name: mpa.orig_name,
                          desig_eng: mpa.desig_eng,
                          iucn_cat: mpa.iucn_cat,
                          iso3: mpa.iso3,
                          gis_m_area: mpa.gis_m_area,
                          status: mpa.status,
                        },
                        geometry: mpa.geometry
                      };
                      
                      return (
                        <GeoJSON
                          key={`mpa-${mpa.wdpaid || idx}`}
                          data={geoJsonFeature}
                          style={{
                            color: "#16A34A",
                            weight: 2,
                            fillColor: "#16A34A",
                            fillOpacity: 0.2,
                            opacity: 0.8
                          }}
                        >
                          <Popup>
                            <div className="p-2">
                              <h3 className="font-semibold text-gray-900">Marine Protected Area</h3>
                              {mpa.name && (
                                <p className="text-sm text-gray-600">{mpa.name}</p>
                              )}
                              {mpa.desig_eng && (
                                <p className="text-sm text-gray-600">Designation: {mpa.desig_eng}</p>
                              )}
                              {mpa.iucn_cat && (
                                <p className="text-sm text-gray-600">IUCN Category: {mpa.iucn_cat}</p>
                              )}
                              {mpa.iso3 && (
                                <p className="text-sm text-gray-600">Country: {mpa.iso3}</p>
                              )}
                              {mpa.gis_m_area && (
                                <p className="text-sm text-gray-600">
                                  Area: {mpa.gis_m_area.toLocaleString()} km²
                                </p>
                              )}
                              {mpa.status && (
                                <p className="text-sm text-gray-600">Status: {mpa.status}</p>
                              )}
                            </div>
                          </Popup>
                        </GeoJSON>
                      );
                    }
                    return null;
                  })}
                  {/* Debug: Log MPA rendering info */}
                  {console.log('MPA Layer Render:', {
                    active: activeLayers.mpa,
                    totalMPAs: mpaData.length,
                    withGeometry: mpaData.filter(m => m.geometry).length,
                    withoutGeometry: mpaData.filter(m => !m.geometry).length
                  })}
                </>
              )}

              {showAggregated &&
                hotspotCenters.map((hotspot, idx) => {
                  const color = getHotspotColor(hotspot.intensity);
                  const opacity = getHotspotOpacity(hotspot.intensity);
                  const radius = getHotspotRadius(hotspot.intensity);
                  
                  return (
                    <CircleMarker
                      key={idx}
                      center={[hotspot.lat, hotspot.lng]}
                      radius={radius}
                      color={color}
                      fillColor={color}
                      fillOpacity={opacity}
                      weight={2}
                      opacity={Math.min(1.0, opacity + 0.2)}
                    >
                      <Tooltip direction="top" offset={[0, -4]} opacity={1} permanent={false}>
                        <div className="text-center">
                          <p className="font-semibold">Hotspot Density</p>
                          <p className="text-sm">{(hotspot.intensity * 100).toFixed(1)}%</p>
                          <p className="text-xs text-gray-500">
                            {hotspot.intensity >= 0.75 ? 'Very High' :
                             hotspot.intensity >= 0.5 ? 'High' :
                             hotspot.intensity >= 0.25 ? 'Medium' : 'Low'}
                          </p>
                        </div>
                      </Tooltip>
                    </CircleMarker>
                  );
                })}

              {vessels.map((vessel) => {
                const isSelected = selectedVessel && vessel.id === selectedVessel.id;
                // Use selected vessel's trajectory if available and this is the selected vessel
                const trajectoryToUse = (isSelected && selectedVessel?.trajectory && selectedVessel.trajectory.length > 0) 
                  ? selectedVessel.trajectory 
                  : vessel.trajectory;
                
                // Skip rendering if no trajectory and not selected (selected vessels should show even without trajectory)
                if ((!trajectoryToUse || trajectoryToUse.length === 0) && !isSelected) return null;
                
                // For selected vessels without trajectory, try to get position from trajectory or skip
                const lastPoint = trajectoryToUse && trajectoryToUse.length > 0 
                  ? trajectoryToUse[trajectoryToUse.length - 1]
                  : null;
                
                if (!lastPoint) return null;
                
                return (
                  <React.Fragment key={vessel.id}>
                    {showTrails && trajectoryToUse && trajectoryToUse.length > 0 && (() => {
                      // Split trajectory into segments to show movement progression
                      // Recent 20% = solid line, older 80% = progressively more dotted and lighter
                      const totalPoints = trajectoryToUse.length;
                      const recentThreshold = Math.max(1, Math.floor(totalPoints * 0.2)); // Last 20% is recent
                      const recentPoints = trajectoryToUse.slice(-recentThreshold);
                      const olderPoints = trajectoryToUse.slice(0, -recentThreshold);
                      
                      // Split older points into segments for progressive fading
                      const numOlderSegments = Math.min(3, Math.max(1, Math.floor(olderPoints.length / 10)));
                      const olderSegments: Array<Array<{ lat: number; lng: number; timestamp: string }>> = [];
                      
                      if (numOlderSegments > 0 && olderPoints.length > 0) {
                        const segmentSize = Math.floor(olderPoints.length / numOlderSegments);
                        for (let i = 0; i < numOlderSegments; i++) {
                          const start = i * segmentSize;
                          const end = i === numOlderSegments - 1 ? olderPoints.length : (i + 1) * segmentSize;
                          olderSegments.push(olderPoints.slice(start, end));
                        }
                      }
                      
                      const baseColor = isSelected ? '#7C3AED' : '#6B7280';
                      const baseWeight = isSelected ? 4 : 2;
                      
                      return (
                        <>
                          {/* Recent trajectory - solid line, full opacity */}
                          {recentPoints.length > 1 && (
                            <Polyline
                              positions={recentPoints.map((p) => [p.lat, p.lng])}
                              pathOptions={{
                                color: baseColor,
                                weight: baseWeight,
                                opacity: isSelected ? 0.9 : 0.7,
                                dashArray: undefined, // Solid line
                              }}
                            />
                          )}
                          
                          {/* Older trajectory segments - progressively more dotted and lighter */}
                          {olderSegments.map((segment, segmentIndex) => {
                            if (segment.length < 2) return null;
                            
                            // Calculate opacity: older segments are more transparent
                            const opacityMultiplier = 0.3 + (0.4 * (1 - segmentIndex / numOlderSegments));
                            const opacity = (isSelected ? 0.9 : 0.5) * opacityMultiplier;
                            
                            // Calculate dash pattern: older segments are more dotted
                            // Recent older segments: small dashes, oldest: very small dashes
                            const dashRatio = 0.3 + (0.7 * (segmentIndex / numOlderSegments));
                            const dashLength = Math.max(2, Math.floor(8 * dashRatio));
                            const gapLength = Math.max(4, Math.floor(12 * dashRatio));
                            
                            return (
                              <Polyline
                                key={`older-${segmentIndex}`}
                                positions={segment.map((p) => [p.lat, p.lng])}
                                pathOptions={{
                                  color: baseColor,
                                  weight: Math.max(1, baseWeight - 1),
                                  opacity: opacity,
                                  dashArray: `${dashLength},${gapLength}`,
                                }}
                              />
                            );
                          })}
                        </>
                      );
                    })()}
                    <CircleMarker
                      center={[lastPoint.lat, lastPoint.lng]}
                      radius={isSelected ? 12 : 10}
                      color={riskColor(vessel.risk)}
                      fillColor={riskColor(vessel.risk)}
                      fillOpacity={0.8}
                      eventHandlers={{ click: () => handleVesselSelect(vessel) }}
                    >
                      <Tooltip direction="right" offset={[10, 0]} opacity={1}>
                        <div className="space-y-1">
                          <p className="font-semibold">{vessel.name}</p>
                          <p className="text-sm">MMSI {vessel.mmsi}</p>
                          <p className="text-sm capitalize">Risk {vessel.risk}</p>
                          {trajectoryToUse && trajectoryToUse.length > 0 && (
                            <p className="text-xs text-gray-500">
                              {trajectoryToUse.length} points
                            </p>
                          )}
                        </div>
                      </Tooltip>
                    </CircleMarker>
                    {showTrails && vessel.predictedPoint && vessel.predictedPoint.eta && (
                      <CircleMarker
                        center={[vessel.predictedPoint.lat, vessel.predictedPoint.lng]}
                        radius={6}
                        color="#0EA5E9"
                        fillColor="#0EA5E9"
                        fillOpacity={0.8}
                      >
                        <Tooltip direction="top" offset={[0, -4]} opacity={1}>
                          Predicted ETA {vessel.predictedPoint.eta}
                        </Tooltip>
                      </CircleMarker>
                    )}
                  </React.Fragment>
                );
              })}
            </MapWrapper>

            <div className="absolute bottom-4 right-4">
              <div className="card shadow-lg">
                <h4 className="text-sm font-semibold text-gray-900 mb-2">Legend</h4>
                <div className="space-y-2 text-sm text-gray-700">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-green-500" />
                    <span>Low risk</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-yellow-500" />
                    <span>Medium risk</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-orange-500" />
                    <span>High risk</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-red-600" />
                    <span>Critical risk</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-0.5 bg-indigo-600" />
                    <span>Trajectory</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-sky-500" />
                    <span>Predicted next day</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-4 h-2 rounded bg-primary-200 border border-primary-600" />
                    <span>EEZ / MPA overlay</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="card md:col-span-2">
              {loading && (
                <div className="text-center py-8">
                  <p className="text-gray-500">Loading vessels...</p>
                </div>
              )}
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                  <p className="text-red-800">{error}</p>
                </div>
              )}
              {!loading && !selectedVessel && (
                <div className="text-center py-8">
                  <p className="text-gray-500">No vessel selected. Search for a vessel or select one from the list.</p>
                </div>
              )}
              {!loading && selectedVessel && (
                <>
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-medium text-gray-900">Vessel Detail and Summary</h3>
                  <p className="text-sm text-gray-500">
                    Metadata, behavioral summaries, and crossings for the selected vessel.
                  </p>
                </div>
                <span className={`px-3 py-1 rounded-full text-sm font-semibold ${riskBadgeClass(
                  selectedVessel.risk
                )}`}>
                  {selectedVessel.risk.toUpperCase()}
                </span>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <dl className="space-y-2">
                    <div>
                      <dt className="text-sm text-gray-500">Vessel</dt>
                      <dd className="text-sm text-gray-900 font-medium">
                        {selectedVessel.name} ({selectedVessel.type})
                      </dd>
                    </div>
                    <div>
                      <dt className="text-sm text-gray-500">MMSI</dt>
                      <dd className="text-sm text-gray-900">{selectedVessel.mmsi}</dd>
                    </div>
                    <div>
                      <dt className="text-sm text-gray-500">Flag</dt>
                      <dd className="text-sm text-gray-900">{selectedVessel.flag}</dd>
                    </div>
                    <div>
                      <dt className="text-sm text-gray-500">Tonnage</dt>
                      <dd className="text-sm text-gray-900">{selectedVessel.tonnage} GT</dd>
                    </div>
                  </dl>
                </div>
                <div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg border border-gray-200 p-3">
                      <p className="text-xs text-gray-500 uppercase">Anomaly Score</p>
                      <p className="text-lg font-semibold text-gray-900">
                        {(selectedVessel.anomalyScore * 100).toFixed(0)}%
                      </p>
                    </div>
                    <div className="rounded-lg border border-gray-200 p-3">
                      <p className="text-xs text-gray-500 uppercase">Avg Speed</p>
                      <p className="text-lg font-semibold text-gray-900">
                        {typeof selectedVessel.avgSpeed === 'number' ? selectedVessel.avgSpeed.toFixed(2) : selectedVessel.avgSpeed} kn
                      </p>
                    </div>
                    <div className="rounded-lg border border-gray-200 p-3">
                      <p className="text-xs text-gray-500 uppercase">EEZ Crossings</p>
                      <p className="text-lg font-semibold text-gray-900">
                        {selectedVessel.eezCrossings}
                      </p>
                    </div>
                    <div className="rounded-lg border border-gray-200 p-3">
                      <p className="text-xs text-gray-500 uppercase">Time Disabled</p>
                      <p className="text-lg font-semibold text-gray-900">
                        {typeof selectedVessel.timeDisabledHours === 'number' ? selectedVessel.timeDisabledHours.toFixed(2) : selectedVessel.timeDisabledHours} hrs
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-gray-200 p-3">
                  <p className="text-xs text-gray-500 uppercase mb-1">Trajectory Points</p>
                  <p className="text-sm text-gray-900">
                    {selectedVessel.trajectory?.length || 0} historical positions plotted with playback.
                  </p>
                </div>
                <div className="rounded-lg border border-gray-200 p-3">
                  <p className="text-xs text-gray-500 uppercase mb-1">Predicted Position</p>
                  {selectedVessel.predictedPoint && selectedVessel.predictedPoint.eta ? (
                    <p className="text-sm text-gray-900">
                      Next day ETA {selectedVessel.predictedPoint.eta} at{' '}
                      {selectedVessel.predictedPoint.lat?.toFixed(2) || 'N/A'},{' '}
                      {selectedVessel.predictedPoint.lng?.toFixed(2) || 'N/A'}.
                    </p>
                  ) : (
                    <p className="text-sm text-gray-500">No prediction available</p>
                  )}
                </div>
              </div>
                </>
              )}
            </div>

            <div className="card space-y-3">
              <h3 className="text-lg font-medium text-gray-900">Report as IUU Fishing</h3>
              <p className="text-sm text-gray-600">
                Manually report suspicious activity with supporting notes and timestamp.
              </p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Enter description
                </label>
                <textarea
                  className="input-field h-24"
                  placeholder="Describe observed behavior, evidence, or context..."
                  value={reportNotes}
                  onChange={(e) => setReportNotes(e.target.value)}
                />
              </div>
              <button
                className="btn-primary w-full"
                onClick={() => {
                  // Placeholder for API submission
                  setReportNotes('');
                }}
              >
                Submit IUU Report
              </button>
              <p className="text-xs text-gray-500">
                Report includes vessel ID, timestamp, overlay context, and user notes.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MainPage;

