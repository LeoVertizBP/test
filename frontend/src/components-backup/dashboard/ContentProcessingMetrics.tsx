'use client';

import React from 'react';

interface ProcessingMetric {
  platform: string;
  contentType: string;
  averageTimeSeconds: number;
  color: string;
}

interface ContentProcessingMetricsProps {
  metrics: ProcessingMetric[];
}

const ContentProcessingMetrics: React.FC<ContentProcessingMetricsProps> = ({ metrics }) => {
  // Find the maximum time for scaling the chart
  const maxTime = Math.max(...metrics.map(m => m.averageTimeSeconds));
  
  return (
    <div className="card card-hover">
      <h2>Content Processing Metrics</h2>
      <p className="text-text-secondary mb-6">Average processing time by content type</p>
      
      <div className="space-y-4">
        {metrics.map((metric, index) => (
          <div key={index} className="space-y-1">
            <div className="flex justify-between items-center">
              <div className="text-sm font-medium">{metric.platform} {metric.contentType}</div>
              <div className="text-sm text-text-secondary">{metric.averageTimeSeconds.toFixed(1)}s</div>
            </div>
            <div className="w-full bg-background rounded-full h-2">
              <div 
                className={`h-2 rounded-full ${metric.color}`} 
                style={{ width: `${(metric.averageTimeSeconds / maxTime) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
      
      <div className="mt-6 flex justify-end">
        <button className="text-sm text-secondary hover:underline">
          View Full Processing Report
        </button>
      </div>
    </div>
  );
};

// For demo or development, export a component with mock data
export const ContentProcessingMetricsDemo: React.FC = () => {
  const mockMetrics: ProcessingMetric[] = [
    { platform: 'Instagram', contentType: 'Image', averageTimeSeconds: 1.2, color: 'bg-secondary' },
    { platform: 'Instagram', contentType: 'Carousel', averageTimeSeconds: 3.5, color: 'bg-secondary opacity-80' },
    { platform: 'Instagram', contentType: 'Video', averageTimeSeconds: 12.8, color: 'bg-secondary opacity-60' },
    { platform: 'TikTok', contentType: 'Video', averageTimeSeconds: 18.5, color: 'bg-primary' },
    { platform: 'YouTube', contentType: 'Video', averageTimeSeconds: 45.2, color: 'bg-error' },
  ];
  
  return <ContentProcessingMetrics metrics={mockMetrics} />;
};

export default ContentProcessingMetrics;
