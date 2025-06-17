'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { ROUTES } from '@/constants/routes';
import EnhancedFlagTable from '@/components/flagReview/EnhancedFlagTable';
import EnhancedFlagPreview from '@/components/flagReview/EnhancedFlagPreview';
import FilterBar from '@/components/flagReview/FilterBar';
import ExportFlagsDialog from '@/components/flagReview/ExportFlagsDialog';
import { flagService, Flag, FlagStatus, HumanVerdict } from '@/services/flagService';
import { ruleService, ProductRuleDetail } from '@/services/ruleService';
import { scanJobService, ScanJob } from '@/services/scanJobService'; // Import scan job service
import { publisherService, Publisher } from '@/services/publisherService'; // Import publisher service
import { productService, Product } from '@/services/productService'; // Import product service

// Helper to convert possibly null values to strings
const toStr = (value: string | null | undefined): string => {
  if (value === null || value === undefined) {
    return '';
  }
  return value;
};

// Define the structure for a flag comment
interface FlagComment {
  id: string;
  flag_id: string;
  user_id: string;
  comment: string;
  created_at: string;
  user_name: string;
  user_role: string;
}

// Define flag structure for EnhancedFlagTable
interface TableFlag {
  id: string;
  content_item_id: string;
  rule_id: string;
  rule_name?: string; // Add optional rule name
  rule_type: string;
  ai_confidence: number | null | undefined;
  ai_ruling: string | null;
  ai_evaluation: string | null; // Align type: remove undefined
  ai_confidence_reasoning: string | null; // Align type: remove undefined
  status: string;
  created_at: string;
  context_text: string | null; // This is the snippet
  content_source: string | null; // e.g. 'video', 'image' from content_item.content_source
  transcript_start_ms?: number | null; // Add timestamp here for TableFlag
  reviewer_id?: string | null | undefined;
  product_id?: string | null | undefined;
  humanVerdict?: HumanVerdictUI;
  content_items: ContentItem | null | undefined;
  // Simplify the products type to match usage in adaptApiToTableFlag
  products: { name: string | null } | null | undefined; 
  users: User | null | undefined;
  // Add direct properties for easier display of related entities
  publisher?: string | null;
  scanJob?: string | null;
  product?: string | null;
  comments?: FlagComment[]; // Added for publisher communication
}

// Define flag structure for EnhancedFlagPreview
interface PreviewFlag {
  id: string; // This is the Flag's own ID
  contentItemId: string; // This is the ID of the associated content_item
  scanJob: string;
  publisher: string;
  product: string;
  rule: string; // This will now hold the rule name
  ruleId: string; // This will hold the rule ID
  date: string;
  aiConfidence: number;
  status: string;
  humanVerdict?: HumanVerdictUI;

  // New fields for enhanced content display
  platform: string; // e.g., 'youtube', 'instagram', 'tiktok' (non-nullable), already normalized to lowercase
  contentMediaType: string; // 'image', 'video', or 'unknown' (derived from content_item.content_type)
  // For IG/TT video, mediaDisplaySrc will now hold the media_id. For YouTube, it's the original URL.
  mediaDisplaySrc: string; 
  // For IG/TT image carousel, mediaItems will just contain the media_id.
  mediaItems: Array<{ id: string }>; // id here is media_id
  transcriptStartMs?: number | null; // For YouTube timestamp
  fullDescription: string | null; // Full caption from content_item.caption
  originalPlatformUrl: string | null; // URL to view original content (from content_item.url)
  contextSnippet: string | null; // Existing snippet from context_text
  ruleText: string; // From rule API or flag.content.ruleText
  aiReasoning: string | null;
  aiVerdict: string | null;
  comments?: FlagComment[]; // Added for publisher communication
}

// Use imported types instead of local definitions for Publisher, Product, ScanJob
// Adjust ContentItem if needed based on imported types
interface ContentItem {
  id: string; // Added content_item ID
  url: string | null; // Original platform URL (e.g. YouTube video link)
  caption: string | null; // Full description/caption
  title: string | null;
  transcript: any | null; // This might be different from context_text
  platform?: string | null;
  content_type?: string | null; // Corrected from content_source, used for image/video type
  content_images?: Array<{ id: string; gcs_path?: string; /* other fields */ }>; // For IG/TikTok GCS media
  publishers: { name: string | null } | null;
  scan_jobs: { name: string | null } | null;
}

// Remove local Publisher, Product, ScanJob interfaces

interface User { // Keep User if not imported
  name: string | null;
}

interface HumanVerdictUI {
  isViolation: boolean | null;
  severity: string;
  feedback: string;
  comments: string;
  timestamp: string;
}

// Use a consistent Option type
interface Option {
  id: string; // Use 'id' for consistency with FilterBar
  name: string; // Use 'name' for consistency with FilterBar
}

