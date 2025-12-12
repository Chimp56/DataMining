import React, { useState, useEffect } from 'react';
import { 
  ShieldExclamationIcon, 
  ClockIcon, 
  ChartBarIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ArrowPathIcon,
  ChevronLeftIcon,
  ChevronRightIcon
} from '@heroicons/react/24/outline';
import { apiService } from '../services/api';

interface PredictionResult {
  id: string;
  vesselName?: string;
  mmsi: string;
  riskScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
  factors: string[];
  predictedBehavior: string;
  timestamp: string;
  status: 'pending' | 'confirmed' | 'false_positive';
  anomaly_score?: number;
}

const Predictions: React.FC = () => {
  const [selectedTimeframe, setSelectedTimeframe] = useState<'24h' | '7d' | '30d' | 'all'>('all');
  const [selectedRisk, setSelectedRisk] = useState<string>('all');
  const [predictions, setPredictions] = useState<PredictionResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [training, setTraining] = useState(false);
  const [trainingMessage, setTrainingMessage] = useState<string | null>(null);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  useEffect(() => {
    setCurrentPage(1); // Reset to first page when filters change
    loadPredictions();
  }, [selectedTimeframe, selectedRisk]);

  useEffect(() => {
    loadPredictions();
  }, [currentPage, pageSize]);

  const loadPredictions = async () => {
    try {
      setLoading(true);
      setError(null);
      const offset = (currentPage - 1) * pageSize;
      const response = await apiService.getPredictions({
        timeframe: selectedTimeframe,
        riskLevel: selectedRisk === 'all' ? undefined : selectedRisk,
        limit: pageSize,
        offset: offset,
      });
      
      if (response.data && response.data.items) {
        const items = response.data.items.map((item: any) => ({
          id: item.id || `pred_${item.mmsi}`,
          vesselName: item.vesselName || `Vessel ${item.mmsi}`,
          mmsi: String(item.mmsi),
          riskScore: item.riskScore || Math.round((item.anomaly_score || 0) * 100),
          riskLevel: item.risk_level || 'low',
          confidence: item.confidence || 85,
          factors: item.factors || [],
          predictedBehavior: item.predictedBehavior || 'Anomalous behavior detected',
          timestamp: item.timestamp || new Date().toISOString(),
          status: item.status || 'pending',
          anomaly_score: item.anomaly_score,
        }));
        setPredictions(items);
        setTotal(response.data.total || items.length);
        setTotalPages(Math.ceil((response.data.total || items.length) / pageSize));
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || 'Failed to load predictions');
      console.error('Error loading predictions:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleTrainModel = async () => {
    try {
      setTraining(true);
      setTrainingMessage(null);
      setError(null);
      
      const response = await apiService.trainModel(true);
      
      if (response.data && response.data.status === 'success') {
        setTrainingMessage(
          `Model trained successfully! Scores saved to ${response.data.data?.files?.csv_path || 'latest_scores.csv'}. ` +
          `Training completed at ${new Date(response.data.data?.files?.timestamp || Date.now()).toLocaleString()}.`
        );
        // Reload predictions after training
        setTimeout(() => {
          loadPredictions();
        }, 1000);
      } else {
        setError(response.data?.message || 'Failed to train model');
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || 'Failed to train model');
      console.error('Error training model:', err);
    } finally {
      setTraining(false);
    }
  };

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'low': return 'text-green-600 bg-green-100';
      case 'medium': return 'text-yellow-600 bg-yellow-100';
      case 'high': return 'text-orange-600 bg-orange-100';
      case 'critical': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'confirmed':
        return <CheckCircleIcon className="h-5 w-5 text-green-500" />;
      case 'false_positive':
        return <CheckCircleIcon className="h-5 w-5 text-gray-500" />;
      default:
        return <ClockIcon className="h-5 w-5 text-yellow-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed':
        return 'text-green-600 bg-green-100';
      case 'false_positive':
        return 'text-gray-600 bg-gray-100';
      default:
        return 'text-yellow-600 bg-yellow-100';
    }
  };

  // Calculate stats from current page predictions
  const highRiskCount = predictions.filter(p => p.riskLevel === 'high' || p.riskLevel === 'critical').length;
  const confirmedCount = predictions.filter(p => p.status === 'confirmed').length;
  const avgConfidence = predictions.length > 0 
    ? Math.round(predictions.reduce((acc, p) => acc + p.confidence, 0) / predictions.length)
    : 0;

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handlePageSizeChange = (newPageSize: number) => {
    setPageSize(newPageSize);
    setCurrentPage(1); // Reset to first page when page size changes
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">IUU Predictions</h1>
        <p className="mt-1 text-sm text-gray-500">
          AI-powered predictions of illegal, unreported, and unregulated fishing activities
        </p>
      </div>

      {/* Controls */}
      <div className="card">
        <div className="flex flex-wrap gap-4 items-center">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Timeframe
            </label>
            <select
              value={selectedTimeframe}
              onChange={(e) => setSelectedTimeframe(e.target.value as any)}
              className="input-field w-auto"
            >
              <option value="all">All Time</option>
              <option value="24h">Last 24 Hours</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Risk Level
            </label>
            <select
              value={selectedRisk}
              onChange={(e) => setSelectedRisk(e.target.value)}
              className="input-field w-auto"
            >
              <option value="all">All Risk Levels</option>
              <option value="low">Low Risk</option>
              <option value="medium">Medium Risk</option>
              <option value="high">High Risk</option>
              <option value="critical">Critical Risk</option>
            </select>
          </div>

          <div className="flex gap-2 items-end">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Items per Page
              </label>
              <select
                value={pageSize}
                onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                className="input-field w-auto"
                disabled={loading}
              >
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={200}>200</option>
              </select>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={loadPredictions}
                className="btn-primary"
                disabled={loading || training}
              >
                {loading ? 'Loading...' : 'Refresh'}
              </button>
              <button 
                onClick={handleTrainModel}
                className="btn-primary flex items-center gap-2"
                disabled={training || loading}
              >
                <ArrowPathIcon className={`h-4 w-4 ${training ? 'animate-spin' : ''}`} />
                {training ? 'Training...' : 'Train Model'}
              </button>
              <button className="btn-secondary">Export Predictions</button>
            </div>
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <ShieldExclamationIcon className="h-8 w-8 text-red-400" />
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-gray-500 truncate">
                  Total Predictions
                </dt>
                <dd className="text-2xl font-semibold text-gray-900">
                  {total.toLocaleString()}
                </dd>
              </dl>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <ExclamationTriangleIcon className="h-8 w-8 text-orange-400" />
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-gray-500 truncate">
                  High Risk Predictions
                </dt>
                <dd className="text-2xl font-semibold text-gray-900">
                  {highRiskCount}
                </dd>
              </dl>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <CheckCircleIcon className="h-8 w-8 text-green-400" />
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-gray-500 truncate">
                  Confirmed Predictions
                </dt>
                <dd className="text-2xl font-semibold text-gray-900">
                  {confirmedCount}
                </dd>
              </dl>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <ChartBarIcon className="h-8 w-8 text-blue-400" />
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-gray-500 truncate">
                  Average Confidence
                </dt>
                <dd className="text-2xl font-semibold text-gray-900">
                  {avgConfidence}%
                </dd>
              </dl>
            </div>
          </div>
        </div>
      </div>

      {/* Training Success Message */}
      {trainingMessage && (
        <div className="card bg-green-50 border-green-200">
          <p className="text-green-800">{trainingMessage}</p>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="card bg-red-50 border-red-200">
          <p className="text-red-800">Error: {error}</p>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="card">
          <p className="text-gray-600">Loading predictions...</p>
        </div>
      )}

      {/* Predictions List */}
      {!loading && !error && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900">
              Prediction Results ({total.toLocaleString()} total, showing {predictions.length} on this page)
            </h3>
          </div>
          {predictions.length === 0 ? (
            <p className="text-gray-500">No predictions found for the selected filters.</p>
          ) : (
            <>
              <div className="space-y-4 mb-6">
                {predictions.map((prediction) => (
            <div
              key={prediction.id}
              className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h4 className="font-medium text-gray-900">{prediction.vesselName}</h4>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getRiskColor(prediction.riskLevel)}`}>
                      {prediction.riskLevel.toUpperCase()}
                    </span>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(prediction.status)}`}>
                      {prediction.status.replace('_', ' ').toUpperCase()}
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                    <div>
                      <p className="text-sm text-gray-600">
                        <span className="font-medium">MMSI:</span> {prediction.mmsi}
                      </p>
                      <p className="text-sm text-gray-600">
                        <span className="font-medium">Risk Score:</span> {prediction.riskScore}/100
                      </p>
                      <p className="text-sm text-gray-600">
                        <span className="font-medium">Confidence:</span> {prediction.confidence}%
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">
                        <span className="font-medium">Predicted Behavior:</span> {prediction.predictedBehavior}
                      </p>
                      <p className="text-sm text-gray-600">
                        <span className="font-medium">Timestamp:</span> {prediction.timestamp}
                      </p>
                    </div>
                  </div>

                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-1">Risk Factors:</p>
                    <div className="flex flex-wrap gap-2">
                      {prediction.factors.map((factor, index) => (
                        <span
                          key={index}
                          className="px-2 py-1 bg-red-100 text-red-800 text-xs rounded-full"
                        >
                          {factor}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 ml-4">
                  {getStatusIcon(prediction.status)}
                  <button className="btn-primary text-sm">View Details</button>
                </div>
              </div>
            </div>
                ))}
              </div>
              
              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between border-t border-gray-200 pt-4 mt-6">
                  <div className="flex items-center gap-2">
                    <p className="text-sm text-gray-700">
                      Showing <span className="font-medium">{(currentPage - 1) * pageSize + 1}</span> to{' '}
                      <span className="font-medium">{Math.min(currentPage * pageSize, total)}</span> of{' '}
                      <span className="font-medium">{total.toLocaleString()}</span> results
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage === 1 || loading}
                      className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                    >
                      <ChevronLeftIcon className="h-4 w-4" />
                      Previous
                    </button>
                    
                    {/* Page Numbers */}
                    <div className="flex items-center gap-1">
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let pageNum;
                        if (totalPages <= 5) {
                          pageNum = i + 1;
                        } else if (currentPage <= 3) {
                          pageNum = i + 1;
                        } else if (currentPage >= totalPages - 2) {
                          pageNum = totalPages - 4 + i;
                        } else {
                          pageNum = currentPage - 2 + i;
                        }
                        
                        return (
                          <button
                            key={pageNum}
                            onClick={() => handlePageChange(pageNum)}
                            disabled={loading}
                            className={`px-3 py-2 text-sm font-medium rounded-md ${
                              currentPage === pageNum
                                ? 'bg-blue-600 text-white'
                                : 'text-gray-700 bg-white border border-gray-300 hover:bg-gray-50'
                            } disabled:opacity-50 disabled:cursor-not-allowed`}
                          >
                            {pageNum}
                          </button>
                        );
                      })}
                    </div>
                    
                    <button
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage === totalPages || loading}
                      className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                    >
                      Next
                      <ChevronRightIcon className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

    </div>
  );
};

export default Predictions;
