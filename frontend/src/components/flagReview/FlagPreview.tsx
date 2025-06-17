import React, { useState, useEffect } from 'react';
import axios from 'axios'; // Import axios for API calls

// --- Define more accurate types based on backend structure ---
// (Consider moving these to a shared types file: src/types/index.ts)
interface FlagContentItem {
    url: string;
    caption?: string | null;
    title?: string | null;
    transcript?: any | null; // Prisma returns Json?
    platform?: string | null; // Added based on repository update
    publishers?: { name: string } | null;
    scan_jobs?: { name: string } | null;
}

interface FlagProduct {
    name: string;
}

interface FlagUser {
    name: string;
}

// More accurate Flag type based on Prisma schema and repository includes
interface BackendFlag {
  id: string; // UUID
  content_item_id: string;
  rule_id: string;
  ai_confidence: number; // Prisma Decimal maps to number
  reviewer_id?: string | null;
  rule_citation?: string | null;
  rule_section?: string | null;
  context_text?: string | null;
  context_start_index?: number | null;
  context_end_index?: number | null;
  image_reference_id?: string | null;
  flag_source: string;
  created_at: string; // ISO Date string
  updated_at: string; // ISO Date string
  rule_type: string;
  ai_evaluation?: string | null;
  product_id?: string | null;
  ai_confidence_reasoning?: string | null;
  ai_ruling?: string | null;
  ai_feedback_notes?: string | null;
  decision_made_at?: string | null; // ISO Date string
  human_verdict?: 'VIOLATION' | 'COMPLIANT' | 'ERROR' | null; // Enum
  human_verdict_reasoning?: string | null;
  in_review_at?: string | null; // ISO Date string
  internal_notes?: string | null;
  remediation_completed_at?: string | null; // ISO Date string
  reviewed_at?: string | null; // ISO Date string
  status: 'PENDING' | 'IN_REVIEW' | 'REMEDIATING' | 'CLOSED'; // Enum
  example_selection_reason?: string | null;
  is_learning_example: boolean;
  rule_version_applied?: string | null;
  librarian_consulted: boolean;
  librarian_examples_provided: boolean;
  resolution_method?: 'AI_AUTO_REMEDIATE' | 'AI_AUTO_CLOSE' | 'HUMAN_REVIEW' | null; // Enum
  content_source?: string | null;
  transcript_end_ms?: number | null;
  transcript_start_ms?: number | null; // Needed for screenshot timestamp

  // Included relations from repository
  content_items: FlagContentItem;
  products?: FlagProduct | null;
  users?: FlagUser | null; // Reviewer
}

// Local state type for the verdict form
interface VerdictFormState {
  isViolation: boolean | null;
  severity: 'low' | 'medium' | 'high' | string;
  feedback: string;
  comments: string;
}

interface FlagPreviewProps {
  flag: BackendFlag; // Use the more accurate type
  onVerdictSubmit: (verdict: VerdictFormState & { timestamp: string }) => void;
}

