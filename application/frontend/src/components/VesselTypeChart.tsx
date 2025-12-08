import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const VesselTypeChart: React.FC = () => {
  const data = [
    { name: 'Trawlers', count: 450, risk: 12 },
    { name: 'Longliners', count: 320, risk: 18 },
    { name: 'Purse Seines', count: 280, risk: 8 },
    { name: 'Gillnetters', count: 190, risk: 15 },
    { name: 'Pole & Line', count: 150, risk: 5 },
    { name: 'Other', count: 120, risk: 22 },
  ];

  return (
    <div className="card">
      <h3 className="text-lg font-medium text-gray-900 mb-4">Vessel Types & Risk Levels</h3>
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
            <YAxis yAxisId="left" orientation="left" />
            <YAxis yAxisId="right" orientation="right" />
            <Tooltip />
            <Bar yAxisId="left" dataKey="count" fill="#3B82F6" name="Vessel Count" />
            <Bar yAxisId="right" dataKey="risk" fill="#EF4444" name="Risk Score" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default VesselTypeChart;
