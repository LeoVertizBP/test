'use client';

import React, { useState } from 'react';

// Define interfaces for better type safety
interface FlagContent {
  type: string;
  url: string;
  transcript: string;
  ruleText: string;
  aiReasoning: string;
  aiVerdict: string; // Added AI verdict field
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
  assignee?: string; // Added assignee field
  content: FlagContent;
  humanVerdict?: HumanVerdict;
}

interface EnhancedFlagTableProps {
  flags: Flag[];
  selectedFlagId: number | null;
  onSelectFlag: (flagId: number) => void;
  onStatusChange: (flagId: number, newStatus: string) => void;
}

const EnhancedFlagTable: React.FC<EnhancedFlagTableProps> = ({ 
  flags, 
  selectedFlagId, 
  onSelectFlag, 
  onStatusChange 
}) => {
  // Sorting state
  const [sortField, setSortField] = useState<'publisher' | 'rule' | 'aiConfidence' | 'status'>('aiConfidence');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  
  // Filter state
  const [selectedAssignees, setSelectedAssignees] = useState<string[]>([]);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  
  // Sort the flags based on current sort settings
  const sortedFlags = [...flags].sort((a, b) => {
    if (sortField === 'aiConfidence') {
      return sortDirection === 'desc' 
        ? b.aiConfidence - a.aiConfidence 
        : a.aiConfidence - b.aiConfidence;
    } else if (sortField === 'publisher') {
      return sortDirection === 'desc'
        ? b.publisher.localeCompare(a.publisher)
        : a.publisher.localeCompare(b.publisher);
    } else if (sortField === 'rule') {
      return sortDirection === 'desc'
        ? b.rule.localeCompare(a.rule)
        : a.rule.localeCompare(b.rule);
    } else if (sortField === 'status') {
      return sortDirection === 'desc'
        ? b.status.localeCompare(a.status)
        : a.status.localeCompare(b.status);
    }
    return 0;
  });
  
  // Get unique assignees for filter
  const uniqueAssignees = React.useMemo(() => {
    return Array.from(new Set(flags
      .filter(f => f.assignee)
      .map(f => f.assignee as string)))
      .sort();
  }, [flags]);

  // Filter by assignee if any are selected
  const filteredFlags = selectedAssignees.length > 0
    ? sortedFlags.filter(flag => 
        flag.assignee && selectedAssignees.includes(flag.assignee)
      )
    : sortedFlags;
  
  // Handle sorting column click
  const handleSortClick = (field: 'publisher' | 'rule' | 'aiConfidence' | 'status') => {
    if (field === sortField) {
      // Toggle direction if clicking the same field
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // Set new field and default to descending
      setSortField(field);
      setSortDirection('desc');
    }
  };
  
  const getStatusBadgeClass = (status: string): string => {
    switch (status?.toLowerCase()) {
      case 'new':
        return 'bg-purple-400 bg-opacity-20 text-purple-500'; // Purple
      case 'in review':
        return 'bg-warning bg-opacity-20 text-warning'; // Yellow
      case 'pending remediation':
        return 'bg-error bg-opacity-20 text-error'; // Red
      case 'closed':
        return 'bg-text-secondary bg-opacity-20 text-text-secondary'; // Grey
      default:
        return 'bg-text-secondary bg-opacity-20 text-text-secondary';
    }
  };
  
  const getAIVerdictBadge = (verdict: string, confidence: number): React.ReactNode => {
    const isViolation = verdict.toLowerCase().includes('violation');
    
    return (
      <div className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
        isViolation 
          ? 'bg-error bg-opacity-20 text-error' 
          : 'bg-success bg-opacity-20 text-success'
      }`}>
        {isViolation ? 'Violation' : 'Compliant'} ({confidence}%)
      </div>
    );
  };

  const handleStatusChange = (flagId: number, e: React.ChangeEvent<HTMLSelectElement>) => {
    onStatusChange(flagId, e.target.value);
  };
  
  // Render sort indicator
  const renderSortIndicator = (field: 'publisher' | 'rule' | 'aiConfidence' | 'status') => {
    if (sortField !== field) return null;
    
    return (
      <span className="ml-1">
        {sortDirection === 'asc' ? '↑' : '↓'}
      </span>
    );
  };

  return (
    <div className="space-y-4">
      {/* Assignee Filter Dropdown */}
      <div className="p-3 bg-background rounded-card">
        <div className="relative">
          <label className="block text-sm font-medium mb-1 text-text-secondary">
            Filter by Assignee
          </label>
          <div 
            className="input w-full flex items-center justify-between cursor-pointer"
            onClick={() => setIsFilterOpen(!isFilterOpen)}
          >
            <span className={selectedAssignees.length ? 'text-text-primary' : 'text-text-secondary'}>
              {selectedAssignees.length 
                ? `${selectedAssignees.length} assignee${selectedAssignees.length > 1 ? 's' : ''} selected`
                : 'Select assignees...'}
            </span>
            <svg 
              className={`h-5 w-5 transition-transform ${isFilterOpen ? 'transform rotate-180' : ''}`} 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
          
          {isFilterOpen && (
            <div className="absolute z-20 mt-1 w-full bg-surface rounded-card shadow-lg border border-neutral-light">
              <div className="p-2">
                <input
                  type="text"
                  className="input w-full mb-2"
                  placeholder="Search assignees..."
                  onClick={(e) => e.stopPropagation()}
                  autoFocus
                />
              </div>
              <div className="max-h-60 overflow-y-auto">
                {uniqueAssignees.length > 0 ? (
                  uniqueAssignees.map(assignee => (
                    <div 
                      key={assignee} 
                      className="flex items-center p-2 hover:bg-background cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedAssignees(prev => {
                          if (prev.includes(assignee)) {
                            return prev.filter(a => a !== assignee);
                          } else {
                            return [...prev, assignee];
                          }
                        });
                      }}
                    >
                      <input 
                        type="checkbox" 
                        className="mr-2"
                        checked={selectedAssignees.includes(assignee)}
                        onChange={() => {}} // Handled by div click
                      />
                      <span>{assignee}</span>
                    </div>
                  ))
                ) : (
                  <div className="p-2 text-text-secondary text-center">No assignees found</div>
                )}
              </div>
              {uniqueAssignees.length > 0 && (
                <div className="p-2 border-t border-neutral-light flex justify-between">
                  <button 
                    className="text-sm text-secondary"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedAssignees([]);
                    }}
                  >
                    Clear all
                  </button>
                  <button 
                    className="text-sm text-secondary"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedAssignees(uniqueAssignees);
                    }}
                  >
                    Select all
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      
      {/* Flags Table */}
      <div className="overflow-y-auto max-h-[calc(100vh-350px)]"> 
        <table className="min-w-full divide-y divide-[#2A2C32]">
          <thead className="sticky top-0 bg-surface z-10">
            <tr>
              <th 
                className="table-header text-left px-3 py-2 cursor-pointer"
                onClick={() => handleSortClick('publisher')}
              >
                Flag{renderSortIndicator('publisher')}
              </th>
              <th 
                className="table-header text-left px-3 py-2 cursor-pointer"
                onClick={() => handleSortClick('rule')}
              >
                Rule{renderSortIndicator('rule')}
              </th>
              <th 
                className="table-header text-center px-3 py-2 cursor-pointer"
                onClick={() => handleSortClick('aiConfidence')}
              >
                AI Verdict{renderSortIndicator('aiConfidence')}
              </th>
              <th 
                className="table-header text-center px-3 py-2"
              >
                Human Verdict
              </th>
              <th 
                className="table-header text-center px-3 py-2 cursor-pointer"
                onClick={() => handleSortClick('status')}
              >
                Status{renderSortIndicator('status')}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#2A2C32]">
            {filteredFlags.map((flag, index) => (
              <tr 
                key={flag.id} 
                className={`${index % 2 === 0 ? 'table-row' : 'table-row-alt'} ${
                  selectedFlagId === flag.id ? 'bg-secondary bg-opacity-10' : ''
                } cursor-pointer hover:bg-opacity-70`}
                onClick={() => onSelectFlag(flag.id)}
              >
                {/* Publisher/Product Column */}
                <td className="px-3 py-3 text-left align-top">
                  <div className="flex flex-col">
                    <div className="font-medium text-text-primary text-sm">{flag.publisher}</div>
                    <div className="text-xs text-text-secondary">{flag.product}</div>
                    {flag.assignee && (
                      <div className="text-xs text-primary mt-1">Assigned: {flag.assignee}</div>
                    )}
                  </div>
                </td>
                {/* Rule/Date Column */}
                <td className="px-3 py-3 text-left align-top">
                  <div className="flex flex-col">
                    <div className="font-medium truncate max-w-[120px] text-text-primary text-sm">{flag.rule}</div>
                    <div className="text-xs text-text-secondary">{flag.date}</div>
                  </div>
                </td>
                {/* AI Verdict Column */}
                <td className="px-3 py-3 text-center align-top">
                  {flag.content.aiVerdict ? (
                    getAIVerdictBadge(flag.content.aiVerdict, flag.aiConfidence)
                  ) : (
                    <span className={`font-mono text-sm ${ 
                      flag.aiConfidence >= 90 
                        ? 'text-error' 
                        : flag.aiConfidence >= 70 
                          ? 'text-warning' 
                          : 'text-text-secondary'
                    }`}>
                      {flag.aiConfidence}%
                    </span>
                  )}
                </td>
                {/* Human Verdict Column */}
                <td className="px-3 py-3 text-center align-top">
                  {flag.humanVerdict ? (
                    <div className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                      flag.humanVerdict.isViolation === true 
                        ? 'bg-error bg-opacity-20 text-error' 
                        : 'bg-success bg-opacity-20 text-success'
                    }`}>
                      {flag.humanVerdict.isViolation === true ? 'Violation' : 'Compliant'}
                    </div>
                  ) : (
                    <span className="text-text-secondary text-xs">—</span>
                  )}
                </td>
                {/* Status Column */}
                <td className="px-3 py-3 text-center align-top">
                  <div onClick={(e) => e.stopPropagation()} className="flex justify-center"> 
                    <select
                      value={flag.status}
                      onChange={(e) => handleStatusChange(flag.id, e)}
                      className={`text-xs font-medium px-3 py-1 rounded-md text-center ${getStatusBadgeClass(flag.status)} border border-transparent focus:ring-1 focus:ring-secondary focus:outline-none appearance-none`}
                      style={{ textAlignLast: 'center' }}
                    >
                      <option value="New">New</option>
                      <option value="In Review">In Review</option>
                      <option value="Pending Remediation">Pending Remediation</option>
                      <option value="Closed">Closed</option>
                    </select>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        
        {filteredFlags.length === 0 && (
          <div className="text-center py-8 text-text-secondary">
            <p>No flags match your filters</p>
          </div>
        )}
      </div>
    </div>
  );
};