const FlagPreview: React.FC<FlagPreviewProps> = ({ flag, onVerdictSubmit }) => {
  const [verdict, setVerdict] = useState<VerdictFormState>({
    isViolation: flag.human_verdict === 'VIOLATION' ? true : flag.human_verdict === 'COMPLIANT' ? false : null,
    severity: 'medium',
    feedback: '',
    comments: ''
  });
  const [isScreenshotLoading, setIsScreenshotLoading] = useState(false);
  const [screenshotError, setScreenshotError] = useState<string | null>(null);

  // Reset verdict state when the selected flag changes
  useEffect(() => {
    // Map backend enum/boolean to local state
    const initialIsViolation = flag.human_verdict === 'VIOLATION' ? true : flag.human_verdict === 'COMPLIANT' ? false : null;
    // TODO: Map severity if stored on backend flag object
    const initialSeverity = 'medium'; // Default or map from flag if available
    const initialFeedback = flag.human_verdict_reasoning ?? '';
    const initialComments = flag.internal_notes ?? '';

    setVerdict({
      isViolation: initialIsViolation,
      severity: initialSeverity,
      feedback: initialFeedback,
      comments: initialComments
    });
  }, [flag]); // Dependency array ensures this runs when `flag` prop changes

  // Mock history - replace with real data later
  const [history] = useState([
    {
      timestamp: '2025-04-25 10:15am',
      action: `Status changed to "${flag.status}"`,
      user: 'Jane'
    },
    {
      timestamp: '2025-04-24 08:32pm',
      action: `Flag created by system (AI confidence: ${flag.ai_confidence}%)`, // Use correct property
      user: 'System'
    }
  ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())); // Sort history correctly

  const handleVerdictChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    
    if (type === 'radio' && name === 'isViolation') {
      setVerdict(prev => ({
        ...prev,
        isViolation: value === 'true' // Convert string 'true'/'false' to boolean
      }));
    } else {
      setVerdict(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  const handleSubmit = () => {
    if (verdict.isViolation === null) {
      alert("Please select a ruling (Confirm Violation or Mark Compliant).");
      return;
    }
    
    onVerdictSubmit({
      ...verdict,
      timestamp: new Date().toISOString() // Add timestamp on submit
    });
  };

  // --- Screenshot Logic ---
  const getYouTubeVideoId = (url: string): string | null => {
    if (!url) return null;
    try {
      const parsedUrl = new URL(url);
      if (parsedUrl.hostname === 'youtu.be') {
        return parsedUrl.pathname.slice(1); // Get ID from path for youtu.be links
      }
      if (parsedUrl.hostname.includes('youtube.com')) {
        return parsedUrl.searchParams.get('v'); // Get 'v' query parameter
      }
    } catch (e) {
      console.error("Error parsing YouTube URL:", e);
    }
    return null; // Return null if not a recognizable YouTube URL or parsing failed
  };

  const handleScreenshot = async () => {
    if (!flag.content_items?.url || flag.transcript_start_ms === null || flag.transcript_start_ms === undefined) {
      setScreenshotError("Missing URL or timestamp for screenshot.");
      return;
    }

    const videoId = getYouTubeVideoId(flag.content_items.url);
    if (!videoId) {
      setScreenshotError("Could not extract YouTube Video ID from URL.");
      return;
    }

    const seconds = flag.transcript_start_ms / 1000;

    setIsScreenshotLoading(true);
    setScreenshotError(null);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'; // Get API base URL
      const response = await axios.post(`${apiUrl}/api/screenshots`, {
        videoId: videoId,
        seconds: seconds,
        flagId: flag.id
      }, {
        withCredentials: true // Important for sending auth cookies if needed by backend
      });

      console.log("Screenshot API Response:", response.data);
      alert(`Screenshot captured successfully! (Cached: ${response.data.cached})`);
      // TODO: Optionally refresh flag data here to show the linked image if UI supports it
      // e.g., call a function passed via props: props.refreshFlagData(flag.id);

    } catch (err: any) {
      console.error("Screenshot Error:", err);
      let errorMsg = "Failed to capture screenshot.";
      if (axios.isAxiosError(err) && err.response) {
        // Use error message from backend if available
        errorMsg = err.response.data?.error || err.response.data?.message || errorMsg;
        if (err.response.status === 429) {
          errorMsg = "Rate limit exceeded. Please try again later.";
        }
      }
      setScreenshotError(errorMsg);
      alert(`Error: ${errorMsg}`); // Show alert for now
    } finally {
      setIsScreenshotLoading(false);
    }
  };
  // --- End Screenshot Logic ---


  return (
    // Flex column layout to manage scrolling
    <div className="space-y-4 h-full flex flex-col">
      {/* Header */}
      <div className="flex justify-between items-start flex-shrink-0 border-b border-[#2A2C32] pb-3 mb-3"> {/* Added border */}
        <div>
          {/* Use data from nested objects */}
          <h2 className="text-lg font-semibold text-text-primary">
            {flag.content_items?.publishers?.name ?? 'Unknown Publisher'} - {flag.products?.name ?? 'Unknown Product'}
          </h2>
          <p className="text-sm text-text-secondary">
            {flag.content_items?.scan_jobs?.name ?? 'Unknown Scan'} ({new Date(flag.created_at).toLocaleDateString()})
          </p>
        </div>
        <div className="flex items-center space-x-2 pt-1"> {/* Adjusted padding */}
          <span className="text-xs text-text-secondary">AI Confidence:</span> {/* Adjusted size */}
          <span className={`font-mono font-bold text-sm ${ // Adjusted size
            flag.ai_confidence >= 90
              ? 'text-error'
              : flag.ai_confidence >= 70
                ? 'text-warning'
                : 'text-text-secondary'
          }`}>
            {flag.ai_confidence}%
          </span>
        </div>
      </div>

      {/* Main Content Area (Scrollable) */}
      <div className="flex-grow overflow-y-auto pr-2 space-y-4"> {/* Added padding-right */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4"> {/* Adjusted gap */}
          {/* Left Column */}
          <div className="space-y-4">
            <div className="bg-background rounded-md p-3 border border-[#2A2C32]"> {/* Adjusted padding */}
              <h3 className="font-medium mb-2 text-text-primary text-sm">Content Preview</h3> {/* Adjusted size */}
              <div className="aspect-video bg-[#0A0B0E] rounded flex items-center justify-center mb-2">
                {/* TODO: Display actual image/video preview if available (e.g., flag.image_reference_id?) */}
                <span className="text-text-secondary text-xs">Video/Image Preview Placeholder</span> {/* Adjusted size */}
              </div>
              <div className="text-xs text-text-secondary truncate mb-2"> {/* Added mb-2 */}
                {/* Use correct nested property */}
                Source: <a href={flag.content_items?.url} className="text-accent-teal hover:underline" target="_blank" rel="noopener noreferrer">{flag.content_items?.url ?? 'N/A'}</a>
              </div>
              {/* --- Add Screenshot Button --- */}
              {(flag.content_items?.platform?.toLowerCase() === 'youtube' || flag.content_items?.platform?.toLowerCase() === 'youtube_shorts') &&
               flag.transcript_start_ms !== null && flag.transcript_start_ms !== undefined && (
                <div className="mt-2">
                  <button
                    onClick={handleScreenshot}
                    disabled={isScreenshotLoading}
                    className="btn-secondary w-full text-sm py-1.5 disabled:opacity-50 disabled:cursor-not-allowed" // Adjusted style/padding
                  >
                    {isScreenshotLoading ? 'Capturing...' : `Capture Screenshot @ ${Math.round(flag.transcript_start_ms / 1000)}s`}
                  </button>
                  {screenshotError && (
                    <p className="text-error text-xs mt-1">{screenshotError}</p>
                  )}
                </div>
              )}
              {/* --- End Screenshot Button --- */}
            </div>

            <div className="bg-background rounded-md p-3 border border-[#2A2C32]"> {/* Adjusted padding */}
              <h3 className="font-medium mb-2 text-text-primary text-sm">Transcript</h3> {/* Adjusted size */}
              <div className="text-xs text-text-secondary p-2 border border-[#3B3D44] rounded-md max-h-32 overflow-y-auto bg-surface"> {/* Adjusted size/height */}
                 {/* Use correct nested property - display context_text if transcript is complex */}
                <p>{flag.context_text ?? JSON.stringify(flag.content_items?.transcript) ?? 'No transcript available'}</p>
              </div>
            </div>
          </div>
          
          {/* Right Column */}
          <div className="space-y-4">
            <div className="bg-background rounded-md p-3 border border-[#2A2C32]"> {/* Adjusted padding */}
              <h3 className="font-medium mb-2 text-text-primary text-sm">Rule Information</h3> {/* Adjusted size */}
              <div className="text-xs text-text-secondary p-2 border border-[#3B3D44] rounded-md bg-surface"> {/* Adjusted size */}
                 {/* Use rule_id or citation. Need to fetch rule name separately */}
                <p className="font-medium text-accent-teal mb-1">{flag.rule_citation ?? `Rule ID: ${flag.rule_id}`}</p>
                 {/* Use context_text or rule_section */}
                <p>{flag.context_text ?? flag.rule_section ?? 'No specific section/context provided.'}</p>
              </div>
            </div>

            <div className="bg-background rounded-md p-3 border border-[#2A2C32]"> {/* Adjusted padding */}
              <h3 className="font-medium mb-2 text-text-primary text-sm">AI Analysis</h3> {/* Adjusted size */}
              <div className="text-xs text-text-secondary p-2 border border-[#3B3D44] rounded-md bg-surface"> {/* Adjusted size */}
                 {/* Use ai_confidence_reasoning or ai_evaluation */}
                <p>{flag.ai_confidence_reasoning ?? flag.ai_evaluation ?? 'No AI reasoning provided.'}</p>
              </div>
            </div>
          </div>
        </div>
        
        {/* Human Verdict Section */}
        <div className="bg-background rounded-md p-4 border border-[#2A2C32]"> {/* Adjusted padding */}
          <h3 className="font-medium mb-3 text-text-primary text-sm">Human Verdict</h3> {/* Adjusted size */}
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium mb-2 text-text-secondary">Ruling</label> {/* Adjusted size */}
              <div className="flex space-x-6">
                <label className="inline-flex items-center cursor-pointer">
                  <input
                    type="radio"
                    name="isViolation"
                    value="true"
                    checked={verdict.isViolation === true}
                    onChange={handleVerdictChange}
                    className="mr-2 h-4 w-4 text-accent-teal focus:ring-accent-teal border-[#3B3D44] bg-surface" /* Added bg */
                  />
                  <span className="text-sm text-text-primary">Confirm Violation</span>
                </label>
                <label className="inline-flex items-center cursor-pointer">
                  <input
                    type="radio"
                    name="isViolation"
                    value="false"
                    checked={verdict.isViolation === false}
                    onChange={handleVerdictChange}
                    className="mr-2 h-4 w-4 text-accent-teal focus:ring-accent-teal border-[#3B3D44] bg-surface" /* Added bg */
                  />
                  <span className="text-sm text-text-primary">Mark Compliant</span>
                </label>
              </div>
            </div>
            
            {verdict.isViolation === true && (
              <div>
                <label htmlFor="severity" className="block text-xs font-medium mb-1 text-text-secondary"> {/* Adjusted size */}
                  Severity
                </label>
                <select
                  id="severity"
                  name="severity"
                  value={verdict.severity}
                  onChange={handleVerdictChange}
                  className="input w-full text-sm" /* Adjusted size */
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
            )}
            
            <div>
              <label htmlFor="feedback" className="block text-xs font-medium mb-1 text-text-secondary"> {/* Adjusted size */}
                Feedback (Reasoning)
              </label>
              <textarea
                id="feedback"
                name="feedback"
                rows={3} // Adjusted rows
                value={verdict.feedback}
                onChange={handleVerdictChange}
                className="input w-full text-sm" /* Adjusted size */
                placeholder="Provide reasoning for your verdict..."
              ></textarea>
            </div>
            
            <div>
              <label htmlFor="comments" className="block text-xs font-medium mb-1 text-text-secondary"> {/* Adjusted size */}
                Internal Comments
              </label>
              <textarea
                id="comments"
                name="comments"
                rows={3} // Adjusted rows
                value={verdict.comments}
                onChange={handleVerdictChange}
                className="input w-full text-sm" /* Adjusted size */
                placeholder="Add internal notes here..."
              ></textarea>
            </div>
            
            <div className="pt-2">
              <button
                onClick={handleSubmit}
                disabled={verdict.isViolation === null}
                className="btn-primary w-full text-sm py-2" /* Adjusted size/padding */
              >
                Submit Verdict
              </button>
            </div>
          </div>
        </div>

        {/* History Section */}
        <div className="bg-background rounded-md p-3 border border-[#2A2C32]"> {/* Adjusted padding */}
          <h3 className="font-medium mb-2 text-text-primary text-sm">History</h3> {/* Adjusted size */}
          <div className="space-y-1 max-h-24 overflow-y-auto"> {/* Adjusted spacing/height */}
            {history.map((item, index) => (
              <div key={index} className="flex text-xs">
                <span className="text-text-secondary w-32 flex-shrink-0">{item.timestamp}</span>
                <span className="text-text-primary flex-grow mx-2">{item.action}</span>
                <span className="text-accent-teal">{item.user}</span>
              </div>
            ))}
             {history.length === 0 && <p className="text-xs text-text-secondary">No history available.</p>}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FlagPreview;
