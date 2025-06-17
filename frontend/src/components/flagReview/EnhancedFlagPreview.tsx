'use client';

import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios'; // Keep axios for isAxiosError check
import apiClient from '../../services/api/client';
import { useAuth } from '../../services/auth/AuthContext'; // Added for user role
import { flagService } from '../../services/flagService'; // Import flagService
import { ruleService, ProductRuleDetail } from '../../services/ruleService'; // Import ruleService
import ENDPOINTS from '../../services/api/endpoints'; // Import ENDPOINTS

// Define interfaces for better type safety
// This HumanVerdict is local to this component, ensure it matches what's passed
interface HumanVerdictUI {
  isViolation: boolean | null;
  severity: string;
  feedback: string;
  comments: string;
  timestamp: string;
}

// This interface should now match the PreviewFlag structure from ConnectedFlagReviewContent.tsx
interface PreviewFlagFromParent { // Renamed to avoid conflict if this file also defines PreviewFlag
  id: string; // This is the Flag's own ID
  contentItemId: string; // This is the ID of the associated content_item
  ruleId: string; // Added ruleId
  scanJob: string;
  publisher: string;
  product: string;
  rule: string; // This is the rule name
  date: string;
  aiConfidence: number;
  status: string;
  humanVerdict?: HumanVerdictUI;

  platform: string;
  contentMediaType: string;
  // For IG/TT video, mediaDisplaySrc will now hold the media_id. For YouTube, it's the original URL.
  mediaDisplaySrc: string; 
  // For IG/TT image carousel, mediaItems will just contain the media_id.
  mediaItems: Array<{ id: string }>; // id here is media_id
  transcriptStartMs?: number | null;
  fullDescription: string | null;
  originalPlatformUrl: string | null;
  contextSnippet: string | null;
  ruleText: string;
  aiReasoning: string | null;
  aiVerdict: string | null;
  comments?: FlagComment[]; // Added from ConnectedFlagReviewContent
}

// Define the structure for a flag comment (consistent with ConnectedFlagReviewContent)
interface FlagComment {
  id: string;
  flag_id: string;
  user_id: string;
  comment: string;
  created_at: string;
  user_name: string;
  user_role: string;
}

interface EnhancedFlagPreviewProps {
  flag: PreviewFlagFromParent;
  onVerdictSubmit: (verdict: {
    isViolation: boolean | null;
    severity: string;
    feedback: string;
    comments: string;
    timestamp: string;
  }) => void;
  onCommentAdded: () => Promise<void>; // Added prop for refreshing data
}

