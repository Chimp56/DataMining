import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

const RiskDistributionChart: React.FC = () => {
  const data = [
    { name: 'Low Risk', value: 45, color: '#10B981' },
    { name: 'Medium Risk', value: 35, color: '#F59E0B' },
    { name: 'High Risk', value: 15, color: '#EF4444' },
    { name: 'Critical Risk', value: 5, color: '#DC2626' },
  ];

  return (
    <div className="card">
      <h3 className="text-lg font-medium text-gray-900 mb-4">Risk Distribution</h3>
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              outerRadius={80}
              fill="#8884d8"
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default RiskDistributionChart;
