'use client';

import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios'; // Keep axios for isAxiosError check
import apiClient from '../../services/api/client';
import { useAuth } from '../../services/auth/AuthContext';
import { flagService } from '../../services/flagService';
import { ruleService, ProductRuleDetail } from '../../services/ruleService';
import ENDPOINTS from '../../services/api/endpoints';

// Define interfaces for better type safety
interface HumanVerdictUI { // This might not be needed if we remove previous ruling entirely
  isViolation: boolean | null;
  severity: string;
  feedback: string;
  comments: string;
  timestamp: string;
}

interface PreviewFlagFromParent {
  id: string;
  contentItemId: string;
  ruleId: string;
  scanJob: string; // Will be hidden from publisher
  publisher: string; // Used for display
  product: string;
  rule: string; // Rule name
  date: string;
  aiConfidence: number; // Will be hidden
  status: string;
  humanVerdict?: HumanVerdictUI; // Will be removed

  platform: string;
  contentMediaType: string;
  mediaDisplaySrc: string;
  mediaItems: Array<{ id: string }>;
  transcriptStartMs?: number | null;
  fullDescription: string | null;
  originalPlatformUrl: string | null;
  contextSnippet: string | null;
  ruleText: string;
  aiReasoning: string | null;
  aiVerdict: string | null; // Will be hidden
  comments?: FlagComment[];
}

interface FlagComment {
  id: string;
  flag_id: string;
  user_id: string;
  comment: string;
  created_at: string;
  user_name: string;
  user_role: string; // Used to differentiate display, but not for delete logic here
}

interface PublisherFlagPreviewProps {
  flag: PreviewFlagFromParent;
  onCommentAdded: () => Promise<void>;
  onMarkAsRemediated: () => Promise<void>; // New prop for marking as remediated
}

