'use client';

import React, { useState } from 'react';

// Define interfaces for better type safety
interface FlagContent {
  type: string;
  url: string;
  transcript: string;
  ruleText: string;
  aiReasoning: string;
}

interface HumanVerdict {
  isViolation: boolean | null;
  severity: string;
  feedback: string;
  comments: string;
  timestamp: string;
}

interface Flag {
  id: number;
  scanJob: string;
  publisher: string;
  product: string;
  rule: string;
  date: string;
  aiConfidence: number;
  status: string;
  content: FlagContent;
  humanVerdict?: HumanVerdict;
}

interface EnhancedFlagPreviewProps {
  flag: Flag;
  onVerdictSubmit: (verdict: {
    isViolation: boolean | null;
    severity: string;
    feedback: string;
    comments: string;
    timestamp: string;
  }) => void;
}

const EnhancedFlagPreview: React.FC<EnhancedFlagPreviewProps> = ({ flag, onVerdictSubmit }) => {
  // Local state for form inputs
  const [isViolation, setIsViolation] = useState<boolean | null>(
    flag.humanVerdict?.isViolation ?? null
  );
  const [severity, setSeverity] = useState(flag.humanVerdict?.severity || 'medium');
  const [feedback, setFeedback] = useState(flag.humanVerdict?.feedback || '');
  const [comments, setComments] = useState(flag.humanVerdict?.comments || '');

  // Function to handle verdict submission
  const handleSubmit = () => {
    if (isViolation === null) return; // Require a decision

    const verdict = {
      isViolation,
      severity,
      feedback,
      comments,
      timestamp: new Date().toISOString(),
    };

    onVerdictSubmit(verdict);
  };

  // Helper function to get confidence level style
  const getConfidenceStyle = (confidence: number) => {
    if (confidence >= 90) return { color: 'text-error', label: 'High' };
    if (confidence >= 70) return { color: 'text-warning', label: 'Medium' };
    return { color: 'text-text-secondary', label: 'Low' };
  };

  const confidenceStyle = getConfidenceStyle(flag.aiConfidence);

  return (
    <div className="h-full flex flex-col">
      <div className="mb-4 pb-4 border-b border-neutral-light">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-h2">{flag.publisher}</h2>
            <p className="text-text-secondary mb-1">{flag.product} | {flag.scanJob}</p>
          </div>
          <div className="text-right">
            <div className="mb-1">
              <span className="text-sm text-text-secondary mr-2">AI Confidence:</span>
              <span className={`text-h3 font-bold ${confidenceStyle.color}`}>
                {flag.aiConfidence}%
              </span>
            </div>
            <span className={`status-pill ${
              flag.status === 'New' ? 'bg-purple-400 bg-opacity-20 text-purple-500' : 
              flag.status === 'In Review' ? 'bg-warning bg-opacity-20 text-warning' : 
              flag.status === 'Pending Remediation' ? 'bg-error bg-opacity-20 text-error' : 
              flag.status === 'Closed' ? 'bg-text-secondary bg-opacity-20 text-text-secondary' : 
              'bg-text-secondary bg-opacity-20 text-text-secondary'
            }`}>
              {flag.status}
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-col space-y-6 mb-6">
        {/* Content Preview */}
        <div>
          <h3 className="text-h3 mb-3">Content</h3>
          
          {flag.content.type === 'video' && (
            <div className="bg-background rounded-card aspect-video flex items-center justify-center mb-4">
              <div className="text-text-secondary">
                <svg className="w-12 h-12 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-center">Video Preview</p>
              </div>
            </div>
          )}

          {flag.content.type === 'image' && (
            <div className="bg-background rounded-card aspect-video flex items-center justify-center mb-4">
              <div className="text-text-secondary">
                <svg className="w-12 h-12 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <p className="text-center">Image Preview</p>
              </div>
            </div>
          )}
        </div>

        {/* Transcript/Caption */}
        <div>
          <h4 className="text-sm font-semibold mb-2">Transcript/Caption:</h4>
          <div className="bg-background p-4 rounded-card max-h-48 overflow-y-auto">
            <p className="text-sm">{flag.content.transcript}</p>
          </div>
        </div>

        {/* Link to Content */}
        <div>
          <a 
            href={flag.content.url} 
            target="_blank" 
            rel="noopener noreferrer"
            className="inline-flex items-center text-secondary hover:underline"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            View Original Content{flag.content.type === 'video' ? ' (with Timestamp)' : ''}
          </a>
        </div>
      </div>

      {/* Decision Controls */}
      <div className="mt-auto pt-4 border-t border-neutral-light">
        <h3 className="text-h3 mb-3">AI Verdict</h3>
        
        {/* AI Suggestion Banner */}
        <div className={`mb-5 p-4 rounded-card ${
          flag.aiConfidence > 70 
            ? 'bg-error bg-opacity-10' 
            : 'bg-secondary bg-opacity-10'
        }`}>
          <div className="flex justify-between items-center">
            <div className="flex flex-col">
              <div className="text-lg font-bold mb-1">
                {flag.aiConfidence > 70 ? 'Likely Violation' : 'Review Needed'}
              </div>
              <div className="text-sm text-text-secondary">
                Based on {flag.aiConfidence}% confidence analysis
              </div>
            </div>
            <div className={`text-xl font-bold ${confidenceStyle.color}`}>
              {flag.aiConfidence}%
            </div>
          </div>
          
          {flag.humanVerdict && (
            <div className="mt-2 pt-2 border-t border-neutral-light">
              <div className={`text-sm font-medium ${
                flag.humanVerdict.isViolation === true
                  ? 'text-error'
                  : 'text-success'
              }`}>
                Previous Ruling: {flag.humanVerdict.isViolation === true ? 'Violation' : 'Compliant'}
              </div>
            </div>
          )}
        </div>
        
        {/* Rule Context */}
        <div className="mb-5">
          <h4 className="text-sm font-semibold mb-2">Rule Applied:</h4>
          <div className="bg-background p-4 rounded-card mb-4">
            <p className="text-sm font-medium mb-2">{flag.rule}</p>
            <p className="text-sm">{flag.content.ruleText}</p>
          </div>
        </div>
        
        {/* AI Analysis */}
        <div className="mb-5">
          <h4 className="text-sm font-semibold mb-2">AI Reasoning:</h4>
          <div className="bg-background p-4 rounded-card">
            <p className="text-sm">{flag.content.aiReasoning}</p>
          </div>
        </div>

        <h3 className="text-h3 mb-3">Your Verdict</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <div className="flex space-x-4 mb-4">
              <button
                className={`flex-1 py-2 px-4 rounded-btn border ${
                  isViolation === true
                    ? 'bg-error text-white border-error'
                    : 'border-error text-error bg-surface hover:bg-error hover:bg-opacity-10'
                }`}
                onClick={() => setIsViolation(true)}
              >
                Violation
              </button>
              <button
                className={`flex-1 py-2 px-4 rounded-btn border ${
                  isViolation === false
                    ? 'bg-success text-white border-success'
                    : 'border-success text-success bg-surface hover:bg-success hover:bg-opacity-10'
                }`}
                onClick={() => setIsViolation(false)}
              >
                Compliant
              </button>
            </div>
            
            {isViolation === true && (
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1 text-text-secondary">
                  Severity
                </label>
                <select
                  value={severity}
                  onChange={(e) => setSeverity(e.target.value)}
                  className="input w-full"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
            )}
          </div>
          
          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-1 text-text-secondary">
              Feedback on AI Ruling
            </label>
            <textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="Provide feedback on the AI's ruling..."
              className="input w-full mb-4"
            ></textarea>
            
            <label className="block text-sm font-medium mb-1 text-text-secondary">
              Comments
            </label>
            <textarea
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              placeholder="Add any additional comments here..."
              className="input w-full h-24"
            ></textarea>
          </div>
        </div>
        
        <div className="flex justify-end">
          <button
            className="btn-primary"
            onClick={handleSubmit}
            disabled={isViolation === null}
          >
            Submit Verdict
          </button>
        </div>
      </div>
    </div>
  );
};

export default EnhancedFlagPreview;
