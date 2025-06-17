'use client';

import React, { useState } from 'react';

// Define interfaces for better type safety
interface FlagContent {
  type: string;
  url: string;
  transcript: string;
  ruleText: string;
  aiReasoning: string;
  // Removed fields now accessed via relations
}

// Define related data structures based on Prisma schema and include clause
interface ContentItem {
  url: string | null;
  caption: string | null;
  title: string | null;
  transcript: any | null; // Keep as any for now, or define specific structure if needed
  publishers: Publisher | null;
  scan_jobs: ScanJob | null;
}

interface Publisher {
  name: string | null;
}

interface Product {
  name: string | null;
}

interface ScanJob {
  name: string | null;
}

interface User {
  name: string | null;
}


interface HumanVerdict {
  isViolation: boolean | null;
  severity: string;
  feedback: string;
  comments: string;
  timestamp: string;
}

// This interface should reflect the data structure *received* by this component,
// which is the TableFlag structure from ConnectedFlagReviewContent.tsx
interface Flag {
  id: string;
  content_item_id: string;
  rule_id: string;
  rule_name?: string; // Add rule_name to match incoming data
  rule_type: string;
  ai_confidence: number | null | undefined; // Align with TableFlag
  ai_ruling: string | null;
  ai_evaluation: string | null;
  ai_confidence_reasoning: string | null;
  status: string; // Assuming FlagStatus enum maps to string
  created_at: string; // ISO date string
  context_text: string | null;
  content_source: string | null;
  reviewer_id?: string | null;
  product_id?: string | null;
  humanVerdict?: HumanVerdict;

  // Included relations (as received from API initially, might be used by TableFlag)
  content_items: ContentItem | null | undefined; // Align with TableFlag
  products: Product | null | undefined; // Align with TableFlag
  users: User | null | undefined; // Align with TableFlag

  // Add direct properties populated by adaptApiToTableFlag in the parent component
  publisher?: string | null;
  scanJob?: string | null;
  product?: string | null;
}


interface EnhancedFlagTableProps {
  flags: Flag[]; // Use the updated Flag interface
  selectedFlagId: string | null; // ID is now string
  onSelectFlag: (flagId: string) => void;
  onStatusChange: (flagId: string, newStatus: string) => void;
}

const EnhancedFlagTable: React.FC<EnhancedFlagTableProps> = ({
  flags,
  selectedFlagId,
  onSelectFlag,
  onStatusChange
}) => {
  // Sorting state - update sortable fields (change rule_id to rule_name)
  const [sortField, setSortField] = useState<'publisher' | 'rule_name' | 'ai_confidence' | 'status'>('ai_confidence');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Filter state
  const [selectedAssignees, setSelectedAssignees] = useState<string[]>([]);
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  // Sort the flags based on current sort settings
  const sortedFlags = [...flags].sort((a, b) => {
    // Use the direct 'publisher' property from the processed TableFlag type
    const aPublisher = a.publisher ?? '';
    const bPublisher = b.publisher ?? '';
    // Use rule_name for sorting, fallback to rule_id
    const aRuleSortValue = a.rule_name ?? a.rule_id ?? '';
    const bRuleSortValue = b.rule_name ?? b.rule_id ?? '';
    const aConfidence = Number(a.ai_confidence ?? 0); // Ensure comparison is numeric
    const bConfidence = Number(b.ai_confidence ?? 0);
    const aStatus = a.status ?? '';
    const bStatus = b.status ?? '';

    if (sortField === 'ai_confidence') {
      return sortDirection === 'desc'
        ? bConfidence - aConfidence
        : aConfidence - bConfidence;
    } else if (sortField === 'publisher') {
      return sortDirection === 'desc'
        ? bPublisher.localeCompare(aPublisher)
        : aPublisher.localeCompare(bPublisher);
    } else if (sortField === 'rule_name') { // Sort by rule name (or ID fallback)
      return sortDirection === 'desc'
        ? bRuleSortValue.localeCompare(aRuleSortValue)
        : aRuleSortValue.localeCompare(bRuleSortValue);
    } else if (sortField === 'status') {
      return sortDirection === 'desc'
        ? bStatus.localeCompare(aStatus)
        : aStatus.localeCompare(bStatus);
    }
    return 0;
  });

  // Get unique assignees for filter - access nested user name
  const uniqueAssignees = React.useMemo(() => {
    return Array.from(new Set(flags
      .filter(f => f.users?.name) // Check if user and name exist
      .map(f => f.users!.name as string))) // Use non-null assertion after filter
      .sort();
  }, [flags]);

  // Filter by assignee if any are selected
  const filteredFlags = selectedAssignees.length > 0
    ? sortedFlags.filter(flag =>
        flag.users?.name && selectedAssignees.includes(flag.users.name)
      )
    : sortedFlags;

  // Handle sorting column click - update field types (change rule_id to rule_name)
  const handleSortClick = (field: 'publisher' | 'rule_name' | 'ai_confidence' | 'status') => {
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

  // Updated AI Verdict Badge to use ai_ruling
  const getAIVerdictBadge = (ai_ruling: string | null, confidence: number): React.ReactNode => {
    // Default to compliant if ruling is null or empty, adjust as needed
    const isViolation = ai_ruling?.toLowerCase() === 'violation';
    const rulingText = isViolation ? 'Violation' : 'Compliant'; // Handle null/compliant case

    return (
      <div className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
        isViolation
          ? 'bg-error bg-opacity-20 text-error'
          : 'bg-success bg-opacity-20 text-success'
      }`}>
        {rulingText} ({(confidence * 100).toFixed(0)}%) {/* Format confidence */}
      </div>
    );
  };


  const handleStatusChange = (flagId: string, e: React.ChangeEvent<HTMLSelectElement>) => {
    onStatusChange(flagId, e.target.value);
  };

  // Render sort indicator - update field types (change rule_id to rule_name)
  const renderSortIndicator = (field: 'publisher' | 'rule_name' | 'ai_confidence' | 'status') => {
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
                onClick={() => handleSortClick('rule_name')} // Use rule_name for click handler
              >
                Rule{renderSortIndicator('rule_name')} {/* Use rule_name for indicator */}
              </th>
              <th
                className="table-header text-center px-3 py-2 cursor-pointer"
                onClick={() => handleSortClick('ai_confidence')}
              >
                AI Verdict{renderSortIndicator('ai_confidence')}
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
                    {/* Use the direct 'publisher' property from the processed TableFlag type */}
                    <div className="font-medium text-text-primary text-sm">{flag.publisher ?? 'Unknown Publisher'}</div>
                    <div className="text-xs text-text-secondary">{flag.product ?? 'N/A'}</div>
                    {flag.users?.name && (
                      <div className="text-xs text-primary mt-1">Assigned: {flag.users.name}</div>
                    )}
                  </div>
                </td>
                {/* Rule/Date Column */}
                <td className="px-3 py-3 text-left align-top">
                  <div className="flex flex-col">
                    {/* Display Rule Name, fallback to ID. Use name for title/tooltip */}
                    <div className="text-xs text-text-primary truncate max-w-[150px]" title={flag.rule_name ?? flag.rule_id}>{flag.rule_name ?? flag.rule_id}</div>
                    {/* Format date */}
                    <div className="text-xs text-text-secondary mt-1">{new Date(flag.created_at).toLocaleDateString()}</div>
                  </div>
                </td>
                {/* AI Verdict Column - Use updated function */}
                <td className="px-3 py-3 text-center align-top">
                  {getAIVerdictBadge(flag.ai_ruling, Number(flag.ai_confidence ?? 0))}
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

export default EnhancedFlagTable;