const PublisherFlagPreview: React.FC<PublisherFlagPreviewProps> = ({ flag, onCommentAdded, onMarkAsRemediated }) => {
  const [reviewerComment, setReviewerComment] = useState('');
  const { user } = useAuth(); // Get current user for posting comments

  const [currentMediaIndex, setCurrentMediaIndex] = useState(0);
  const [resolvedMediaSrc, setResolvedMediaSrc] = useState<string | null>(null);
  const [resolvedCarouselItems, setResolvedCarouselItems] = useState<Array<{ id: string; proxyUrl: string }>>([]);
  const [isMediaLoading, setIsMediaLoading] = useState<boolean>(false);
  const [mediaError, setMediaError] = useState<string | null>(null);
  
  const [productRuleDetail, setProductRuleDetail] = useState<ProductRuleDetail | null>(null);
  const [isRuleLoading, setIsRuleLoading] = useState<boolean>(!!flag.ruleId);
  const [ruleError, setRuleError] = useState<string | null>(null);

  useEffect(() => {
    setCurrentMediaIndex(0);
    setResolvedMediaSrc(null);
    setResolvedCarouselItems([]);
    setIsMediaLoading(true);
    setMediaError(null);

    const contentItemId = flag.contentItemId;

    if (!contentItemId) {
      console.error("CRITICAL: contentItemId is missing from flag prop in PublisherFlagPreview. Cannot fetch media URLs.");
      setMediaError("Configuration error: Missing content item ID.");
      setIsMediaLoading(false);
      return;
    }

    if ((flag.platform === 'instagram' || flag.platform === 'tiktok')) {
      if (flag.contentMediaType === 'video' && flag.mediaDisplaySrc) {
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
        const fetchPromises = flag.mediaItems.map(item =>
          flagService.getMediaAccessUrl(contentItemId, item.id) 
            .then(response => ({ id: item.id, proxyUrl: response.data.mediaAccessUrl }))
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
        setIsMediaLoading(false);
      }
    } else {
      setIsMediaLoading(false);
    }

    if (flag.ruleId) {
      if (!isRuleLoading) setIsRuleLoading(true); 
      setRuleError(null);
      setProductRuleDetail(null);
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
      setProductRuleDetail(null);
      setRuleError(null);
      setIsRuleLoading(false);
    }
  }, [flag.id, flag.platform, flag.contentMediaType, flag.mediaDisplaySrc, flag.mediaItems, flag.ruleId, flag.contentItemId, isRuleLoading]);

  const handlePostReviewerComment = async () => {
    if (!reviewerComment.trim() || !flag || !user) return;

    try {
      // Publishers will post comments as themselves.
      // The backend should associate the comment with the logged-in publisher user.
      await flagService.addFlagComment(flag.id, reviewerComment.trim());
      setReviewerComment('');
      await onCommentAdded();
    } catch (error) {
      console.error('Error posting comment:', error);
      let errorMessage = 'Failed to post comment.';
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
    if (videoId && videoId.includes('?')) {
      videoId = videoId.split('?')[0];
    }
    return videoId;
  };

  return (
    <div className="h-full flex flex-col">
      <div className="mb-4 pb-4 border-b border-neutral-light">
        <div className="flex justify-between items-start">
          <div>
            {/* Publisher name might be redundant if this is within a publisher-specific portal */}
            {/* <h2 className="text-h2">{flag.publisher}</h2> */} 
            <p className="text-text-secondary mb-1">Product: {flag.product}</p>
          </div>
          {/* AI Confidence removed from header */}
        </div>
      </div>

      <div className="flex flex-col space-y-6 mb-6">
        {/* Content Preview Section */}
        <div>
          <h3 className="text-h3 mb-3">Flagged Content</h3>
          
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
                    key={resolvedMediaSrc}
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
                  <p className="text-text-secondary">Media content not available for {flag.platform} video.</p>
                )
              )}

              {!isMediaLoading && !mediaError && flag.contentMediaType === 'image' && (
                resolvedCarouselItems.length > 0 && resolvedCarouselItems[currentMediaIndex]?.proxyUrl ? (
                  <div className="relative w-full h-full">
                    <img 
                      key={resolvedCarouselItems[currentMediaIndex]?.proxyUrl}
                      src={resolvedCarouselItems[currentMediaIndex]?.proxyUrl} 
                      alt={`Flagged content ${currentMediaIndex + 1} of ${resolvedCarouselItems.length}`}
                      className="max-w-full max-h-full object-contain"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.onerror = null; 
                        target.alt = 'Error loading image';
                        // Consider a placeholder image if you have one
                        // target.src = '/placeholder-image.svg'; 
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
                  <p className="text-text-secondary">Media content not available for {flag.platform} image.</p>
                )
              )}
            </div>
          )}
           {!(flag.platform === 'youtube' || flag.platform === 'youtube_shorts') && 
            !(flag.platform === 'instagram' || flag.platform === 'tiktok') && (
             <div className="bg-background rounded-card aspect-video overflow-hidden mb-4 flex items-center justify-center">
                <p className="text-text-secondary">Media content not available or platform unsupported.</p>
             </div>
           )}
        </div>

        {flag.fullDescription && (
          <div className="my-4">
            <h4 className="text-sm font-semibold mb-2">Full Description:</h4>
            <div className="bg-background p-4 rounded-card max-h-60 overflow-y-auto">
              <p className="text-sm whitespace-pre-wrap">{flag.fullDescription}</p>
            </div>
          </div>
        )}

        {flag.contextSnippet && (
          <div>
            <h4 className="text-sm font-semibold mb-2">Excerpt:</h4>
            <div className="bg-background p-4 rounded-card max-h-48 overflow-y-auto">
              <p className="text-sm">{flag.contextSnippet}</p>
            </div>
          </div>
        )}

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
              {(flag.platform === 'youtube' || flag.platform === 'youtube_shorts') && flag.transcriptStartMs !== null && flag.transcriptStartMs !== undefined ? ` (at ${(() => {
                const totalSeconds = Math.round((flag.transcriptStartMs || 0) / 1000);
                const minutes = Math.floor(totalSeconds / 60);
                const seconds = totalSeconds % 60;
                return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
              })()})` : ''}
            </a>
          </div>
        )}
        {/* Screenshot button removed */}
      </div>

      {/* Evaluation Details for Publisher */}
      <div className="mt-auto pt-4 border-t border-neutral-light">
        <h3 className="text-h3 mb-4">Violation Details</h3>

        <div className="mb-5">
          <h4 className="text-sm font-semibold mb-2">Product:</h4>
          <div className="bg-background p-4 rounded-card">
            <p className="text-sm">{flag.product || 'N/A'}</p>
          </div>
        </div>

        {/* Excerpt repeated here for context, could be optional if shown above */}
        {flag.contextSnippet && (
          <div className="mb-5">
            <h4 className="text-sm font-semibold mb-2">Relevant Excerpt:</h4>
            <div className="bg-background p-4 rounded-card max-h-48 overflow-y-auto">
              <p className="text-sm">{flag.contextSnippet}</p>
            </div>
          </div>
        )}

        <div className="mb-5">
          <h4 className="text-sm font-semibold mb-2">
            Rule Violated: {isRuleLoading && !productRuleDetail && !ruleError ? 'Loading rule name...' : (productRuleDetail?.name || flag.rule || 'N/A')}
          </h4>
          <div className="bg-background p-4 rounded-card">
            {isRuleLoading && <p className="text-sm text-text-secondary">Loading rule description...</p>}
            {ruleError && !isRuleLoading && <p className="text-sm text-error">{ruleError}</p>}
            {!isRuleLoading && !ruleError && productRuleDetail && (
              <p className="text-sm">{productRuleDetail.manual_text || productRuleDetail.description || 'No detailed description available.'}</p>
            )}
            {!isRuleLoading && !ruleError && !productRuleDetail && flag.ruleId && (
              <p className="text-sm text-text-secondary">Rule details not found.</p>
            )}
            {!isRuleLoading && !ruleError && !productRuleDetail && !flag.ruleId && (
              <p className="text-sm text-text-secondary">{flag.ruleText}</p> 
            )}
          </div>
        </div>

        {/* AI Reasoning (Verdict and Confidence removed) */}
        {flag.aiReasoning && (
          <div className="mb-5 p-4 rounded-card bg-secondary bg-opacity-10">
            <div className="text-md font-bold mb-1">
              Violation Analysis:
            </div>
            <p className="text-sm mb-2">{flag.aiReasoning}</p>
          </div>
        )}
        
        {/* Previous Ruling section removed */}
        {/* "Your Verdict" section (buttons, feedback, internal comments, submit) removed */}

        {/* Publisher Communication Section */}
        <div className="mb-6">
          <h3 className="text-h3 mb-3 border-t border-neutral-light pt-4">Communication</h3>
          <div className="space-y-4 max-h-96 overflow-y-auto bg-background p-4 rounded-card">
            {(flag.comments && flag.comments.length > 0) ? (
              flag.comments.map(comment => (
                <div 
                  key={comment.id} 
                  className={`flex flex-col p-3 rounded-lg shadow-sm ${
                    // Assuming comments from non-publishers are from the admin/review team
                    comment.user_role?.toUpperCase() !== 'PUBLISHER' 
                      ? 'bg-primary bg-opacity-10 items-start' // Admin/Reviewer on left
                      : 'bg-secondary bg-opacity-10 items-end ml-auto' // Publisher on right
                  }`}
                  style={{ maxWidth: '85%' }}
                >
                  <div className={`w-full flex ${comment.user_role?.toUpperCase() !== 'PUBLISHER' ? 'justify-start' : 'justify-end'}`}>
                    <div className={`p-3 rounded-lg ${
                      comment.user_role?.toUpperCase() !== 'PUBLISHER' 
                        ? 'bg-blue-100 text-blue-800' // Admin/Reviewer
                        : 'bg-secondary text-secondary-content' // Publisher
                    }`}>
                      <p className="text-sm">{comment.comment}</p>
                    </div>
                  </div>
                  <div className={`w-full text-xs mt-1 text-text-secondary ${
                    comment.user_role?.toUpperCase() !== 'PUBLISHER' ? 'text-left' : 'text-right'
                  }`}>
                    <span>
                      {comment.user_name || 'User'} - {formatCommentTimestamp(comment.created_at)}
                    </span>
                    {/* Delete button removed entirely for publisher view */}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-text-secondary italic text-center py-4">No communication yet.</p>
            )}
          </div>
          {user && user.role === 'PUBLISHER' && ( // Only show input if logged in user is a publisher
            <div className="mt-4">
              <textarea
                value={reviewerComment}
                onChange={(e) => setReviewerComment(e.target.value)}
                placeholder="Type your message..."
                className="input w-full mb-2"
                rows={3}
              />
              <div className="flex justify-end"> {/* Flex container to align button to the right */}
                <button
                  className="btn-primary w-full sm:w-auto"
                  onClick={handlePostReviewerComment}
                  disabled={!reviewerComment.trim()}
                >
                  Send Message
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons Section */}
        <div className="mt-6 pt-4 border-t border-neutral-light">
          {user && user.role === 'PUBLISHER' && (
            <button
              className="bg-green-600 text-white font-medium text-sm px-4 py-2 rounded hover:bg-green-700 transition-colors w-full"
              onClick={onMarkAsRemediated}
            >
              Mark as Remediated
            </button>
          )}
        </div>
        {/* Submit Verdict button removed */}
      </div>
    </div>
  );
};

export default PublisherFlagPreview;
