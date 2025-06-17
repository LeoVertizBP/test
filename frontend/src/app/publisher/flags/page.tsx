'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../services/auth/AuthContext';
import apiClient from '../../../services/api/client';
import PublisherFlagPreview from '../../../components/publisher/PublisherFlagPreview'; // Import the new component
import BaseModal from '../../../components/common/BaseModal'; // Assuming a BaseModal component exists

// Interface for comments (can be shared)
interface FlagComment {
  id: string;
  flag_id: string;
  user_id: string;
  comment: string;
  created_at: string;
  user_name: string;
  user_role: string;
}

// Interface for the summary flag data from the initial list
interface FlagSummary {
  id: string;
  description: string; // May map to contextSnippet or part of fullDescription
  status: string;
  created_at: string;
  rule_name: string; // Will be a summary or default
  // rule_violation_text is removed from summary
  content_url: string; 
  publisher_name: string; 
  product_name: string; 
  screenshot_url?: string; 
  // comments: FlagComment[]; // Comments removed from summary view
}

// Interface expected by PublisherFlagPreview (copied from PublisherFlagPreview.tsx for now)
// This will be the structure of `detailedFlagData`
interface PreviewFlagFromParent {
  id: string;
  contentItemId: string;
  ruleId: string;
  scanJob: string;
  publisher: string;
  product: string;
  rule: string;
  date: string;
  aiConfidence: number;
  status: string;
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
  aiVerdict: string | null;
  comments?: FlagComment[];
}


