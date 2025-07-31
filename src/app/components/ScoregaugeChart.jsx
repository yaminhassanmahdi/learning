// ScoreGaugeChart.js (or define within WritingSupplements.js)
import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

// Colors for the gauge - good part and remaining part
const GAUGE_COLORS = ['#10B981', '#E5E7EB']; // Green for score, Gray for remaining (Tailwind Emerald-500, Gray-200)
const DARK_GAUGE_COLORS = ['#10B981', '#4B5563']; // Green for score, Dark Gray for remaining (Tailwind Emerald-500, Gray-600)

const ScoreGaugeChart = ({ name, score }) => {
  // Ensure score is within 0-10 range
  const validScore = Math.max(0, Math.min(10, score || 0));
  const data = [
    { name: name, value: validScore },
    { name: 'Remaining', value: 10 - validScore },
  ];

  // Check dark mode dynamically
  const isDarkMode = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
  const colors = isDarkMode ? DARK_GAUGE_COLORS : GAUGE_COLORS;

  return (
    <div className="flex flex-col items-center text-center">
      <ResponsiveContainer width="100%" height={120}> {/* Adjust height as needed */}
        <PieChart>
          {/* Custom tooltip */}
          <Tooltip
            formatter={(value, name) => [`${value.toFixed(1)} / 10`, name]}
            contentStyle={isDarkMode ? { backgroundColor: '#374151', border: 'none', borderRadius: '4px'} : { backgroundColor: '#ffffff', border: '1px solid #ccc', borderRadius: '4px'}}
            itemStyle={isDarkMode ? { color: '#D1D5DB' } : {}} // Adjust text color if needed
          />
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={35} // Make it a donut chart
            outerRadius={50}
            fill="#8884d8"
            paddingAngle={0} // No padding between segments
            dataKey="value"
            startAngle={180} // Start from the bottom
            endAngle={-180} // Go around to the top
            stroke="none" // No border between slices
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
            ))}
             {/* Optional: Add Label in center - might need custom label component */}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      {/* Use score prop directly for the label */}
      <p className="text-sm font-medium dark:text-zinc-300 text-zinc-700 mt-1">
        {name}: <span className="font-bold">{validScore.toFixed(1)}/10</span>
      </p>
    </div>
  );
};

export default ScoreGaugeChart; // Export if in separate file