const EnhancedFlagPreview: React.FC<EnhancedFlagPreviewProps> = ({ flag, onVerdictSubmit, onCommentAdded }) => {
  // Local state for form inputs
  const [isViolation, setIsViolation] = useState<boolean | null>(
    flag.humanVerdict?.isViolation ?? null
  );
  const [severity, setSeverity] = useState(flag.humanVerdict?.severity || 'medium'); // Will be removed visually
  const [feedback, setFeedback] = useState(flag.humanVerdict?.feedback || '');
  const [comments, setComments] = useState(flag.humanVerdict?.comments || '');
  const [reviewerComment, setReviewerComment] = useState(''); // For the new Publisher Communication input
  const { user } = useAuth(); // Get current user for comment posting/display logic

  // State for image carousel
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0);
  const [resolvedMediaSrc, setResolvedMediaSrc] = useState<string | null>(null);
  const [resolvedCarouselItems, setResolvedCarouselItems] = useState<Array<{ id: string; proxyUrl: string }>>([]);
  const [isMediaLoading, setIsMediaLoading] = useState<boolean>(false);
  const [mediaError, setMediaError] = useState<string | null>(null);
  
  const [isScreenshotLoading, setIsScreenshotLoading] = useState(false);
  const [screenshotError, setScreenshotError] = useState<string | null>(null); // Corrected: screenshotError was setScreenshotError

  // State for fetching rule details
  const [productRuleDetail, setProductRuleDetail] = useState<ProductRuleDetail | null>(null);
  // Initialize isRuleLoading based on presence of flag.ruleId to show loading state immediately
  const [isRuleLoading, setIsRuleLoading] = useState<boolean>(!!flag.ruleId);
  const [ruleError, setRuleError] = useState<string | null>(null);

  // Reset states when the flag prop changes
  useEffect(() => {
    setCurrentMediaIndex(0);
    setResolvedMediaSrc(null);
    setResolvedCarouselItems([]); // This will now be Array<{ id: string; resolvedUrl: string; error?: boolean }>
    setIsMediaLoading(true);
    setMediaError(null);

    // Fetch tokenized URLs for Instagram/TikTok media
    if ((flag.platform === 'instagram' || flag.platform === 'tiktok')) {
      // Ensure flag.contentItemId is available (it should be passed from PreviewFlag)
      // The 'id' on the flag prop is the flag's own ID. We need contentItemId.
      // This requires PreviewFlagFromParent to include contentItemId.
      // For now, assuming flag.id IS the contentItemId for the purpose of this useEffect.
      // THIS IS A CRITICAL ASSUMPTION AND MUST BE VERIFIED/CORRECTED in ConnectedFlagReviewContent.tsx
      // The previous step *should* have added contentItemId to PreviewFlag, so flag.contentItemId should be used.
      // Let's assume PreviewFlagFromParent will be updated to include contentItemId.
      // So, we'll use flag.contentItemId (once it's added to the interface).
      // For now, I'll write it as flag.id and we'll correct PreviewFlagFromParent interface next.
      // Actually, the PreviewFlagFromParent interface is what this component receives.
      // It needs to be updated to include contentItemId.

      // const contentItemId = (flag as any).contentItemId; // Temporary cast until interface is updated
      // Use the properly typed contentItemId from the flag prop
      const contentItemId = flag.contentItemId;


      if (!contentItemId) {
        console.error("CRITICAL: contentItemId is missing from flag prop in EnhancedFlagPreview. Cannot fetch media URLs.");
        setMediaError("Configuration error: Missing content item ID.");
        setIsMediaLoading(false);
        return;
      }

      if (flag.contentMediaType === 'video' && flag.mediaDisplaySrc) { // mediaDisplaySrc now holds media_id for IG/TT video
        flagService.getMediaAccessUrl(contentItemId, flag.mediaDisplaySrc) 
          .then(response => {
            setResolvedMediaSrc(response.data.mediaAccessUrl); 
          })
          .catch(err => {
            console.error("Error fetching media access URL for video:", err);
            setMediaError("Failed to load video.");
          })
          .finally(() => setIsMediaLoading(false));
      } else if (flag.contentMediaType === 'image' && flag.mediaItems && flag.mediaItems.length > 0) {
        const fetchPromises = flag.mediaItems.map(item => // item.id is media_id
          flagService.getMediaAccessUrl(contentItemId, item.id) 
            .then(response => ({ id: item.id, proxyUrl: response.data.mediaAccessUrl })) // Keep proxyUrl for resolved items
        );
        Promise.all(fetchPromises)
          .then(newItems => {
            setResolvedCarouselItems(newItems);
          })
          .catch(err => {
            console.error("Error fetching media access URLs for carousel:", err);
            setMediaError("Failed to load images.");
          })
          .finally(() => setIsMediaLoading(false));
      } else {
        setIsMediaLoading(false); // No media to load
      }
    } else {
      setIsMediaLoading(false); // Not IG/TT
    }

    // Fetch product rule details if ruleId is present
    if (flag.ruleId) {
      // If ruleId changes, we need to ensure loading state is set true for the new fetch
      if (!isRuleLoading) setIsRuleLoading(true); 
      setRuleError(null);
      setProductRuleDetail(null); // Reset previous rule detail
      ruleService.getProductRule(flag.ruleId)
        .then(response => {
          setProductRuleDetail(response.data);
        })
        .catch(err => {
          console.error("Error fetching product rule:", err);
          setRuleError("Failed to load rule details.");
        })
        .finally(() => setIsRuleLoading(false));
    } else {
      // If no ruleId, clear any existing rule details and errors
      setProductRuleDetail(null);
      setRuleError(null);
      setIsRuleLoading(false); // Ensure loading is false if no ruleId
    }
  }, [flag.id, flag.platform, flag.contentMediaType, flag.mediaDisplaySrc, flag.mediaItems, flag.ruleId]); // isRuleLoading removed from dep array as it's managed within

  // Function to handle verdict submission
  const handleSubmit = () => {
    // isViolation can be true or false, null means no decision made yet.
    const verdictData = {
      isViolation,
      severity: '', // Severity is being removed from UI, send empty or handle in onVerdictSubmit
      feedback,
      comments,
      timestamp: new Date().toISOString(),
    };

    onVerdictSubmit(verdictData);
  };

  const handlePostReviewerComment = async () => {
    if (!reviewerComment.trim() || !flag || !user) return;

    try {
      await flagService.addFlagComment(flag.id, reviewerComment.trim());
      setReviewerComment(''); // Clear input
      await onCommentAdded(); // Call the callback to refresh data in parent
      // Optionally, provide user feedback (e.g., toast notification)
      // alert('Comment posted successfully!'); // Simple alert for now
    } catch (error) {
      console.error('Error posting comment:', error);
      // Provide more specific error feedback if possible
      let errorMessage = 'Failed to post comment.';
      if (axios.isAxiosError(error) && error.response) {
        errorMessage = error.response.data?.message || errorMessage;
      }
      alert(errorMessage);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!flag || !user) return;

    // Confirmation dialog
    const confirmDelete = window.confirm('Are you sure you want to delete this comment?');
    if (!confirmDelete) {
      return;
    }

    try {
      // Assuming flagService will have deleteFlagComment method
      // This method needs to be added to frontend/src/services/flagService.ts
      await flagService.deleteFlagComment(flag.id, commentId);
      await onCommentAdded(); // Refresh comments list
      // alert('Comment deleted successfully!'); // Optional success feedback
    } catch (error) {
      console.error('Error deleting comment:', error);
      let errorMessage = 'Failed to delete comment.';
      if (axios.isAxiosError(error) && error.response) {
        errorMessage = error.response.data?.message || errorMessage;
      }
      alert(errorMessage);
    }
  };
  
  const formatCommentTimestamp = (timestamp: string) => {
    try {
      return new Date(timestamp).toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      });
    } catch (e) {
      return 'Invalid date';
    }
  };

  // Helper function to get confidence level style
  const getConfidenceStyle = (confidence: number) => {
    if (confidence >= 90) return { color: 'text-error', label: 'High' };
    if (confidence >= 70) return { color: 'text-warning', label: 'Medium' };
    return { color: 'text-text-secondary', label: 'Low' };
  };

  const confidenceStyle = getConfidenceStyle(flag.aiConfidence);

  // --- Screenshot Logic (Moved inside component) ---
  const getYouTubeVideoId = (url: string | null): string | null => {
    if (!url) return null;
    let videoId: string | null = null;
    try {
      const parsedUrl = new URL(url);
      if (parsedUrl.hostname === 'youtu.be') {
        videoId = parsedUrl.pathname.slice(1);
      } else if (parsedUrl.hostname.includes('youtube.com')) {
        if (parsedUrl.pathname.startsWith('/shorts/')) {
          videoId = parsedUrl.pathname.split('/shorts/')[1];
        } else {
          videoId = parsedUrl.searchParams.get('v');
        }
      }
    } catch (e) {
      console.error("Error parsing YouTube URL:", e, url);
      return null;
    }
    // Remove any potential query params from videoId if path-based
    if (videoId && videoId.includes('?')) {
      videoId = videoId.split('?')[0];
    }
    console.log(`getYouTubeVideoId - Original URL: ${url}, Extracted Video ID: ${videoId}`);
    return videoId;
  };

  const handleScreenshot = async () => {
    // Use flag.originalPlatformUrl for YouTube video ID extraction
    if (!flag.originalPlatformUrl || flag.transcriptStartMs === null || flag.transcriptStartMs === undefined) {
      setScreenshotError("Missing URL or timestamp for screenshot.");
      return;
    }

    const videoId = getYouTubeVideoId(flag.originalPlatformUrl); // This uses flag.originalPlatformUrl
    if (!videoId) {
      setScreenshotError("Could not extract YouTube Video ID from URL.");
      return;
    }

    const seconds = flag.transcriptStartMs / 1000;

    setIsScreenshotLoading(true);
    setScreenshotError(null);

    try {
      // Use apiClient which should automatically handle auth headers
      const response = await apiClient.post('/screenshots', { // Corrected relative path
        videoId: videoId,
        seconds: seconds,
        flagId: flag.id
      });
      // Note: withCredentials is often configured globally in apiClient, so removed here

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
          </div>
        </div>
      </div>

      <div className="flex flex-col space-y-6 mb-6">
        {/* Content Preview Section */}
        <div>
          <h3 className="text-h3 mb-3">Content</h3>
          
          {/* YouTube Video */}
          {/* YouTube Video */}
          {/* YouTube Video */}
          {/* YouTube Video */}
          {(flag.platform === 'youtube' || flag.platform === 'youtube_shorts') && flag.mediaDisplaySrc && (
            <div className="bg-background rounded-card aspect-video overflow-hidden mb-4">
              <iframe
                src={`https://www.youtube.com/embed/${getYouTubeVideoId(flag.originalPlatformUrl)}?start=${flag.transcriptStartMs != null ? Math.max(0, Math.floor((flag.transcriptStartMs - 8000) / 1000)) : 0}&autoplay=0`}
                title="YouTube video player"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="w-full h-full"
              ></iframe>
            </div>
          )}

          {/* Instagram/TikTok Media (Image or Video, potentially carousel for images) */}
          {/* Instagram/TikTok Media (Image or Video, potentially carousel for images) */}
          {(flag.platform === 'instagram' || flag.platform === 'tiktok') && (
            <div className="bg-background rounded-card aspect-video overflow-hidden mb-4 flex items-center justify-center">
              {isMediaLoading && (
                <p className="text-text-secondary">Loading media...</p>
              )}
              {!isMediaLoading && mediaError && (
                <p className="text-error">{mediaError}</p>
              )}

              {!isMediaLoading && !mediaError && flag.contentMediaType === 'video' && (
                resolvedMediaSrc ? (
                  <video 
                    key={resolvedMediaSrc} // Add key to force re-render if src changes significantly
                    src={resolvedMediaSrc} 
                    controls 
                    className="w-full h-full object-contain"
                    onError={(e) => {
                      console.error('Error loading GCS video with tokenized URL:', e);
                      setMediaError("Video playback failed.");
                    }} 
                  >
                    Your browser does not support the video tag.
                  </video>
                ) : (
                  <p className="text-text-secondary">Media content not available or URL missing for {flag.platform} video.</p>
                )
              )}

              {!isMediaLoading && !mediaError && flag.contentMediaType === 'image' && (
                resolvedCarouselItems.length > 0 && resolvedCarouselItems[currentMediaIndex]?.proxyUrl ? (
                  <div className="relative w-full h-full"> {/* Ensure parent div takes full space for positioning */}
                    <img 
                      key={resolvedCarouselItems[currentMediaIndex]?.proxyUrl} // Add key
                      src={resolvedCarouselItems[currentMediaIndex]?.proxyUrl} 
                      alt={`Flagged content ${currentMediaIndex + 1} of ${resolvedCarouselItems.length}`}
                      className="max-w-full max-h-full object-contain"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.onerror = null; 
                        target.alt = 'Error loading image';
                        target.src = '/placeholder-image.svg'; 
                        console.error('Error loading GCS image with tokenized URL:', e);
                        setMediaError("Failed to load image.");
                      }}
                    />
                    {resolvedCarouselItems.length > 1 && (
                      <>
                        <button
                          onClick={() => setCurrentMediaIndex(prev => Math.max(0, prev - 1))}
                          disabled={currentMediaIndex === 0}
                          className="absolute left-2 top-1/2 -translate-y-1/2 bg-black bg-opacity-50 text-white p-2 rounded-full disabled:opacity-50"
                          aria-label="Previous image"
                        >
                          {'<'}
                        </button>
                        <button
                          onClick={() => setCurrentMediaIndex(prev => Math.min(resolvedCarouselItems.length - 1, prev + 1))}
                          disabled={currentMediaIndex === resolvedCarouselItems.length - 1}
                          className="absolute right-2 top-1/2 -translate-y-1/2 bg-black bg-opacity-50 text-white p-2 rounded-full disabled:opacity-50"
                          aria-label="Next image"
                        >
                          {'>'}
                        </button>
                        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black bg-opacity-75 text-white text-xs px-2 py-1 rounded">
                          {currentMediaIndex + 1} / {resolvedCarouselItems.length}
                        </div>
                      </>
                    )}
                  </div>
                ) : (
                  <p className="text-text-secondary">Media content not available or URL missing for {flag.platform} image.</p>
                )
              )}
            </div>
          )}
          {/* General Fallback if no platform matches or no media src for non-YT, and it's not IG/TT (which have their own fallbacks) */}
           {!(flag.platform === 'youtube' || flag.platform === 'youtube_shorts') && 
            !(flag.platform === 'instagram' || flag.platform === 'tiktok') && (
             <div className="bg-background rounded-card aspect-video overflow-hidden mb-4 flex items-center justify-center">
                <p className="text-text-secondary">Media content not available or platform unsupported.</p>
             </div>
           )}
        </div>

        {/* NEW: Full Description Section */}
        {flag.fullDescription && (
          <div className="my-4">
            <h4 className="text-sm font-semibold mb-2">Full Description:</h4>
            <div className="bg-background p-4 rounded-card max-h-60 overflow-y-auto">
              <p className="text-sm whitespace-pre-wrap">{flag.fullDescription}</p>
            </div>
          </div>
        )}

        {/* EXISTING: Transcript/Caption (Snippet) Section */}
        {flag.contextSnippet && (
          <div>
            <h4 className="text-sm font-semibold mb-2">Excerpt:</h4>
            <div className="bg-background p-4 rounded-card max-h-48 overflow-y-auto">
              <p className="text-sm">{flag.contextSnippet}</p>
            </div>
          </div>
        )}

        {/* Link to Original Content */}
        {flag.originalPlatformUrl && (
          <div>
            <a 
              href={flag.originalPlatformUrl} 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center text-secondary hover:underline"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              View Original Content
              {(flag.platform === 'youtube' || flag.platform === 'youtube_shorts') && flag.transcriptStartMs !== null && flag.transcriptStartMs !== undefined ? ' (with Timestamp)' : ''}
            </a>
          </div>
        )}

        {/* Screenshot Button for YouTube */}
        {(flag.platform === 'youtube' || flag.platform === 'youtube_shorts') &&
          flag.transcriptStartMs !== null && flag.transcriptStartMs !== undefined && flag.originalPlatformUrl && (
          <div className="mt-2">
            <button
              onClick={handleScreenshot}
              disabled={isScreenshotLoading}
              className="btn-secondary w-full text-sm py-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isScreenshotLoading ? 'Capturing...' : `Capture Screenshot @ ${(() => {
                const totalSeconds = Math.round((flag.transcriptStartMs || 0) / 1000);
                const minutes = Math.floor(totalSeconds / 60);
                const seconds = totalSeconds % 60;
                return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
              })()}`}
            </button>
            {screenshotError && (
              <p className="text-error text-xs mt-1">{screenshotError}</p>
            )}
          </div>
        )}
      </div>

      {/* Decision Controls */}
      <div className="mt-auto pt-4 border-t border-neutral-light">
        {/* --- NEW "Evaluation" Section --- */}
        <h3 className="text-h3 mb-4">Evaluation</h3>

        {/* Product Information (New) */}
        <div className="mb-5">
          <h4 className="text-sm font-semibold mb-2">Product:</h4>
          <div className="bg-background p-4 rounded-card">
            <p className="text-sm">{flag.product || 'N/A'}</p>
          </div>
        </div>

        {/* Excerpt (Moved) */}
        {flag.contextSnippet && (
          <div className="mb-5">
            <h4 className="text-sm font-semibold mb-2">Excerpt:</h4>
            <div className="bg-background p-4 rounded-card max-h-48 overflow-y-auto">
              <p className="text-sm">{flag.contextSnippet}</p>
            </div>
          </div>
        )}

        {/* Applicable Rule */}
        <div className="mb-5">
          <h4 className="text-sm font-semibold mb-2">
            Rule Applied: {isRuleLoading && !productRuleDetail && !ruleError ? 'Loading rule name...' : (productRuleDetail?.name || flag.rule || 'N/A')}
          </h4>
          <div className="bg-background p-4 rounded-card">
            {isRuleLoading && <p className="text-sm text-text-secondary">Loading rule description...</p>}
            {ruleError && !isRuleLoading && <p className="text-sm text-error">{ruleError}</p>}
            {!isRuleLoading && !ruleError && productRuleDetail && (
              <p className="text-sm">{productRuleDetail.manual_text || productRuleDetail.description || 'No detailed description available.'}</p>
            )}
            {/* This condition handles the case where an API call was made (ruleId exists) but no data came back and no error was explicitly set */}
            {!isRuleLoading && !ruleError && !productRuleDetail && flag.ruleId && (
              <p className="text-sm text-text-secondary">Rule details not found.</p>
            )}
            {/* This condition handles the case where there's no ruleId to begin with */}
            {!isRuleLoading && !ruleError && !productRuleDetail && !flag.ruleId && (
              <p className="text-sm text-text-secondary">{flag.ruleText}</p> 
            )}
          </div>
        </div>

        {/* New AI Evaluation Box */}
        <div className={`mb-5 p-4 rounded-card ${
          flag.aiVerdict?.toLowerCase() === 'violation' 
            ? 'bg-error bg-opacity-10' 
            : flag.aiVerdict?.toLowerCase() === 'compliant'
            ? 'bg-success bg-opacity-10'
            : 'bg-secondary bg-opacity-10'
        }`}>
          <div className="text-md font-bold mb-1">
            AI Verdict: {flag.aiVerdict ? flag.aiVerdict.charAt(0).toUpperCase() + flag.aiVerdict.slice(1) : 'N/A'}
          </div>
          {flag.aiReasoning && (
            <p className="text-sm mb-2">{flag.aiReasoning}</p>
          )}
          <div className="text-xs text-text-secondary">
            Based on {flag.aiConfidence}% confidence analysis
          </div>
        </div>
        
        {/* Previous Ruling (Kept) */}
        {flag.humanVerdict && (
          <div className="mb-5 p-4 rounded-card bg-background">
             <h4 className="text-sm font-semibold mb-2">Previous Ruling:</h4>
            <div className={`text-sm font-medium ${
              flag.humanVerdict.isViolation === true
                ? 'text-error'
                : 'text-success'
            }`}>
              {flag.humanVerdict.isViolation === true ? 'Violation' : 'Compliant'}
              {flag.humanVerdict.comments && <span className="text-text-secondary text-xs block mt-1">({flag.humanVerdict.comments})</span>}
            </div>
          </div>
        )}
        {/* --- End of new "Evaluation" Section --- */}

        <h3 className="text-h3 mb-3">Your Verdict</h3>
        
        {/* Violation/Compliant Buttons - Full Width */}
        <div className="flex space-x-2 mb-4 w-full">
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

        {/* Delete Flag Button */}
        <div className="mb-6">
          <button
            className="w-full py-2 px-4 rounded-btn border border-neutral-dark text-neutral-dark bg-surface hover:bg-neutral-dark hover:bg-opacity-10"
            onClick={() => {
              // Show confirmation dialog
              const confirmDelete = window.confirm(
                'Are you sure you want to delete this flag? This action cannot be undone and will remove the flag entirely from the database.'
              );
              
              if (confirmDelete) {
                // Call the deleteFlag method from flagService
                flagService.deleteFlag(flag.id)
                  .then(() => {
                    // Show success message
                    alert('Flag deleted successfully.');
                    // Navigate away or refresh the list - this will depend on how your app is structured
                    // For now, we'll just show an alert and assume the parent component will handle navigation
                  })
                  .catch(error => {
                    console.error('Error deleting flag:', error);
                    alert('Failed to delete flag. Please try again.');
                  });
              }
            }}
          >
            Delete Flag
          </button>
        </div>

        {/* Severity Dropdown Removed */}
        
        {/* Feedback on AI Ruling - Full Width */}
        <div className="mb-4">
          <label className="block text-sm font-medium mb-1 text-text-secondary">
            Feedback on AI Ruling - Used for Learning
          </label>
          <textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="Provide feedback on the AI's ruling..."
            className="input w-full"
            rows={3}
          ></textarea>
        </div>
        
        {/* Comments (Internal) - Full Width */}
        <div className="mb-6"> {/* Increased bottom margin before Publisher Communication */}
          <label className="block text-sm font-medium mb-1 text-text-secondary">
            Comments - Internal Use Only
          </label>
          <textarea
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            placeholder="Add any additional internal comments here..."
            className="input w-full h-24"
            rows={3}
          ></textarea>
        </div>

        {/* Publisher Communication Section */}
        <div className="mb-6">
          <h3 className="text-h3 mb-3 border-t border-neutral-light pt-4">Publisher Communication</h3>
          <div className="space-y-4 max-h-96 overflow-y-auto bg-background p-4 rounded-card">
            {(flag.comments && flag.comments.length > 0) ? (
              flag.comments.map(comment => (
                <div 
                  key={comment.id} 
                  className={`flex flex-col p-3 rounded-lg shadow-sm ${
                    comment.user_role?.toUpperCase() === 'PUBLISHER' 
                      ? 'bg-secondary bg-opacity-10 items-start' 
                      : 'bg-primary bg-opacity-10 items-end ml-auto' // REVIEWER or other roles on the right
                  }`}
                  style={{ maxWidth: '85%' }} // Prevent full width bubbles
                >
                  <div className={`w-full flex ${comment.user_role?.toUpperCase() === 'PUBLISHER' ? 'justify-start' : 'justify-end'}`}>
                    <div className={`p-3 rounded-lg ${
                      comment.user_role?.toUpperCase() === 'PUBLISHER' 
                        ? 'bg-secondary text-secondary-content' 
                        : 'bg-blue-100 text-blue-800' // Changed for Reviewer/Admin
                    }`}>
                      <p className="text-sm">{comment.comment}</p>
                    </div>
                  </div>
                  <div className={`w-full text-xs mt-1 text-text-secondary ${
                    comment.user_role?.toUpperCase() === 'PUBLISHER' ? 'text-left' : 'text-right'
                  }`}>
                    <span>
                      {comment.user_name || 'User'} ({comment.user_role || 'Role'}) - {formatCommentTimestamp(comment.created_at)}
                    </span>
                    {/* Show delete button if user is ADMIN or the author of the comment (and user object exists) */}
                    {user && (user.role === 'ADMIN' || user.id === comment.user_id) && (
                      <button
                        onClick={() => handleDeleteComment(comment.id)}
                        className="ml-2 text-error hover:text-error-dark" // Removed text-xs
                        style={{ verticalAlign: 'middle', background: 'none', border: 'none', padding: '0.25rem' }} // Added padding
                        aria-label="Delete comment"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}> {/* Increased size to h-5 w-5 */}
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-text-secondary italic text-center py-4">No communication yet.</p>
            )}
          </div>
          <div className="mt-4">
            <textarea
              value={reviewerComment}
              onChange={(e) => setReviewerComment(e.target.value)}
              placeholder="Type your message to the publisher..."
              className="input w-full mb-2"
              rows={3}
            />
            <button
              className="btn-primary w-full sm:w-auto"
              onClick={handlePostReviewerComment}
              disabled={!reviewerComment.trim()}
            >
              Send Message
            </button>
          </div>
        </div>
        
        <div className="flex justify-end pt-4 border-t border-neutral-light">
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
