'use client';

import React, { useState } from 'react';

interface ConfidenceBucket {
  range: string;
  count: number;
  color: string;
}

interface AIConfidenceAnalysisProps {
  confidenceBuckets: ConfidenceBucket[];
  totalFlags: number;
}

const AIConfidenceAnalysis: React.FC<AIConfidenceAnalysisProps> = ({
  confidenceBuckets,
  totalFlags
}) => {
  const [threshold, setThreshold] = useState<number>(70);
  
  // Calculate the impact of the current threshold setting
  const calculateImpact = () => {
    const flagsAboveThreshold = confidenceBuckets
      .filter(bucket => {
        const [min] = bucket.range.split('-').map(n => parseInt(n, 10));
        return min >= threshold;
      })
      .reduce((sum, bucket) => sum + bucket.count, 0);
    
    const percentAboveThreshold = (flagsAboveThreshold / totalFlags) * 100;
    
    return {
      flagsAboveThreshold,
      percentAboveThreshold: Math.round(percentAboveThreshold)
    };
  };
  
  const impact = calculateImpact();

  // Find the maximum count for scaling
  const maxCount = Math.max(...confidenceBuckets.map(bucket => bucket.count));
  
  return (
    <div className="card card-hover">
      <h2>AI Confidence Distribution</h2>
      <p className="text-text-secondary mb-6">Distribution of flags by AI confidence level</p>
      
      <div className="mb-6">
        <div className="flex justify-between mb-2">
          <span className="text-sm font-medium">AI Confidence Threshold</span>
          <span className="text-sm font-bold">{threshold}%</span>
        </div>
        <input
          type="range"
          min="0"
          max="100"
          step="5"
          value={threshold}
          onChange={(e) => setThreshold(parseInt(e.target.value, 10))}
          className="w-full h-2 bg-background rounded-full appearance-none cursor-pointer"
        />
      </div>
      
      <div className="flex h-48 items-end space-x-1 mb-4">
        {confidenceBuckets.map((bucket, index) => {
          const [min] = bucket.range.split('-').map(n => parseInt(n, 10));
          const isAboveThreshold = min >= threshold;
          const heightPercentage = (bucket.count / maxCount) * 100;
          
          return (
            <div 
              key={index} 
              className="flex-1 flex flex-col items-center"
              title={`${bucket.range}%: ${bucket.count} flags`}
            >
              <div 
                className={`w-full ${isAboveThreshold ? bucket.color : 'bg-neutral-gray bg-opacity-30'} rounded-t`}
                style={{ height: `${heightPercentage}%` }}
              ></div>
              <div className="text-xs mt-1 text-text-secondary">{bucket.range}</div>
            </div>
          );
        })}
      </div>
      
      <div className="p-4 bg-background rounded-card">
        <h3 className="text-h3 mb-2">Threshold Impact Analysis</h3>
        <p className="text-sm mb-1">
          With a threshold of <span className="font-semibold">{threshold}%</span>, approximately:
        </p>
        <ul className="space-y-1 text-sm">
          <li className="flex items-center">
            <svg className="h-4 w-4 text-secondary mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <span><strong>{impact.flagsAboveThreshold}</strong> flags ({impact.percentAboveThreshold}%) would bypass initial human review</span>
          </li>
          <li className="flex items-center">
            <svg className="h-4 w-4 text-success mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Estimated <strong>{Math.round(impact.percentAboveThreshold * 0.75)}%</strong> reduction in manual review time</span>
          </li>
        </ul>
      </div>
    </div>
  );
};

// For demo or development, export a component with mock data
export const AIConfidenceAnalysisDemo: React.FC = () => {
  const mockBuckets: ConfidenceBucket[] = [
    { range: '0-20', count: 5, color: 'bg-neutral-gray' },
    { range: '20-40', count: 12, color: 'bg-neutral-gray' },
    { range: '40-60', count: 28, color: 'bg-warning' },
    { range: '60-80', count: 47, color: 'bg-secondary' },
    { range: '80-100', count: 98, color: 'bg-primary' },
  ];
  
  return <AIConfidenceAnalysis confidenceBuckets={mockBuckets} totalFlags={190} />;
};

export default AIConfidenceAnalysis;