const ConnectedFlagReviewContent: React.FC = () => {
  const [flags, setFlags] = useState<TableFlag[]>([]);
  const [selectedFlag, setSelectedFlag] = useState<TableFlag | null>(null);
  const [filters, setFilters] = useState({
    scanJob: '', publisher: '', product: '', status: '', platform: '', dateRange: { start: '', end: '' } // Removed 'channel' property
  });
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(true); // For initial load
  const [isLoadingMore, setIsLoadingMore] = useState(false); // For subsequent page loads
  const [error, setError] = useState<string | null>(null);
  const [ruleMap, setRuleMap] = useState<Map<string, string>>(new Map()); // State for rule ID -> name map

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [pageSize, setPageSize] = useState(50); // Or your preferred page size

  // Ref for the IntersectionObserver sentinel
  const observer = useRef<IntersectionObserver | null>(null);
  const sentinelRef = useCallback((node: HTMLDivElement | null) => {
    if (isLoading || isLoadingMore) return; // Don't observe if already loading
    if (observer.current) observer.current.disconnect();
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && currentPage < totalPages) {
        loadMoreFlags();
      }
    });
    if (node) observer.current.observe(node);
  }, [isLoading, isLoadingMore, currentPage, totalPages]);
  
  // Options for filters and export
  const [scanJobOptions, setScanJobOptions] = useState<Option[]>([]);
  const [publisherOptions, setPublisherOptions] = useState<Option[]>([]);
  const [productOptions, setProductOptions] = useState<Option[]>([]);
  const [statusOptions, setStatusOptions] = useState<Option[]>([]);
  // Removed channelOptions state

  // Define static platform options
  const platformOptions: Option[] = [
    { id: 'youtube', name: 'YouTube Video' },
    { id: 'youtube_shorts', name: 'YouTube Shorts' },
    { id: 'instagram', name: 'Instagram' },
    { id: 'tiktok', name: 'TikTok' }
    // Add other platforms here if needed in the future
  ];
  // Test API connectivity to diagnose issues
  const testApiConnectivity = async () => {
    console.log('Testing API connectivity...');
    
    try {
      // Make a minimal API call - using a valid parameter from FlagFilterParams
      // Just trying to get a single flag by using a non-existent ID
      const response = await flagService.getFlags({ scanJobId: 'connectivity-test' });
      console.log('API connectivity test successful:', response);
      return { success: true, message: 'API connectivity test successful' };
    } catch (err: any) {
      console.error('API connectivity test failed:', err);
      const errorDetails = {
        message: err.message || 'Unknown error',
        status: err.response?.status,
        statusText: err.response?.statusText,
        data: err.response?.data,
      };
      console.error('Error details:', errorDetails);
      return { 
        success: false, 
        message: `API connectivity test failed: ${errorDetails.message}`,
        details: errorDetails
      };
    }
  };

  // Define loadInitialData in the component scope
  const loadInitialData = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // First test connectivity
      const connectivityTest = await testApiConnectivity();
      if (!connectivityTest.success) {
        console.warn('API connectivity test failed, but proceeding with data loading attempt');
      }
      
      const fetchedRuleMap = await fetchRules(); // Fetch rules and get the map
      // Now fetch initial flags (page 1), passing the fetched map directly
      await fetchFlags(fetchedRuleMap, 1, false); // isLoadMore = false for initial load
    } catch (err) {
       console.error("Error during initial data load:", err);
       setError('Failed to load initial data. Please check your network connection and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch rules and build the map
  const fetchRules = async () => {
    try {
      console.log('Fetching rules...');
      // Temporarily disable fetching all product and channel rules as the service methods do not exist.
      // The ruleMap will be empty, and rule names in the table will default to rule IDs.
      // This will be addressed if fetching all rule names for the table is reinstated.
      // const productRulesRes = await ruleService.getProductRules().catch((err: any) => {
      //   console.error('Error fetching product rules:', err);
      //   return { data: [] };
      // });
      
      // const channelRulesRes = await ruleService.getChannelRules().catch((err: any) => {
      //   console.error('Error fetching channel rules:', err);
      //   return { data: [] };
      // });
      
      // console.log('Rules API responses:', { 
      //   productRules: productRulesRes, 
      //   channelRules: channelRulesRes 
      // });
      
      const newRuleMap = new Map<string, string>();
      
      // // Safely process product rules
      // if (productRulesRes.data && Array.isArray(productRulesRes.data)) {
      //   productRulesRes.data.forEach((rule: ProductRuleDetail) => { // Added type for rule
      //     if (rule && rule.id && rule.name) {
      //       newRuleMap.set(rule.id, rule.name);
      //     }
      //   });
      // }
      
      // // Safely process channel rules
      // if (channelRulesRes.data && Array.isArray(channelRulesRes.data)) {
      //   channelRulesRes.data.forEach((rule: any) => { // Assuming a similar structure or type if re-enabled
      //     if (rule && rule.id && rule.name) {
      //       newRuleMap.set(rule.id, rule.name);
      //     }
      //   });
      // }
      
      console.log(`Built rule map with ${newRuleMap.size} rules (currently disabled full fetch)`);
      setRuleMap(newRuleMap); // Still set state for other potential uses
      return newRuleMap; // Return the map
    } catch (err: any) { // Added type for err
      console.error('Error in fetchRules function:', err);
      // Handle error fetching rules (e.g., show a message)
      setRuleMap(new Map()); // Ensure map is empty on error
      return new Map<string, string>(); // Return empty map on error
    }
  };

  // Fetch flags from API - now requires the ruleMap, pageNumber, and isLoadMore flag
  const fetchFlags = async (mapToUse: Map<string, string>, pageNumber: number, isLoadMore: boolean) => {
    if (isLoadMore) {
      setIsLoadingMore(true);
    } else {
      setIsLoading(true); // For initial load or filter change
      setFlags([]); // Clear flags for new filter set or initial load
      setSelectedFlag(null); // Clear selected flag
    }
    setError(null);

    try {
      console.log(`Fetching flags page ${pageNumber} with filters:`, filters);
      
      // Convert filters to API params
      const params: Record<string, any> = { page: pageNumber, pageSize };
      if (filters.scanJob) params.scanJobId = filters.scanJob;
      if (filters.publisher) params.publisherId = filters.publisher;
      if (filters.product) params.productId = filters.product;
      if (filters.status) params.status = mapUiStatusToApiStatus(filters.status);
      if (filters.platform) params.platform = filters.platform;
      if (filters.dateRange.start) params.startDate = filters.dateRange.start;
      if (filters.dateRange.end) params.endDate = filters.dateRange.end;
      
      console.log('API params:', params);
      
      const axiosResponse = await flagService.getFlags(params); // AxiosResponse
      console.log('Axios API response:', axiosResponse);
      const responseData = axiosResponse.data; // Actual data from the backend

      // Check if responseData is a valid PaginatedFlagsResponse
      if (responseData && typeof responseData === 'object' && 'data' in responseData && 'totalFlags' in responseData && 'currentPage' in responseData && 'totalPages' in responseData) {
        const paginatedResponse = responseData as import('@/services/flagService').PaginatedFlagsResponse;

        if (!Array.isArray(paginatedResponse.data)) {
          console.error('Invalid API response: paginatedResponse.data is not an array:', paginatedResponse);
          throw new Error('Invalid response from API. Expected paginatedResponse.data to be an array of flags.');
        }

        console.log(`Processing ${paginatedResponse.data.length} flags from page ${paginatedResponse.currentPage}`);
        
        const newTableFlags: TableFlag[] = paginatedResponse.data.map((apiFlag, index) => {
          try {
            return adaptApiToTableFlag(apiFlag, mapToUse);
          } catch (adaptError) {
            console.error(`Error adapting flag at index ${index}:`, adaptError, apiFlag);
            return { id: apiFlag.id || `error-flag-${index}`, content_item_id: '', rule_id: '', rule_type: 'unknown', ai_confidence: null, ai_ruling: null, ai_evaluation: null, ai_confidence_reasoning: null, status: 'Error', created_at: new Date().toISOString(), context_text: null, content_source: null, comments: [], content_items: null, products: null, users: null };
          }
        });
        
        setFlags(prevFlags => isLoadMore ? [...prevFlags, ...newTableFlags] : newTableFlags);
        setCurrentPage(paginatedResponse.currentPage);
        setTotalPages(paginatedResponse.totalPages);
        
        if (!isLoadMore && selectedFlag && !newTableFlags.find(f => f.id === selectedFlag.id)) {
          setSelectedFlag(null);
        }
      } else if (Array.isArray(responseData)) {
        // This case handles if the backend, for some reason (e.g. no pagination params sent), returns a direct array.
        console.warn('Received direct array response. FlagReviewContent expects paginated data. Processing as a single page.');
        const directFlags = responseData as import('@/services/flagService').Flag[];
        const tableFlags: TableFlag[] = directFlags.map((apiFlag, index) => {
          try { return adaptApiToTableFlag(apiFlag, mapToUse); } catch (e) { console.error(`Error adapting direct flag at index ${index}:`, e); return { id: `error-direct-${index}` } as TableFlag; }
        });
        setFlags(tableFlags);
        setCurrentPage(1);
        setTotalPages(1); 
      } else {
        console.error('Invalid API response structure:', responseData);
        throw new Error('Invalid response from API. Expected an array of flags or a paginated response object.');
      }
      setError(null);
    } catch (err: any) {
      console.error('Error fetching flags:', err);
      const errorMessage = err.response?.data?.message || err.message || 'Failed to load flags.';
      setError(errorMessage);
      if (!isLoadMore) setFlags([]); // Clear flags on error for initial load/filter
    } finally {
      if (isLoadMore) {
        setIsLoadingMore(false);
      } else {
        setIsLoading(false);
      }
    }
  };

  const loadMoreFlags = () => {
    if (currentPage < totalPages && !isLoadingMore) {
      fetchFlags(ruleMap, currentPage + 1, true);
    }
  };

  // Converts API Flag to the TableFlag format expected by EnhancedFlagTable
  // Takes the rule map as an argument again
  const adaptApiToTableFlag = (apiFlag: any, currentRuleMap: Map<string, string>): TableFlag => {
    try {
      if (!apiFlag) {
        throw new Error('API flag is null or undefined');
      }
      
      if (!apiFlag.id) {
        console.warn('Flag is missing ID:', apiFlag);
      }

      // Extract names using optional chaining for safety and add more logging for debugging
      const content_items_data = apiFlag.content_items as ContentItem || { id: '', url: null, caption: null, title: null, transcript: null, platform: 'unknown', content_source: 'unknown', content_images: [] };
      const publishers = content_items_data.publishers; // Keep as potentially null
      const scan_jobs = content_items_data.scan_jobs; // Keep as potentially null
      const products = apiFlag.products || {};
      const users = apiFlag.users || {};
      
      const publisherName = publishers?.name || null; // Use optional chaining
      const scanJobName = scan_jobs?.name || null; // Use optional chaining
      const productName = products.name || null;
      const reviewerName = users.name || null;
      
      if (!apiFlag.rule_id) {
        console.warn('Flag is missing rule_id:', apiFlag);
      }

      const ruleName = apiFlag.rule_id ? currentRuleMap.get(apiFlag.rule_id) || apiFlag.rule_id : 'Unknown Rule';
      
      return {
        id: apiFlag.id || 'unknown-id',
        content_item_id: apiFlag.content_item_id || '',
        rule_id: apiFlag.rule_id || '',
        rule_name: ruleName,
        rule_type: apiFlag.rule_type || 'unknown',
        ai_confidence: apiFlag.ai_confidence !== undefined ? apiFlag.ai_confidence : null,
        ai_ruling: apiFlag.ai_ruling || null,
        ai_evaluation: apiFlag.ai_evaluation || null, // This is AI Reasoning for PreviewFlag
        ai_confidence_reasoning: apiFlag.ai_confidence_reasoning || null,
        status: apiFlag.status ? mapApiStatusToUiStatus(apiFlag.status) : 'Unknown', 
        created_at: apiFlag.created_at || new Date().toISOString(),
        context_text: apiFlag.context_text || null, // Snippet
        content_source: content_items_data.content_type || 'unknown', // Populate TableFlag.content_source from ContentItem.content_type
        transcript_start_ms: apiFlag.transcript_start_ms !== undefined ? apiFlag.transcript_start_ms : null,
        reviewer_id: apiFlag.reviewer_id || null,
        product_id: apiFlag.product_id || null,
        humanVerdict: apiFlag.human_verdict ? {
          isViolation: apiFlag.human_verdict === HumanVerdict.VIOLATION,
          severity: 'medium', 
          feedback: apiFlag.human_verdict_reasoning || '',
          comments: apiFlag.internal_notes || '',
          timestamp: apiFlag.updated_at || new Date().toISOString(),
        } : undefined,
        publisher: publisherName,
        scanJob: scanJobName,
        product: productName,
        // Store the full content_items structure for adaptTableToPreviewFlag
        content_items: content_items_data,
        products: { name: productName },
        users: { name: reviewerName },
        comments: (apiFlag.comments || []).map((comment: any) => ({
          id: comment.id,
          flag_id: comment.flag_id,
          user_id: comment.user_id,
          comment: comment.comment,
          created_at: comment.created_at,
          user_name: comment.user?.name || 'Unknown User', // Map from comment.user.name
          user_role: comment.user?.role || 'Unknown Role', // Map from comment.user.role
        })),
      };
    } catch (error) {
      console.error('Error in adaptApiToTableFlag:', error, apiFlag);
      return {
        id: apiFlag?.id || 'error-flag',
        content_item_id: apiFlag?.content_item_id || '',
        rule_id: apiFlag?.rule_id || '',
        rule_type: apiFlag?.rule_type || 'unknown',
        ai_confidence: null,
        ai_ruling: null,
        ai_evaluation: null,
        ai_confidence_reasoning: null,
        status: 'Error',
        created_at: apiFlag?.created_at || new Date().toISOString(),
        context_text: 'Error loading snippet',
        content_source: 'error', // Add to fallback
        comments: [], // Add to fallback
        content_items: { id: '', url: null, caption: 'Error loading description', title: null, transcript: null, platform: 'error', content_type: 'error', content_images: [], publishers: null, scan_jobs: null },
        products: null,
        users: null
      };
    }
  };
  
  // Converts a TableFlag to PreviewFlag format for EnhancedFlagPreview
  const adaptTableToPreviewFlag = (tableFlag: TableFlag): PreviewFlag => {
    try {
      if (!tableFlag) {
        throw new Error('Table flag is null or undefined');
      }
      
      // const defaultDate = new Date().toISOString().split('T')[0]; // Fallback date - REMOVED DUPLICATE
      
      if (!tableFlag || !tableFlag.id) {
        console.warn('PreviewFlag: Missing flag ID or tableFlag itself is null/undefined');
        // Return a minimal error structure for PreviewFlag
        return {
          id: 'error-preview-id',
          contentItemId: '', // Add missing contentItemId
          scanJob: 'Error', publisher: 'Error', product: 'Error', rule: 'Error',
          ruleId: 'error-rule-id', // Add ruleId to this error fallback
          date: new Date().toISOString().split('T')[0], aiConfidence: 0, status: 'Error',
          platform: 'error', contentMediaType: 'error', mediaDisplaySrc: '', mediaItems: [],
          fullDescription: 'Error loading description', originalPlatformUrl: '',
          contextSnippet: 'Error loading snippet', ruleText: 'Error loading rule',
          aiReasoning: '', aiVerdict: '', comments: []
        };
      }
      
      const defaultDate = new Date().toISOString().split('T')[0];
      let aiConfidence = 0;
      if (tableFlag.ai_confidence !== null && tableFlag.ai_confidence !== undefined) {
        aiConfidence = Math.round(tableFlag.ai_confidence * 100);
      }

      const contentItem = tableFlag.content_items as ContentItem || { id: '', url: null, caption: null, platform: 'unknown', content_type: 'unknown', content_images: [] };
      
      const rawPlatform = contentItem.platform || 'unknown';
      const platformLower = rawPlatform.toLowerCase();

      let determinedContentMediaType = 'unknown';
      const rawContentType = (contentItem.content_type || '').toLowerCase();

      switch (rawContentType) {
        case 'tiktok video':
        case 'video': // Instagram video
        case 'youtube video':
        case 'youtube short':
          determinedContentMediaType = 'video';
          break;
        case 'tiktok slideshow': // Covers single and multi-image TikTok posts
        case 'image': // Instagram single image
        case 'sidecar': // Instagram carousel
          determinedContentMediaType = 'image';
          break;
        default:
          if (platformLower === 'youtube' || platformLower === 'youtube_shorts') {
              determinedContentMediaType = 'video';
          } else if (contentItem.content_images && contentItem.content_images.length > 0) {
              determinedContentMediaType = 'image';
              if(rawContentType && rawContentType !== '') console.warn(`Unknown content_type: '${rawContentType}' for ${platformLower} flag ID ${tableFlag.id}. Inferred 'image' due to presence of content_images.`);
          } else {
              if(rawContentType && rawContentType !== '') console.warn(`Unknown content_type: '${rawContentType}' for ${platformLower} flag ID ${tableFlag.id}. Setting contentMediaType to 'unknown'.`);
          }
          break;
      }
      if (determinedContentMediaType === 'unknown' && (platformLower === 'tiktok' || platformLower === 'instagram') && contentItem.content_images && contentItem.content_images.length > 0) {
          determinedContentMediaType = 'image';
      }

      let currentMediaDisplaySrc = ''; // For YouTube, this is original URL. For IG/TT video, this will be media_id.
      let currentMediaItems: Array<{ id: string }> = []; // For IG/TT images, id is media_id.

      if (platformLower === 'youtube' || platformLower === 'youtube_shorts') {
        currentMediaDisplaySrc = contentItem.url || ''; // YouTube uses direct URL for iframe
        if (!currentMediaDisplaySrc) {
          console.warn(`MISSING YouTube URL: YouTube Flag ID ${tableFlag.id} has no contentItem.url!`);
        }
      } else if (platformLower === 'instagram' || platformLower === 'tiktok') {
        if (determinedContentMediaType === 'video') {
          const primaryVideoMedia = contentItem.content_images && contentItem.content_images.length > 0 ? contentItem.content_images[0] : null;
          if (primaryVideoMedia && primaryVideoMedia.id) {
            currentMediaDisplaySrc = primaryVideoMedia.id; // Store only the media_id
          } else {
            console.warn(`Missing primary video media_id in content_images for ${platformLower} video flag ID ${tableFlag.id}`);
            currentMediaDisplaySrc = ''; // Ensure it's empty if no ID
          }
        } else if (determinedContentMediaType === 'image') {
          if (contentItem.content_images && contentItem.content_images.length > 0) {
            contentItem.content_images.forEach(img => {
              if (img.id) {
                currentMediaItems.push({ id: img.id }); // Store only media_id
              }
            });
            // No need to set currentMediaDisplaySrc here for images, as EnhancedFlagPreview will handle carousel
            if (currentMediaItems.length === 0) {
               console.warn(`No processable image media_ids found in content_images for ${platformLower} image flag ID ${tableFlag.id}`);
            }
          } else {
            console.warn(`Missing content_images array for ${platformLower} image flag ID ${tableFlag.id}`);
          }
        }
      }
      
      return {
        id: tableFlag.id, // This is the Flag's own ID
        contentItemId: tableFlag.content_item_id, // Pass the actual content_item_id
        scanJob: tableFlag.scanJob || 'Unknown Scan',
        publisher: tableFlag.publisher || 'Unknown Publisher',
        product: tableFlag.product || 'Unknown Product',
        rule: tableFlag.rule_name || 'Unknown Rule Name', // Prefer rule_name, fallback
        ruleId: tableFlag.rule_id || '', // Pass the rule_id
        date: tableFlag.created_at ? new Date(tableFlag.created_at).toISOString().split('T')[0] : defaultDate,
        aiConfidence: aiConfidence,
        status: tableFlag.status || 'Unknown',
        humanVerdict: tableFlag.humanVerdict,
        
        platform: platformLower,
        contentMediaType: determinedContentMediaType,
        mediaDisplaySrc: currentMediaDisplaySrc, // For YT: original URL; For IG/TT video: media_id
        mediaItems: currentMediaItems, // For IG/TT images: array of {id: media_id}
        transcriptStartMs: tableFlag.transcript_start_ms,
        fullDescription: contentItem.caption || null,
        originalPlatformUrl: contentItem.url || null,
        contextSnippet: tableFlag.context_text || null,
        ruleText: 'Rule description would come from rule API in production', // Placeholder
        aiReasoning: tableFlag.ai_evaluation || null,
        aiVerdict: tableFlag.ai_ruling || null,
        comments: tableFlag.comments || [] // Pass through comments
      };
    } catch (error) {
      console.error('Error in adaptTableToPreviewFlag:', error, tableFlag);
      return { 
        id: tableFlag?.id || 'error-preview',
        contentItemId: tableFlag?.content_item_id || '', // Add missing contentItemId
        scanJob: 'Error', publisher: 'Error', product: 'Error', rule: 'Error',
        ruleId: tableFlag?.rule_id || 'error-rule-id', // Add ruleId to error fallback
        date: new Date().toISOString().split('T')[0], aiConfidence: 0, status: 'Error',
        platform: 'error', contentMediaType: 'error', mediaDisplaySrc: '', mediaItems: [],
        transcriptStartMs: null, fullDescription: 'Error loading description',
        originalPlatformUrl: '', contextSnippet: 'Error loading snippet',
        ruleText: 'Error loading rule', aiReasoning: 'Error', aiVerdict: 'Error', comments: []
      };
    }
  };
  
  // Initial load: Call the component-scoped loadInitialData
  useEffect(() => {
    loadInitialData(); 
    
  // Fetch filter options from API
  const fetchFilterOptions = async () => {
    try {
      console.log('Fetching filter options...');
      
      // Start individual timing for each API call
      const scanJobStartTime = performance.now();
      
      // Fetch in sequence instead of parallel to isolate performance
      console.log('STEP 1: Fetching scans (active flags only)...');
      // Pass activeFlagsOnly: true to filter the list for the dropdown
      const scanJobsRes = await scanJobService.getScanJobs({ activeFlagsOnly: true }).catch((err: any) => {
        console.error('Error fetching scan jobs:', err);
        return { data: [] }; // Return empty array on error
      });
      
      const scanJobEndTime = performance.now();
      console.log(`PERFORMANCE: Scans API call took ${(scanJobEndTime - scanJobStartTime).toFixed(2)}ms`);
      console.log(`VOLUME: Scans API returned ${scanJobsRes.data?.length || 0} items`);
      
      // Also log data size approximation if available
      if (scanJobsRes.data && Array.isArray(scanJobsRes.data)) {
        console.log(`MEMORY: Scans data size ~${JSON.stringify(scanJobsRes.data).length / 1024} KB`);
      }
      
      // Now fetch the other options (publishers and products)
      console.log('STEP 2: Fetching publishers and products...');
      const [publishersRes, productsRes] = await Promise.all([
        publisherService.getPublishers().catch(err => {
          console.error('Error fetching publishers:', err);
          return { data: [] };
        }),
        productService.getProducts().catch(err => {
          console.error('Error fetching products:', err);
          return { data: [] };
        })
      ]);

      // Log the responses (basics only)
      console.log(`Publishers: Found ${publishersRes.data?.length || 0} items`);
      console.log(`Products: Found ${productsRes.data?.length || 0} items`);
      
      // Measure mapping performance for scan jobs
      console.log('STEP 3: Processing scans data...');
      const mapStartTime = performance.now();
      
      // Format options with more robust handling
      const scanJobOpts = scanJobsRes.data?.map((job: ScanJob) => ({ 
        id: job.id || '', 
        name: job.name || 'Unnamed Job'
      })) || [];
      
      const mapEndTime = performance.now();
      console.log(`PERFORMANCE: Scans mapping took ${(mapEndTime - mapStartTime).toFixed(2)}ms`);
      
      const publisherOpts = publishersRes.data?.map(pub => ({ 
        id: pub.id || '', 
        name: pub.name || 'Unnamed Publisher'
      })) || [];
      
      const productOpts = productsRes.data?.map(prod => ({ 
        id: prod.id || '', 
        name: prod.name || 'Unnamed Product'
      })) || [];

      console.log('Formatted options:', {
        scanJobOpts,
        publisherOpts,
        productOpts
      });

      setScanJobOptions(scanJobOpts);
      setPublisherOptions(publisherOpts);
      setProductOptions(productOpts);

      // Create static status options from FlagStatus enum
      const statusOpts = Object.values(FlagStatus).map(statusValue => ({
        id: mapApiStatusToUiStatus(statusValue), // Use the UI string as the ID/value
        name: mapApiStatusToUiStatus(statusValue) // And as the display name
      }));
      console.log('Status options:', statusOpts);
      setStatusOptions(statusOpts);

      } catch (err) {
        console.error('Error fetching filter options:', err);
        setError(prev => prev ? `${prev}\nFailed to load filter options.` : 'Failed to load filter options.');
        // Set empty options on error to prevent crashes
        setScanJobOptions([]);
        setPublisherOptions([]);
        setProductOptions([]);
        setStatusOptions([]);
      }
    };
    
    fetchFilterOptions(); // Call the function to fetch options
    // Removed fetchFlags from here as it's now called by loadInitialData
  }, []); // Run only once on mount

  // Refetch flags (page 1) when filters change, passing the current ruleMap state
  useEffect(() => {
    // Only avoid running during initial load
    if (!isLoading) { 
      const refetch = async () => {
        setCurrentPage(1); // Reset to page 1 on filter change
        setTotalPages(0); // Reset total pages
        await fetchFlags(ruleMap, 1, false); // Fetch page 1, not loading more
      };
      refetch();
    }
  }, [filters, ruleMap]); // Rerun if filters or ruleMap changes (ruleMap needed for fetchFlags)

  const handleSelectFlag = (flagId: string) => {
    const flag = flags.find(f => f.id === flagId);
    setSelectedFlag(flag || null);
  };

  const handleFilterChange = (newFilters: any) => {
    console.log('Filter changed:', newFilters);
    setFilters(newFilters);
  };

  const handleStatusChange = async (flagId: string, newStatus: string) => {
    try {
      // Find the flag
      const flagToUpdate = flags.find(f => f.id === flagId);
      if (!flagToUpdate) return;
      
      // Convert UI status to API status
      const apiStatus = mapUiStatusToApiStatus(newStatus);
      
      // Call API to update status
      await flagService.updateFlag(flagId, { status: apiStatus });
      
      // Update local state - explicitly casting as TableFlag[] to avoid type issues
      const updatedFlags: TableFlag[] = flags.map(flag => {
        if (flag.id === flagId) {
          return { ...flag, status: newStatus };
        }
        return flag;
      });
      
      setFlags(updatedFlags);
      
      // Update selected flag if it was the one that changed
      if (selectedFlag && selectedFlag.id === flagId) {
        setSelectedFlag({ ...selectedFlag, status: newStatus });
      }
    } catch (err: any) {
      console.error(`Error updating flag ${flagId} status:`, err);
      // Show error (could use a toast/notification system here)
      alert(err.response?.data?.message || 'Failed to update flag status');
    }
  };

  const handleVerdictSubmit = async (verdict: HumanVerdictUI) => {
    if (!selectedFlag) return;
    
    try {
      // Convert UI verdict to API verdict
      const apiVerdict = {
        human_verdict: verdict.isViolation === true ? HumanVerdict.VIOLATION : 
                        verdict.isViolation === false ? HumanVerdict.COMPLIANT : 
                        null,
        human_verdict_reasoning: verdict.feedback,
        internal_notes: verdict.comments,
        // Set status based on verdict
        status: verdict.isViolation ? FlagStatus.REMEDIATING : FlagStatus.CLOSED
      };
      
      // Call API to update flag
      await flagService.updateFlag(selectedFlag.id, apiVerdict);
      
      // Set UI status based on verdict
      const newStatus = verdict.isViolation ? 'Pending Remediation' : 'Closed';
      
      // Update local state - explicitly casting as TableFlag[] to avoid type issues
      const updatedFlags: TableFlag[] = flags.map(flag => {
        if (flag.id === selectedFlag.id) {
          return { 
            ...flag, 
            status: newStatus,
            humanVerdict: verdict
          };
        }
        return flag;
      });
      
      setFlags(updatedFlags);
      
      // Find next flag to review
      const currentIndex = updatedFlags.findIndex(f => f.id === selectedFlag.id);
      const nextUnreviewedFlag = updatedFlags.find((f, index) => 
        index > currentIndex && (f.status === 'New' || f.status === 'In Review')
      ) || updatedFlags.find(f => f.status === 'New' || f.status === 'In Review');
      
      if (nextUnreviewedFlag) {
        setSelectedFlag(nextUnreviewedFlag);
      } else {
        // If no more unreviewed flags, stay on current flag with updated state
        const updatedCurrentFlag = updatedFlags.find(f => f.id === selectedFlag.id);
        setSelectedFlag(updatedCurrentFlag || null);
      }
    } catch (err: any) {
      console.error(`Error submitting verdict for flag ${selectedFlag.id}:`, err);
      // Show error (could use a toast/notification system here)
      alert(err.response?.data?.message || 'Failed to submit verdict');
    }
  };
  
  // Helper to map API status to UI status
  const mapApiStatusToUiStatus = (apiStatus: FlagStatus): string => {
    // Map API status enum to UI-friendly strings
    switch (apiStatus) {
      case FlagStatus.NEW: return 'New';
      case FlagStatus.IN_REVIEW: return 'In Review';
      case FlagStatus.REMEDIATING: return 'Pending Remediation';
      case FlagStatus.CLOSED: return 'Closed';
      default: return 'Unknown';
    }
  };
  
  // Helper to map UI status to API status
  const mapUiStatusToApiStatus = (uiStatus: string): FlagStatus => {
    // Map UI-friendly strings to API status enum
    switch (uiStatus) {
      case 'New': return FlagStatus.NEW;
      case 'In Review': return FlagStatus.IN_REVIEW;
      case 'Pending Remediation': return FlagStatus.REMEDIATING;
      case 'Closed': return FlagStatus.CLOSED;
      default: return FlagStatus.NEW; // Default to NEW
    }
  };
  
  // Handle export action
  const handleExport = async (options: any) => {
    try {
      // Convert options to API params
      const params: Record<string, any> = {};
      if (options.scanJob) params.scanJobId = options.scanJob;
      if (options.publisher) params.publisherId = options.publisher;
      if (options.status) params.status = mapUiStatusToApiStatus(options.status);
      if (options.dateRange && options.dateRange.start) params.startDate = options.dateRange.start;
      if (options.dateRange && options.dateRange.end) params.endDate = options.dateRange.end;
      
      // Call API to get CSV blob
      const response = await flagService.exportFlags(params);
      
      // Create download link
      const url = URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `flags-export-${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      
      // Trigger download
      link.click();
      
      // Clean up
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      // Show success message
      setExportSuccess(true);
      setTimeout(() => setExportSuccess(false), 3000);
      
      // Close dialog
      setShowExportDialog(false);
    } catch (err: any) {
      console.error('Error exporting flags:', err);
      // Show error (could use a toast/notification system here)
      alert(err.response?.data?.message || 'Failed to export flags');
    }
  };
  
  // Remove the duplicate helper functions below

  // Function to refresh selected flag data, typically after a comment is added
  const refreshSelectedFlagData = async () => {
    if (!selectedFlag) return;
    try {
      setIsLoading(true); // Or a more specific loading state for the preview
      // Use the existing flagService.getFlag which should now return comments
      const updatedFlagResponse = await flagService.getFlag(selectedFlag.id);
      const updatedApiFlag = updatedFlagResponse.data;

      // Adapt the updated API flag to TableFlag format first
      const adaptedForTable = adaptApiToTableFlag(updatedApiFlag, ruleMap);
      
      // Update the main flags array
      setFlags(prevFlags => prevFlags.map(f => f.id === selectedFlag.id ? adaptedForTable : f));
      
      // Update the selectedFlag state (which is of type TableFlag)
      setSelectedFlag(adaptedForTable);

    } catch (error) {
      console.error("Failed to refresh flag data after comment:", error);
      // Optionally, show a toast or user notification for the error
      setError(prev => prev ? `${prev}\nFailed to refresh flag details.` : 'Failed to refresh flag details.');
    } finally {
      setIsLoading(false); // Reset general loading state or specific preview loading state
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center">
          <Link href={ROUTES.DASHBOARD}>
            <button 
              type="button"
              className="btn-secondary mr-4 flex items-center"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
              </svg>
              Back to Dashboard
            </button>
          </Link>
          <h1>Flag Review</h1>
        </div>
        <div className="flex space-x-2">
          {/* Success toast message */}
          {exportSuccess && (
            <div className="bg-success bg-opacity-10 text-success px-3 py-2 rounded-md flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              Export successful!
            </div>
          )}
          
          <button 
            className="btn-primary flex items-center"
            onClick={() => setShowExportDialog(true)}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
            Export Flags to CSV
          </button>
          <button 
            className="btn-secondary flex items-center"
            onClick={loadInitialData} // Corrected: Call loadInitialData
          >
            <svg className="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        </div>
      </div>

      <FilterBar 
        filters={filters} 
        onFilterChange={handleFilterChange} 
        scanJobOptions={scanJobOptions}
        publisherOptions={publisherOptions}
        productOptions={productOptions}
        statusOptions={statusOptions}
        platformOptions={platformOptions} // Pass static platform options
      />

      {isLoading && flags.length === 0 ? (
        <div className="flex justify-center items-center p-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      ) : error ? (
        <div className="bg-error bg-opacity-10 text-error p-4 rounded-md">
          <p>{error}</p>
          <button 
            className="mt-2 btn-tertiary"
            onClick={() => loadInitialData()} 
          >
            Try Again
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Flag Table Column */}
          <div className="lg:col-span-1">
            <div className="card p-0 overflow-hidden"> 
              <EnhancedFlagTable
                flags={flags}
                selectedFlagId={selectedFlag?.id || null}
                onSelectFlag={handleSelectFlag}
                onStatusChange={handleStatusChange}
              />
              {/* Sentinel for IntersectionObserver */}
              {flags.length > 0 && currentPage < totalPages && (
                <div ref={sentinelRef} style={{ height: '1px', marginTop: '10px' }}>
                  {isLoadingMore && (
                    <div className="flex justify-center items-center p-4">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    </div>
                  )}
                </div>
              )}
               {flags.length > 0 && currentPage >= totalPages && !isLoadingMore && (
                <div className="p-4 text-center text-text-secondary">All flags loaded.</div>
              )}
              {flags.length === 0 && !isLoading && (
                 <div className="p-4 text-center text-text-secondary">No flags found.</div>
              )}
            </div>
          </div>
          {/* Flag Preview Column */}
          <div className="lg:col-span-1">
            <div className="card h-full"> {/* Ensure card takes height */}
              {selectedFlag ? (
                <EnhancedFlagPreview
                  key={selectedFlag.id} // Force re-render on selection change
                  flag={adaptTableToPreviewFlag(selectedFlag)}
                  onVerdictSubmit={handleVerdictSubmit}
                  onCommentAdded={refreshSelectedFlagData} // Pass the refresh function
                />
              ) : (
                <div className="flex items-center justify-center h-full text-text-secondary"> {/* Center placeholder */}
                  <p>Select a flag from the list to review</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      
      {/* Export Dialog */}
      <ExportFlagsDialog
        isOpen={showExportDialog}
        onClose={() => setShowExportDialog(false)}
        onExport={handleExport}
        // Map options to the { value, label } format expected by ExportFlagsDialog
        scanJobs={scanJobOptions.map(opt => ({ value: opt.id, label: opt.name }))}
        publishers={publisherOptions.map(opt => ({ value: opt.id, label: opt.name }))}
      />
    </div>
  );
};

export default ConnectedFlagReviewContent;
