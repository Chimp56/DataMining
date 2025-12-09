import React, { useState } from 'react';
import { MagnifyingGlassIcon, EyeIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { apiService } from '../services/api';

interface Vessel {
  mmsi: string;
  vessel_features?: {
    flag_ais?: string;
    flag_registry?: string;
    flag_gfw?: string;
    vessel_class_inferred?: string;
    vessel_class_registry?: string;
    vessel_class_gfw?: string;
    length_m_inferred?: number;
    length_m_registry?: number;
    length_m_gfw?: number;
    tonnage_gt_inferred?: number;
    tonnage_gt_registry?: number;
    tonnage_gt_gfw?: number;
    year?: number;
    is_known_iuu?: boolean;
    n_disabling_events?: number;
    total_fishing_hours?: number;
  };
  anomaly_score?: number;
  risk_level?: 'low' | 'medium' | 'high' | 'critical';
  daily_positions?: Array<{
    date: string;
    cell_ll_lat: number;
    cell_ll_lon: number;
    hours: number;
    fishing_hours: number;
  }>;
}

const VesselSearch: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [vessel, setVessel] = useState<Vessel | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async () => {
    const mmsi = searchTerm.trim();
    if (!mmsi) {
      setError('Please enter an MMSI number');
      return;
    }

    // Validate MMSI is numeric
    if (!/^\d+$/.test(mmsi)) {
      setError('MMSI must be a numeric value');
      return;
    }

    setLoading(true);
    setError(null);
    setVessel(null);

    try {
      const response = await apiService.getVesselDetails(mmsi);
      if (response.data) {
        setVessel(response.data);
      }
    } catch (err: any) {
      if (err.response?.status === 404) {
        setError('Vessel not found with MMSI: ' + mmsi);
      } else {
        setError(err.response?.data?.detail || 'Failed to fetch vessel data');
      }
      console.error('Error fetching vessel:', err);
    } finally {
      setLoading(false);
    }
  };

  const getRiskColor = (risk?: string) => {
    switch (risk) {
      case 'low': return 'text-green-600 bg-green-100';
      case 'medium': return 'text-yellow-600 bg-yellow-100';
      case 'high': return 'text-orange-600 bg-orange-100';
      case 'critical': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getVesselName = (v: Vessel) => {
    return `Vessel ${v.mmsi}`;
  };

  const getVesselFlag = (v: Vessel) => {
    return v.vessel_features?.flag_gfw || 
           v.vessel_features?.flag_registry || 
           v.vessel_features?.flag_ais || 
           'Unknown';
  };

  const getVesselType = (v: Vessel) => {
    return v.vessel_features?.vessel_class_gfw || 
           v.vessel_features?.vessel_class_registry || 
           v.vessel_features?.vessel_class_inferred || 
           'Unknown';
  };

  const getVesselLength = (v: Vessel) => {
    return v.vessel_features?.length_m_gfw || 
           v.vessel_features?.length_m_registry || 
           v.vessel_features?.length_m_inferred || 
           null;
  };

  const getVesselTonnage = (v: Vessel) => {
    return v.vessel_features?.tonnage_gt_gfw || 
           v.vessel_features?.tonnage_gt_registry || 
           v.vessel_features?.tonnage_gt_inferred || 
           null;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Vessel Search</h1>
        <p className="mt-1 text-sm text-gray-500">
          Search and analyze vessel information, risk assessments, and behavior patterns
        </p>
      </div>

      {/* Search Form */}
      <div className="card">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              MMSI Number
            </label>
            <div className="relative">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setError(null);
                }}
                placeholder="Enter MMSI number (e.g., 272364000)"
                className="input-field pl-10"
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              />
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            </div>
            {error && (
              <p className="mt-1 text-sm text-red-600">{error}</p>
            )}
          </div>
          
          <div className="flex items-end">
            <button
              onClick={handleSearch}
              disabled={loading || !searchTerm.trim()}
              className="btn-primary w-full sm:w-auto"
            >
              {loading ? 'Searching...' : 'Search'}
            </button>
          </div>
        </div>
      </div>

      {/* Vessel Details */}
      {vessel && (
        <div className="card">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-medium text-gray-900">Vessel Details</h3>
            <button
              onClick={() => {
                setVessel(null);
                setSearchTerm('');
                setError(null);
              }}
              className="text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-medium text-gray-900 mb-3">Basic Information</h4>
              <dl className="space-y-2">
                <div>
                  <dt className="text-sm font-medium text-gray-500">MMSI</dt>
                  <dd className="text-sm text-gray-900">{vessel.mmsi}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Flag State</dt>
                  <dd className="text-sm text-gray-900">{getVesselFlag(vessel)}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Vessel Type</dt>
                  <dd className="text-sm text-gray-900">{getVesselType(vessel)}</dd>
                </div>
                {vessel.vessel_features?.year && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Year</dt>
                    <dd className="text-sm text-gray-900">{vessel.vessel_features.year}</dd>
                  </div>
                )}
                {vessel.anomaly_score !== undefined && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Anomaly Score</dt>
                    <dd className="text-sm text-gray-900">{(vessel.anomaly_score * 100).toFixed(2)}%</dd>
                  </div>
                )}
              </dl>
            </div>
            
            <div>
              <h4 className="font-medium text-gray-900 mb-3">Technical Specifications</h4>
              <dl className="space-y-2">
                {getVesselLength(vessel) && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Length</dt>
                    <dd className="text-sm text-gray-900">{getVesselLength(vessel)?.toFixed(1)} meters</dd>
                  </div>
                )}
                {getVesselTonnage(vessel) && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Tonnage</dt>
                    <dd className="text-sm text-gray-900">{getVesselTonnage(vessel)?.toFixed(0)} GT</dd>
                  </div>
                )}
                {vessel.vessel_features?.total_fishing_hours !== undefined && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Total Fishing Hours</dt>
                    <dd className="text-sm text-gray-900">{vessel.vessel_features.total_fishing_hours.toFixed(1)}</dd>
                  </div>
                )}
                {vessel.vessel_features?.n_disabling_events !== undefined && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500">AIS Disabling Events</dt>
                    <dd className="text-sm text-gray-900">{vessel.vessel_features.n_disabling_events}</dd>
                  </div>
                )}
                {vessel.vessel_features?.is_known_iuu !== undefined && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Known IUU Vessel</dt>
                    <dd className="text-sm text-gray-900">
                      <span className={vessel.vessel_features.is_known_iuu ? 'text-red-600 font-semibold' : 'text-green-600'}>
                        {vessel.vessel_features.is_known_iuu ? 'Yes' : 'No'}
                      </span>
                    </dd>
                  </div>
                )}
              </dl>
            </div>
          </div>
          
          <div className="mt-6 pt-6 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium text-gray-900">Risk Assessment</h4>
                <p className="text-sm text-gray-500">Anomaly score and risk level</p>
              </div>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${getRiskColor(vessel.risk_level)}`}>
                {vessel.risk_level ? vessel.risk_level.toUpperCase() : 'UNKNOWN'} RISK
              </span>
            </div>
            {vessel.anomaly_score !== undefined && (
              <div className="mt-4">
                <p className="text-sm text-gray-600">
                  Anomaly Score: <span className="font-semibold">{(vessel.anomaly_score * 100).toFixed(2)}%</span>
                </p>
              </div>
            )}
          </div>

          {vessel.daily_positions && vessel.daily_positions.length > 0 && (
            <div className="mt-6 pt-6 border-t border-gray-200">
              <h4 className="font-medium text-gray-900 mb-3">Recent Positions</h4>
              <div className="max-h-64 overflow-y-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Latitude</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Longitude</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Hours</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Fishing Hours</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {vessel.daily_positions.slice(0, 20).map((pos, idx) => (
                      <tr key={idx}>
                        <td className="px-4 py-2 text-sm text-gray-900">{pos.date}</td>
                        <td className="px-4 py-2 text-sm text-gray-900">{pos.cell_ll_lat.toFixed(2)}</td>
                        <td className="px-4 py-2 text-sm text-gray-900">{pos.cell_ll_lon.toFixed(2)}</td>
                        <td className="px-4 py-2 text-sm text-gray-900">{pos.hours.toFixed(2)}</td>
                        <td className="px-4 py-2 text-sm text-gray-900">{pos.fishing_hours.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* No Results - Show when search was attempted but no vessel found */}
      {!vessel && !loading && searchTerm && !error && (
        <div className="card text-center py-12">
          <MagnifyingGlassIcon className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No vessel found</h3>
          <p className="mt-1 text-sm text-gray-500">
            Enter an MMSI number to search for vessel information.
          </p>
        </div>
      )}

      {/* Initial State */}
      {!vessel && !loading && !searchTerm && (
        <div className="card text-center py-12">
          <MagnifyingGlassIcon className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">Search for a Vessel</h3>
          <p className="mt-1 text-sm text-gray-500">
            Enter an MMSI number above to view vessel details, risk assessment, and position history.
          </p>
        </div>
      )}
    </div>
  );
};

export default VesselSearch;