// For demo or development, export a component with mock data
export const EnhancedFlagTableDemo: React.FC<{
  selectedFlagId?: number | null;
  onSelectFlag?: (flagId: number) => void;
  externalFlags?: Flag[];
  onStatusChange?: (flagId: number, newStatus: string) => void;
}> = ({ 
  selectedFlagId = null, 
  onSelectFlag = () => {},
  externalFlags,
  onStatusChange
}) => {
  const [selectedId, setSelectedId] = useState<number | null>(selectedFlagId);
  
  const mockFlags: Flag[] = [
    { 
      id: 1, 
      scanJob: 'Q2 YouTube', 
      publisher: 'AcmeCo', 
      product: 'Premium Card', 
      rule: 'Fee Disclosure', 
      date: '2025-04-25', 
      aiConfidence: 92, 
      status: 'New',
      assignee: 'Sarah Chen',
      content: { 
        type: 'video', 
        url: 'https://example.com/video1', 
        transcript: 'This premium card has no annual fee for the first year, but there are some conditions that apply.', 
        ruleText: 'Fee disclosures must clearly state all conditions and duration of promotional fee waivers.',
        aiReasoning: 'The statement mentions a first-year fee waiver but does not clearly explain the conditions that apply or what happens after the first year.',
        aiVerdict: 'Violation'
      } 
    },
    { 
      id: 2, 
      scanJob: 'Q2 YouTube', 
      publisher: 'BetaInc', 
      product: 'Travel Card', 
      rule: 'APR Disclosure', 
      date: '2025-04-24', 
      aiConfidence: 65, 
      status: 'In Review',
      content: { 
        type: 'video', 
        url: 'https://example.com/video2', 
        transcript: 'This card has an annual percentage rate as low as 12.99%, but will depend on your credit score.', 
        ruleText: 'APR statements must disclose the full range of possible rates and qualifying factors prominently.',
        aiReasoning: 'The statement mentions a minimum APR but does not disclose the maximum possible rate in the range.',
        aiVerdict: 'Potential Violation'
      } 
    },
    { 
      id: 3, 
      scanJob: 'TikTok Apr 25', 
      publisher: 'GamesCo', 
      product: 'Rewards Card', 
      rule: 'Rewards Terms', 
      date: '2025-04-25', 
      aiConfidence: 91, 
      status: 'New',
      assignee: 'Michael Brown',
      content: { 
        type: 'video', 
        url: 'https://example.com/video3', 
        transcript: 'Earn unlimited 5% cash back on all purchases with our rewards card!', 
        ruleText: 'Rewards promotions must disclose any category limitations, caps, or expiration terms.',
        aiReasoning: 'The statement claims "unlimited 5% cash back on all purchases" without disclosing any category limitations or caps that may apply.',
        aiVerdict: 'Violation'
      } 
    },
    { 
      id: 4, 
      scanJob: 'Instagram Review', 
      publisher: 'TechFirm', 
      product: 'Basic Card', 
      rule: 'APR Disclosure', 
      date: '2025-04-22', 
      aiConfidence: 45, 
      status: 'Compliant',
      content: { 
        type: 'image', 
        url: 'https://example.com/image1', 
        transcript: 'Introductory 0% APR for 12 months, then variable APR 14.99% - 24.99% based on creditworthiness.', 
        ruleText: 'APR statements must disclose the full range of possible rates and qualifying factors prominently.',
        aiReasoning: 'The statement properly discloses both the promotional rate period and the full range of possible rates afterward.',
        aiVerdict: 'Compliant'
      } 
    }
  ];
  
  // Use external flags if provided, otherwise use mock flags
  const flags = externalFlags || mockFlags;
  
  const handleLocalStatusChange = (id: number, newStatus: string) => {
    if (onStatusChange) {
      onStatusChange(id, newStatus);
    } else {
      console.log(`Status changed for flag ${id} to ${newStatus}`);
    }
  };
  
  return (
      <EnhancedFlagTable 
        flags={flags}
        selectedFlagId={selectedFlagId ?? selectedId}
        onSelectFlag={flagId => {
          setSelectedId(flagId);
          onSelectFlag(flagId);
        }}
        onStatusChange={handleLocalStatusChange}
      />
  );
};

export default EnhancedFlagTable;
