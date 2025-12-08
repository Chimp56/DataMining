import React, { useState } from 'react';
import { 
  ShieldExclamationIcon, 
  ClockIcon, 
  ChartBarIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline';

interface PredictionResult {
  id: string;
  vesselName: string;
  mmsi: string;
  riskScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
  factors: string[];
  predictedBehavior: string;
  timestamp: string;
  status: 'pending' | 'confirmed' | 'false_positive';
}

const Predictions: React.FC = () => {
  const [selectedTimeframe, setSelectedTimeframe] = useState<'24h' | '7d' | '30d'>('24h');
  const [selectedRisk, setSelectedRisk] = useState<string>('all');

  // Mock prediction data
  const predictions: PredictionResult[] = [
    {
      id: '1',
      vesselName: 'Ocean Explorer',
      mmsi: '123456789',
      riskScore: 87,
      riskLevel: 'high',
      confidence: 92,
      factors: ['Frequent AIS disabling', 'Identity switching detected', 'Operating in protected area'],
      predictedBehavior: 'Likely to disable AIS near marine protected area',
      timestamp: '2024-01-15 14:30:00',
      status: 'pending'
    },
    {
      id: '2',
      vesselName: 'Sea Hunter',
      mmsi: '987654321',
      riskScore: 95,
      riskLevel: 'critical',
      confidence: 98,
      factors: ['Multiple identity changes', 'IUU vessel list match', 'Suspicious trajectory pattern'],
      predictedBehavior: 'High probability of IUU fishing activity',
      timestamp: '2024-01-15 12:15:00',
      status: 'confirmed'
    },
    {
      id: '3',
      vesselName: 'Deep Blue',
      mmsi: '456789123',
      riskScore: 65,
      riskLevel: 'medium',
      confidence: 78,
      factors: ['Irregular fishing patterns', 'Extended AIS gaps'],
      predictedBehavior: 'Possible transshipment activity',
      timestamp: '2024-01-15 16:45:00',
      status: 'pending'
    },
    {
      id: '4',
      vesselName: 'Atlantic Star',
      mmsi: '789123456',
      riskScore: 45,
      riskLevel: 'low',
      confidence: 85,
      factors: ['Normal fishing patterns'],
      predictedBehavior: 'Standard fishing operations',
      timestamp: '2024-01-15 10:20:00',
      status: 'false_positive'
    }
  ];

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

  const filteredPredictions = selectedRisk === 'all' 
    ? predictions 
    : predictions.filter(p => p.riskLevel === selectedRisk);

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

          <div className="flex gap-2">
            <button className="btn-primary">Run New Analysis</button>
            <button className="btn-secondary">Export Predictions</button>
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
                  {filteredPredictions.length}
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
                  {filteredPredictions.filter(p => p.riskLevel === 'high' || p.riskLevel === 'critical').length}
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
                  {filteredPredictions.filter(p => p.status === 'confirmed').length}
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
                  {Math.round(filteredPredictions.reduce((acc, p) => acc + p.confidence, 0) / filteredPredictions.length)}%
                </dd>
              </dl>
            </div>
          </div>
        </div>
      </div>

      {/* Predictions List */}
      <div className="card">
        <h3 className="text-lg font-medium text-gray-900 mb-4">
          Prediction Results ({filteredPredictions.length} predictions)
        </h3>
        <div className="space-y-4">
          {filteredPredictions.map((prediction) => (
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
      </div>

      {/* Model Performance */}
      <div className="card">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Model Performance</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center">
            <div className="text-3xl font-bold text-green-600">94.2%</div>
            <div className="text-sm text-gray-500">Overall Accuracy</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-blue-600">89.7%</div>
            <div className="text-sm text-gray-500">Precision</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-purple-600">91.3%</div>
            <div className="text-sm text-gray-500">Recall</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Predictions;