export default function PublisherFlagsPage() {
  const [flags, setFlags] = useState<FlagSummary[]>([]); // Use FlagSummary for the list
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // State for detailed flag view
  const [selectedFlagId, setSelectedFlagId] = useState<string | null>(null);
  const [detailedFlagData, setDetailedFlagData] = useState<PreviewFlagFromParent | null>(null);
  const [isDetailedLoading, setIsDetailedLoading] = useState(false);
  const [detailedError, setDetailedError] = useState<string | null>(null);

  // newComment state and handleAddCommentToList are removed as comments are no longer directly on the list items.

  const { token, user } = useAuth();
  const router = useRouter();

  console.log('[PublisherFlagsPage Render] selectedFlagId:', selectedFlagId, 'Token exists:', !!token, 'User:', user);

  // Helper function to transform raw API flag data to PreviewFlagFromParent
  const transformRawFlagDataToPreview = (rawData: any): PreviewFlagFromParent => {
    const platformLower = (rawData.content_items?.platform || 'unknown').toLowerCase();
    let determinedContentMediaType = 'unknown';
    const rawApiContentType = (rawData.content_items?.content_type || '').toLowerCase();

    switch (rawApiContentType) {
      case 'tiktok video':
      case 'video':
      case 'youtube video':
      case 'youtube short':
        determinedContentMediaType = 'video';
        break;
      case 'tiktok slideshow':
      case 'image':
      case 'sidecar':
        determinedContentMediaType = 'image';
        break;
      default:
        if (platformLower === 'youtube' || platformLower === 'youtube_shorts') {
            determinedContentMediaType = 'video';
        } else if (rawData.content_items?.content_images && rawData.content_items.content_images.length > 0) {
            determinedContentMediaType = 'image';
        }
        break;
    }
    if (determinedContentMediaType === 'unknown' && 
        (platformLower === 'tiktok' || platformLower === 'instagram') && 
        rawData.content_items?.content_images && rawData.content_items.content_images.length > 0) {
        determinedContentMediaType = 'image';
    }
    
    let currentMediaDisplaySrc = '';
    let currentMediaItems: Array<{ id: string }> = [];

    if (platformLower === 'youtube' || platformLower === 'youtube_shorts') {
      currentMediaDisplaySrc = rawData.content_items?.url || '';
    } else if (platformLower === 'instagram' || platformLower === 'tiktok') {
      if (rawData.content_items?.content_images && rawData.content_items.content_images.length > 0) {
        if (determinedContentMediaType === 'video') {
          const firstImage = rawData.content_items.content_images[0];
          if (firstImage && firstImage.id) {
            currentMediaDisplaySrc = firstImage.id; 
          } else {
            console.warn(`Missing id in content_images[0] for video flag ${rawData.id}`);
            currentMediaDisplaySrc = '';
          }
        } else if (determinedContentMediaType === 'image') {
          rawData.content_items.content_images.forEach((img: { id?: string; file_path?: string; image_type?: string }) => {
            if (img.id) {
                currentMediaItems.push({ id: img.id });
            } else {
                console.warn(`Missing id for an image in content_images for flag ${rawData.id}`);
            }
          });
        }
      } else {
        console.warn(`No content_images found for ${platformLower} flag ${rawData.id}, though mediaType is ${determinedContentMediaType}`);
      }
    }

    return {
      id: rawData.id,
      contentItemId: rawData.content_item_id,
      ruleId: rawData.rule_id,
      scanJob: rawData.scan_job_id || rawData.scanJob?.name || 'N/A',
      publisher: rawData.content_items?.publishers?.name || 'Unknown Publisher',
      product: rawData.products?.name || 'Unknown Product',
      rule: rawData.rules?.name || "Loading rule name...", 
      date: rawData.created_at,
      aiConfidence: parseFloat(rawData.ai_confidence) || 0,
      status: rawData.status,
      platform: platformLower,
      contentMediaType: determinedContentMediaType,
      mediaDisplaySrc: currentMediaDisplaySrc,
      mediaItems: currentMediaItems,
      transcriptStartMs: rawData.transcript_start_ms,
      fullDescription: rawData.content_items?.caption || null,
      originalPlatformUrl: rawData.content_items?.url || null,
      contextSnippet: rawData.context_text || null,
      ruleText: rawData.rules?.manual_text || rawData.rules?.description || "Loading rule description...",
      aiReasoning: rawData.ai_evaluation || rawData.ai_confidence_reasoning || null,
      aiVerdict: rawData.ai_ruling || null,
      comments: (rawData.comments || []).map((apiComment: any) => ({
        id: apiComment.id,
        flag_id: apiComment.flag_id,
        user_id: apiComment.user_id,
        comment: apiComment.comment,
        created_at: apiComment.created_at,
        user_name: apiComment.user?.name || 'Unknown User', // Map from nested user object
        user_role: apiComment.user?.role || 'UNKNOWN_ROLE'  // Map from nested user object
      })),
    };
  };

  // Security check
  useEffect(() => {
    if (!token) {
      router.push('/publisher/login');
      return;
    }
    
    if (user && user.role !== 'PUBLISHER') {
      alert('You do not have access to the publisher portal.');
      router.push('/login');
    }
  }, [token, user, router]);

  // Fetch flags
  useEffect(() => {
    if (!token || !user || user.role !== 'PUBLISHER') return;

    const fetchFlagsList = async () => {
      setIsLoading(true);
      setError(null);
      try {
        if (!user.publisherId) {
          setError('Publisher ID not found. Please contact support.');
          setIsLoading(false);
          return;
        }
        const response = await apiClient.get('/publishers/flags?status=REMEDIATING');
        setFlags(response.data);
      } catch (err: any) {
        setError(err.response?.data?.message || 'Failed to load flags list.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchFlagsList();
  }, [token, user]);

  // Effect to fetch detailed flag data when a flag is selected
  useEffect(() => {
    console.log('[Effect fetchDetailedFlag] Running. SelectedFlagId:', selectedFlagId, 'Token exists:', !!token);
    if (!selectedFlagId || !token) {
      console.log('[Effect fetchDetailedFlag] Condition not met, clearing detailed data.');
      setDetailedFlagData(null); // Clear previous data if no flag is selected
      return;
    }

    const fetchDetailedFlag = async () => {
      console.log(`[Effect fetchDetailedFlag] Fetching details for flag ID: ${selectedFlagId}`);
      setIsDetailedLoading(true);
      setDetailedError(null);
      try {
        // IMPORTANT: Assuming an endpoint like /api/flags/:id for detailed data
        const response = await apiClient.get(`/flags/${selectedFlagId}`); 
        console.log('[Effect fetchDetailedFlag] API Response RAW:', response.data);

        const rawData = response.data;
        const transformedData = transformRawFlagDataToPreview(rawData);
        console.log('[Effect fetchDetailedFlag] Transformed Data:', transformedData);
        setDetailedFlagData(transformedData);
      } catch (err: any) {
        console.error('[Effect fetchDetailedFlag] Error fetching detailed flag data:', err);
        setDetailedError(err.response?.data?.message || `Failed to load details for flag ${selectedFlagId}.`);
        setDetailedFlagData(null); // Clear data on error
      } finally {
        setIsDetailedLoading(false);
        console.log('[Effect fetchDetailedFlag] Fetch attempt finished.');
      }
    };

    fetchDetailedFlag();
  }, [selectedFlagId, token]);


  const handleOpenFlagDetails = (flagId: string) => {
    console.log(`[handleOpenFlagDetails] Clicked. Setting selectedFlagId to: ${flagId}`);
    setSelectedFlagId(flagId);
  };

  const handleCloseFlagDetails = () => {
    setSelectedFlagId(null);
    setDetailedFlagData(null); // Clear data when closing
  };

  // This function will be passed to PublisherFlagPreview
  // It needs to refresh the detailedFlagData and potentially the main flags list
  const handleCommentAddedInPreview = async () => {
    if (!selectedFlagId) return;
    // Re-fetch detailed flag data
    setIsDetailedLoading(true);
    try {
      const response = await apiClient.get(`/flags/${selectedFlagId}`);
      const transformedData = transformRawFlagDataToPreview(response.data);
      setDetailedFlagData(transformedData);
      
      // Optionally, update the comments in the main flags list as well
      // This requires finding the flag in the `flags` array and updating its comments
      // For simplicity, this example focuses on updating the preview.
      // A more robust solution would update the main list item too.
      // Update the main flags list to reflect comment changes if necessary,
      // or simply re-fetch the specific flag for the modal.
      // For now, the detailedFlagData is updated, which re-renders the modal.
      // If comments were shown in the main list and needed live update, that logic would go here.
      // Since we are removing comments from the main list, this specific update to `flags` might not be needed for comments.
      // However, if other flag details (like status) could change and need reflection, consider a full list refresh or targeted update.
    } catch (err) {
      console.error('Error re-fetching detailed flag data after comment:', err);
      // Handle error (e.g., show a toast)
    } finally {
      setIsDetailedLoading(false);
    }
  };
  
  // Simplified handleAddComment for the main list (if still needed)
  // Consider if all commenting should go through the detailed preview.
  // const handleAddCommentToList = async (flagId: string) => { ... } // Removed


  const markAsRemediated = async (flagId: string) => {
    try {
      await apiClient.patch(
        `/publishers/flags/${flagId}/status`,
        { status: 'REMEDIATION_COMPLETE' }
      );

      // Update the flags list to remove this flag
      setFlags(flags.filter(f => f.id !== flagId));
      if (selectedFlagId === flagId) { // If the remediated flag was the one in detailed view
        handleCloseFlagDetails();
      }
    } catch (err: any) {
      console.error('Error updating flag status:', err);
      alert(err.response?.data?.message || 'Failed to update flag status');
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-xl">Loading flags...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-red-500 text-xl">{error}</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6 text-indigo-700">Flags Requiring Remediation</h1>
      
      {flags.length === 0 && !isLoading ? (
        <div className="bg-white rounded-lg shadow p-6 text-center">
          <p className="text-lg text-gray-600">No flags currently need remediation. Great job!</p>
        </div>
      ) : (
        <div className="space-y-6">
          {flags.map(flag => (
            <div key={flag.id} className="bg-white rounded-lg shadow p-6">
              <div className="flex justify-between items-start">
                <div className="flex-grow">
                  <h2 
                    className="text-xl font-semibold mb-2 hover:text-indigo-600 cursor-pointer"
                    onClick={() => handleOpenFlagDetails(flag.id)}
                  >
                    {flag.rule_name} {/* This will show "Violation Detected" or citation/section */}
                  </h2>
                  {/* rule_violation_text display removed from here */}
                  <p className="text-gray-600 mb-2">
                    <span className="font-medium">URL:</span>{' '}
                    <a href={flag.content_url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">
                      {flag.content_url}
                    </a>
                  </p>
                  <p className="text-gray-700 mb-1 text-sm">Product: {flag.product_name}</p> {/* Display product name */}
                  <p className="text-gray-700 mb-4 text-sm">Context: {flag.description}</p> {/* Display flag context, removed truncate */}
                  
                  {/* Simplified screenshot display, full media in preview */}
                  {flag.screenshot_url && (
                    <div className="mb-4">
                      <img 
                        src={flag.screenshot_url} 
                        alt="Content screenshot" 
                        className="rounded border border-gray-200 max-w-xs cursor-pointer"
                        onClick={() => handleOpenFlagDetails(flag.id)}
                      />
                    </div>
                  )}
                </div>
                <div className="ml-4 flex-shrink-0">
                  <button
                    onClick={() => markAsRemediated(flag.id)}
                    className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 transition-colors mb-2 w-full text-sm"
                  >
                    Mark Remediated
                  </button>
                  <button
                    onClick={() => handleOpenFlagDetails(flag.id)}
                    className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition-colors w-full text-sm"
                  >
                    View Details
                  </button>
                </div>
              </div>
              
              {/* Comments Section REMOVED from main list view */}
            </div>
          ))}
        </div>
      )}

      {/* Modal for Detailed Flag Preview */}
      {selectedFlagId && detailedFlagData && (
        <BaseModal isOpen={!!selectedFlagId && !!detailedFlagData} onClose={handleCloseFlagDetails} title="Flag Details"> 
          <PublisherFlagPreview 
            flag={detailedFlagData} 
            onCommentAdded={handleCommentAddedInPreview}
            onMarkAsRemediated={() => markAsRemediated(selectedFlagId)} // Pass the function
          />
        </BaseModal>
      )}
      {selectedFlagId && isDetailedLoading && (
         <BaseModal isOpen={true} onClose={handleCloseFlagDetails} title="Loading Flag Details...">
            <div className="p-6 text-center">Loading details...</div>
         </BaseModal>
      )}
      {selectedFlagId && detailedError && !isDetailedLoading && (
         <BaseModal isOpen={true} onClose={handleCloseFlagDetails} title="Error">
            <div className="p-6 text-center text-red-500">{detailedError}</div>
         </BaseModal>
      )}

    </div>
  );
}
