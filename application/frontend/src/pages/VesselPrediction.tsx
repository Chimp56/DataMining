import React, { useState, useEffect } from 'react';
import { MapIcon, MagnifyingGlassIcon, ExclamationTriangleIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import { TileLayer, Polyline, CircleMarker, Circle, Popup } from 'react-leaflet';
import MapWrapper from '../components/MapWrapper';
import { apiService } from '../services/api';

interface ObservedPoint {
  date: string;
  lat: number;
  lon: number;
  total_hours: number;
  total_fishing: number;
}

interface Prediction {
  day: number;
  date: string;
  lat: number;
  lon: number;
  radius: number;
}

interface PredictionData {
  status: string;
  mmsi: string;
  observed: ObservedPoint[];
  predictions: Prediction[];
  model_metrics: {
    mean_error_km: number;
    ci95_lower_km: number;
    ci95_upper_km: number;
    ci95_radius_meters: number;
    training_samples: number;
    observed_points: number;
  };
  last_known_position: {
    date: string;
    lat: number;
    lon: number;
  };
}

const VesselPrediction: React.FC = () => {
  const [mmsi, setMmsi] = useState('');
  const [daysAhead, setDaysAhead] = useState(5);
  const [startYear, setStartYear] = useState(2017);
  const [endYear, setEndYear] = useState(2019);
  const [data, setData] = useState<PredictionData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPrediction = async () => {
    const mmsiValue = mmsi.trim();
    if (!mmsiValue) {
      setError('Please enter an MMSI number');
      return;
    }

    if (!/^\d+$/.test(mmsiValue)) {
      setError('MMSI must be numeric');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const response = await apiService.predictVesselLocation(mmsiValue, {
        days_ahead: daysAhead,
        start_year: startYear,
        end_year: endYear,
      });

      if (response.data && response.data.status === 'success') {
        setData(response.data);
      } else {
        setError(response.data?.error || 'Failed to load prediction');
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || 'Failed to load prediction');
      console.error('Error loading prediction:', err);
    } finally {
      setLoading(false);
    }
  };

  // Calculate map bounds
  const getMapBounds = () => {
    if (!data || data.observed.length === 0) {
      return { center: [20, 0] as [number, number], zoom: 2 };
    }

    const allPoints = [
      ...data.observed.map(p => [p.lat, p.lon]),
      ...data.predictions.map(p => [p.lat, p.lon]),
    ];

    const lats = allPoints.map(p => p[0]);
    const lons = allPoints.map(p => p[1]);

    const center: [number, number] = [
      (Math.max(...lats) + Math.min(...lats)) / 2,
      (Math.max(...lons) + Math.min(...lons)) / 2,
    ];

    return { center, zoom: 4 };
  };

  const bounds = getMapBounds();

  // Prepare polyline data for observed trajectory
  const observedPath = data?.observed.map(p => [p.lat, p.lon] as [number, number]) || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Vessel Location Prediction</h1>
        <MapIcon className="h-8 w-8 text-blue-600" />
      </div>

      {/* Search Form */}
      <div className="card">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              MMSI
            </label>
            <input
              type="text"
              value={mmsi}
              onChange={(e) => setMmsi(e.target.value)}
              placeholder="Enter MMSI"
              className="input"
              onKeyPress={(e) => e.key === 'Enter' && loadPrediction()}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Days Ahead
            </label>
            <input
              type="number"
              value={daysAhead}
              onChange={(e) => setDaysAhead(parseInt(e.target.value) || 5)}
              min={1}
              max={30}
              className="input"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Start Year
            </label>
            <input
              type="number"
              value={startYear}
              onChange={(e) => setStartYear(parseInt(e.target.value) || 2017)}
              min={2010}
              max={2025}
              className="input"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              End Year
            </label>
            <input
              type="number"
              value={endYear}
              onChange={(e) => setEndYear(parseInt(e.target.value) || 2019)}
              min={2010}
              max={2025}
              className="input"
            />
          </div>
        </div>
        <div className="mt-4">
          <button
            onClick={loadPrediction}
            disabled={loading}
            className="btn-primary"
          >
            {loading ? (
              <>
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Predicting...
              </>
            ) : (
              <>
                <MagnifyingGlassIcon className="h-5 w-5 mr-2" />
                Predict Location
              </>
            )}
          </button>
        </div>
      </div>

      {error && (
        <div className="card bg-red-50 border-red-200">
          <div className="flex items-center">
            <ExclamationTriangleIcon className="h-5 w-5 text-red-600 mr-2" />
            <p className="text-red-800">{error}</p>
          </div>
        </div>
      )}

      {data && data.status === 'success' && (
        <>
          {/* Model Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="card">
              <h3 className="text-sm font-medium text-gray-500 mb-1">Mean Error</h3>
              <p className="text-2xl font-bold text-gray-900">
                {data.model_metrics.mean_error_km.toFixed(2)} km
              </p>
            </div>
            <div className="card">
              <h3 className="text-sm font-medium text-gray-500 mb-1">95% CI Radius</h3>
              <p className="text-2xl font-bold text-gray-900">
                {(data.model_metrics.ci95_radius_meters / 1000).toFixed(2)} km
              </p>
            </div>
            <div className="card">
              <h3 className="text-sm font-medium text-gray-500 mb-1">Training Samples</h3>
              <p className="text-2xl font-bold text-gray-900">
                {data.model_metrics.training_samples}
              </p>
            </div>
          </div>

          {/* Map */}
          <div className="card p-0 overflow-hidden">
            <div className="h-[600px] w-full">
              <MapWrapper center={bounds.center} zoom={bounds.zoom}>
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                />

                {/* Observed trajectory */}
                {observedPath.length > 1 && (
                  <Polyline
                    positions={observedPath}
                    color="blue"
                    weight={3}
                    opacity={0.7}
                  />
                )}

                {/* Observed points */}
                {data.observed.map((point, idx) => (
                  <CircleMarker
                    key={`obs-${idx}`}
                    center={[point.lat, point.lon]}
                    radius={4}
                    color="blue"
                    fillColor="blue"
                    fillOpacity={0.6}
                  >
                    <Popup>
                      <div>
                        <strong>Observed</strong>
                        <br />
                        Date: {point.date}
                        <br />
                        Lat: {point.lat.toFixed(4)}, Lon: {point.lon.toFixed(4)}
                        <br />
                        Hours: {point.total_hours.toFixed(1)}
                      </div>
                    </Popup>
                  </CircleMarker>
                ))}

                {/* Predicted points with confidence intervals */}
                {data.predictions.map((pred, idx) => (
                  <React.Fragment key={`pred-${idx}`}>
                    <Circle
                      center={[pred.lat, pred.lon]}
                      radius={pred.radius}
                      color="green"
                      fillColor="green"
                      fillOpacity={0.15}
                      weight={1}
                    />
                    <CircleMarker
                      center={[pred.lat, pred.lon]}
                      radius={6}
                      color="red"
                      fillColor="red"
                      fillOpacity={0.8}
                    >
                      <Popup>
                        <div>
                          <strong>Predicted Day {pred.day}</strong>
                          <br />
                          Date: {pred.date}
                          <br />
                          Lat: {pred.lat.toFixed(4)}, Lon: {pred.lon.toFixed(4)}
                          <br />
                          CI95 Radius: {(pred.radius / 1000).toFixed(2)} km
                        </div>
                      </Popup>
                    </CircleMarker>
                  </React.Fragment>
                ))}

                {/* Last known position */}
                {data.last_known_position && (
                  <CircleMarker
                    center={[data.last_known_position.lat, data.last_known_position.lon]}
                    radius={8}
                    color="purple"
                    fillColor="purple"
                    fillOpacity={0.8}
                    weight={3}
                  >
                    <Popup>
                      <div>
                        <strong>Last Known Position</strong>
                        <br />
                        Date: {data.last_known_position.date}
                        <br />
                        Lat: {data.last_known_position.lat.toFixed(4)}, Lon: {data.last_known_position.lon.toFixed(4)}
                      </div>
                    </Popup>
                  </CircleMarker>
                )}
              </MapWrapper>
            </div>
          </div>

          {/* Prediction Summary */}
          <div className="card">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Prediction Summary</h2>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600">MMSI:</span>
                <span className="font-medium">{data.mmsi}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Last Known Position:</span>
                <span className="font-medium">
                  {data.last_known_position.date} at ({data.last_known_position.lat.toFixed(4)}, {data.last_known_position.lon.toFixed(4)})
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Observed Points:</span>
                <span className="font-medium">{data.observed.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Predicted Days:</span>
                <span className="font-medium">{data.predictions.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">95% Confidence Interval:</span>
                <span className="font-medium">
                  {(data.model_metrics.ci95_lower_km).toFixed(2)} - {(data.model_metrics.ci95_upper_km).toFixed(2)} km
                </span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default VesselPrediction;

