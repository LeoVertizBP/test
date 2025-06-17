import React from 'react';

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
  humanVerdict?: HumanVerdict; // Optional verdict
}

interface FlagTableProps {
  flags: Flag[];
  selectedFlagId: number | null;
  onSelectFlag: (flagId: number) => void;
  onStatusChange: (flagId: number, newStatus: string) => void;
}

const FlagTable: React.FC<FlagTableProps> = ({ flags, selectedFlagId, onSelectFlag, onStatusChange }) => {
  
  const getStatusBadgeClass = (status: string): string => {
    switch (status?.toLowerCase()) {
      case 'new':
        return 'bg-accent-coral bg-opacity-20 text-accent-coral';
      case 'in review':
        return 'bg-warning bg-opacity-20 text-warning';
      case 'confirmed':
        return 'bg-error bg-opacity-20 text-error';
      case 'compliant':
        return 'bg-success bg-opacity-20 text-success';
      default:
        return 'bg-text-secondary bg-opacity-20 text-text-secondary';
    }
  };

  const handleStatusChange = (flagId: number, e: React.ChangeEvent<HTMLSelectElement>) => {
    onStatusChange(flagId, e.target.value);
  };

  return (
    // Adjust height based on viewport minus other elements (approximate)
    <div className="overflow-y-auto max-h-[calc(100vh-300px)]"> 
      <table className="min-w-full divide-y divide-[#2A2C32]">
        <thead className="sticky top-0 bg-surface z-10">
          <tr>
            <th className="table-header text-left px-3 py-2">Flag</th>
            <th className="table-header text-left px-3 py-2">Rule</th>
            <th className="table-header text-center px-3 py-2">AI%</th>
            <th className="table-header text-right px-3 py-2">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#2A2C32]">
          {flags.map((flag, index) => (
            <tr 
              key={flag.id} 
              className={`${index % 2 === 0 ? 'table-row' : 'table-row-alt'} ${
                selectedFlagId === flag.id ? 'bg-accent-teal bg-opacity-10' : ''
              } cursor-pointer hover:bg-opacity-70`} // Added hover consistency
              onClick={() => onSelectFlag(flag.id)}
            >
              {/* Publisher/Product Column */}
              <td className="px-3 py-3 text-left align-top"> {/* Align top */}
                <div className="flex flex-col">
                  <span className="font-medium text-text-primary text-sm">{flag.publisher}</span>
                  <span className="text-xs text-text-secondary">{flag.product}</span>
                </div>
              </td>
              {/* Rule/Date Column */}
              <td className="px-3 py-3 text-left align-top"> {/* Align top */}
                <div className="flex flex-col">
                  <span className="font-medium truncate max-w-[120px] text-text-primary text-sm">{flag.rule}</span>
                  <span className="text-xs text-text-secondary">{flag.date}</span>
                </div>
              </td>
              {/* AI Confidence Column */}
              <td className="px-3 py-3 text-center align-top"> {/* Align top */}
                <span className={`font-mono text-sm ${ // Adjusted size
                  flag.aiConfidence >= 90 
                    ? 'text-error' 
                    : flag.aiConfidence >= 70 
                      ? 'text-warning' 
                      : 'text-text-secondary'
                }`}>
                  {flag.aiConfidence}%
                </span>
              </td>
              {/* Status Column */}
              <td className="px-3 py-3 text-right align-top"> {/* Align top */}
                <div onClick={(e) => e.stopPropagation()}> 
                  <select
                    value={flag.status}
                    onChange={(e) => handleStatusChange(flag.id, e)}
                    className={`text-xs font-medium px-2 py-1 rounded-full ${getStatusBadgeClass(flag.status)} bg-opacity-100 border border-transparent focus:ring-1 focus:ring-accent-teal focus:outline-none appearance-none bg-surface`} // Added bg-surface
                  >
                    <option value="New">New</option>
                    <option value="In Review">In Review</option>
                    <option value="Confirmed">Confirmed</option>
                    <option value="Compliant">Compliant</option>
                  </select>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      
      {flags.length === 0 && (
        <div className="text-center py-8 text-text-secondary">
          <p>No flags match your filters</p>
        </div>
      )}
    </div>
  );
};

export default FlagTable;
