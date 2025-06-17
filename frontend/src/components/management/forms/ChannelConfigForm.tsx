'use client';

import React, { useState, useEffect, FormEvent } from 'react';
import configService, { ChannelConfigData, TestCrawlResult } from '@/services/configService';

interface ChannelConfigFormProps {
  publisherId: string;
  channelId: string;
  onSuccess?: (action: 'create' | 'update' | 'delete') => void;
  onError?: (error: any) => void;
}

/**
 * Form for configuring website channel crawl settings.
 */
const ChannelConfigForm: React.FC<ChannelConfigFormProps> = ({
  publisherId,
  channelId,
  onSuccess,
  onError
}) => {
  // Form state
  const [formState, setFormState] = useState<ChannelConfigData>({
    name: '',
    sitemapUrl: '',
    loginCredentials: undefined,
    includeDomains: [],
    excludePatterns: [],
    maxPages: null,
    maxDepth: null,
    imageMaxBytes: null,
    heroImageSelector: '', // Added
    articleContentSelector: '' // Added
  });

  // New domain and pattern inputs for array fields
  const [newDomain, setNewDomain] = useState('');
  const [newPattern, setNewPattern] = useState('');

  // Loading and error states
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasConfig, setHasConfig] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Test crawl states
  const [isTestCrawling, setIsTestCrawling] = useState(false);
  const [testCrawlResult, setTestCrawlResult] = useState<TestCrawlResult | null>(null);
  const [testCrawlError, setTestCrawlError] = useState<string | null>(null);

  // Fetch existing configuration if it exists
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        console.log('ChannelConfigForm: Attempting to fetch config with:', {
          publisherId,
          channelId,
          publisherIdType: typeof publisherId,
          channelIdType: typeof channelId
        });
        
        const { exists, data } = await configService.hasConfig(publisherId, channelId);
        
        if (exists && data) {
          setFormState({
            name: data.name,
            sitemapUrl: data.sitemapUrl || '',
            // Note: We don't receive actual login credentials, just a flag if they exist
            loginCredentials: data.loginSecretId ? { username: '', password: '' } : undefined,
            includeDomains: data.includeDomains || [],
            excludePatterns: data.excludePatterns || [],
            maxPages: data.maxPages || null,
            maxDepth: data.maxDepth || null,
            imageMaxBytes: data.imageMaxBytes || null,
            heroImageSelector: data.heroImageSelector || '', // Populate from fetched data
            articleContentSelector: data.articleContentSelector || '' // Populate from fetched data
          });
          setHasConfig(true);
        } else {
          // Initialize with empty form
          setHasConfig(false);
        }
      } catch (err) {
        console.error('Error fetching channel config:', err);
        setError('Failed to load configuration. Please try again.');
        if (onError) onError(err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchConfig();
  }, [publisherId, channelId, onError]);

  // Handle input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    
    // Handle numeric inputs
    if (type === 'number') {
      setFormState(prev => ({
        ...prev,
        [name]: value ? parseInt(value, 10) : null
      }));
      return;
    }
    
    setFormState(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Handle login credential changes
  const handleCredentialChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    
    setFormState(prev => ({
      ...prev,
      loginCredentials: {
        ...(prev.loginCredentials || { username: '', password: '' }),
        [name === 'username' ? 'username' : 'password']: value
      }
    }));
  };

  // Handle array field additions
  const handleAddDomain = () => {
    if (!newDomain.trim()) return;
    
    setFormState(prev => ({
      ...prev,
      includeDomains: [...prev.includeDomains, newDomain.trim()]
    }));
    setNewDomain('');
  };

  const handleAddPattern = () => {
    if (!newPattern.trim()) return;
    
    setFormState(prev => ({
      ...prev,
      excludePatterns: [...(prev.excludePatterns || []), newPattern.trim()]
    }));
    setNewPattern('');
  };

  // Handle array field removals
  const handleRemoveDomain = (index: number) => {
    setFormState(prev => ({
      ...prev,
      includeDomains: prev.includeDomains.filter((_, i) => i !== index)
    }));
  };

  const handleRemovePattern = (index: number) => {
    setFormState(prev => ({
      ...prev,
      excludePatterns: (prev.excludePatterns || []).filter((_, i) => i !== index)
    }));
  };

  // Handle form submission
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSaving(true);
    
    try {
      // Validate form
      if (!formState.name) {
        setError('Name is required');
        setIsSaving(false);
        return;
      }
      
      if (formState.includeDomains.length === 0) {
        setError('At least one domain must be included');
        setIsSaving(false);
        return;
      }
      
      // Handle URL validation for sitemapUrl if provided
      if (formState.sitemapUrl && !formState.sitemapUrl.match(/^https?:\/\/.+/)) {
        setError('Sitemap URL must be a valid URL starting with http:// or https://');
        setIsSaving(false);
        return;
      }
      
      // Prepare the data - only include loginCredentials if both username and password are provided
      const submitData: ChannelConfigData = {
        ...formState,
        loginCredentials: 
          formState.loginCredentials && 
          typeof formState.loginCredentials === 'object' && 
          'username' in formState.loginCredentials && 
          'password' in formState.loginCredentials && 
          formState.loginCredentials.username && 
          formState.loginCredentials.password
            ? formState.loginCredentials
            : null // Use null to explicitly clear credentials, undefined to leave unchanged
      };
      
      if (hasConfig) {
        // Update existing config
        await configService.updateConfig(publisherId, channelId, submitData);
        if (onSuccess) onSuccess('update');
      } else {
        // Create new config
        await configService.createConfig(publisherId, channelId, submitData);
        setHasConfig(true);
        if (onSuccess) onSuccess('create');
      }
    } catch (err) {
      console.error('Error saving configuration:', err);
      setError('Failed to save configuration. Please try again.');
      if (onError) onError(err);
    } finally {
      setIsSaving(false);
    }
  };

  // Handle configuration deletion
  const handleDelete = async () => {
    if (!hasConfig) return;
    
    if (!confirm('Are you sure you want to delete this configuration?')) {
      return;
    }
    
    setIsSaving(true);
    
    try {
      await configService.deleteConfig(publisherId, channelId);
      setFormState({
        name: '',
        sitemapUrl: '',
        loginCredentials: undefined,
        includeDomains: [],
        excludePatterns: [],
        maxPages: null,
        maxDepth: null,
        imageMaxBytes: null,
        heroImageSelector: '', // Reset field
        articleContentSelector: '' // Reset field
      });
      setHasConfig(false);
      if (onSuccess) onSuccess('delete');
    } catch (err) {
      console.error('Error deleting configuration:', err);
      setError('Failed to delete configuration. Please try again.');
      if (onError) onError(err);
    } finally {
      setIsSaving(false);
    }
  };

  // Handle test crawl
  const handleTestCrawl = async () => {
    setTestCrawlError(null);
    setTestCrawlResult(null);
    setIsTestCrawling(true);
    
    try {
      // We only run test crawl on existing configs, so if it's a new one, save it first
      if (!hasConfig) {
        await handleSubmit({ preventDefault: () => {} } as FormEvent);
      }
      
      // If we still don't have a config (maybe save failed) or we're in the middle of saving, abort
      if (!hasConfig || isSaving) {
        setTestCrawlError('Please save the configuration before running a test crawl.');
        setIsTestCrawling(false);
        return;
      }
      
      const response = await configService.runTestCrawl(publisherId, channelId);
      setTestCrawlResult(response.data);
    } catch (err) {
      console.error('Error running test crawl:', err);
      setTestCrawlError('Failed to run test crawl. Please try again.');
    } finally {
      setIsTestCrawling(false);
    }
  };

  if (isLoading) {
    return <div className="text-center py-4">Loading configuration...</div>;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Error Message */}
      {error && (
        <div className="p-3 bg-error bg-opacity-10 text-error rounded-md">
          {error}
        </div>
      )}
      
      {/* Basic Information */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium">Basic Information</h3>
        
        <div className="form-group">
          <label htmlFor="name" className="form-label">
            Configuration Name <span className="text-error">*</span>
          </label>
          <input
            type="text"
            id="name"
            name="name"
            className="input w-full"
            value={formState.name}
            onChange={handleInputChange}
            required
            placeholder="My Website Crawl Config"
          />
          <small className="text-text-secondary">
            A descriptive name for this configuration
          </small>
        </div>
        
        <div className="form-group">
          <label htmlFor="sitemapUrl" className="form-label">
            Sitemap URL
          </label>
          <input
            type="url"
            id="sitemapUrl"
            name="sitemapUrl"
            className="input w-full"
            value={formState.sitemapUrl}
            onChange={handleInputChange}
            placeholder="https://example.com/sitemap.xml"
          />
          <small className="text-text-secondary">
            URL to the website's sitemap.xml file (if available)
          </small>
        </div>
      </div>
      
      {/* Login Credentials Section */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium">Login Credentials (Optional)</h3>
        <p className="text-sm text-text-secondary">
          {hasConfig && formState.loginCredentials ? 
            "Credentials are stored securely. Enter new values only if you want to update them." :
            "Enter credentials if the website requires login to access content."
          }
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="form-group">
            <label htmlFor="username" className="form-label">
              Username
            </label>
            <input
              type="text"
              id="username"
              name="username"
              className="input w-full"
              value={formState.loginCredentials?.username || ''}
              onChange={handleCredentialChange}
              placeholder="username"
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="password" className="form-label">
              Password
            </label>
            <input
              type="password"
              id="password"
              name="password"
              className="input w-full"
              value={formState.loginCredentials?.password || ''}
              onChange={handleCredentialChange}
              placeholder="••••••••"
            />
          </div>
        </div>
      </div>
      
      {/* Domain Restrictions */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium">Domain Restrictions</h3>
        
        {/* Include Domains */}
        <div className="form-group">
          <label className="form-label">
            Include Domains <span className="text-error">*</span>
          </label>
          <div className="flex">
            <input
              type="text"
              className="input flex-grow"
              value={newDomain}
              onChange={(e) => setNewDomain(e.target.value)}
              placeholder="example.com"
            />
            <button
              type="button"
              className="btn-secondary ml-2"
              onClick={handleAddDomain}
            >
              Add
            </button>
          </div>
          <small className="text-text-secondary">
            List of domains the crawler is allowed to visit
          </small>
          
          {/* Domain list */}
          <div className="mt-2 space-y-2">
            {formState.includeDomains.length === 0 ? (
              <p className="text-sm text-text-secondary italic">
                No domains added yet. Add at least one domain.
              </p>
            ) : (
              formState.includeDomains.map((domain, index) => (
                <div key={index} className="flex items-center bg-background p-2 rounded-md">
                  <span className="flex-grow">{domain}</span>
                  <button
                    type="button"
                    className="text-error"
                    onClick={() => handleRemoveDomain(index)}
                    title="Remove domain"
                  >
                    &times;
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
        
        {/* Exclude Patterns */}
        <div className="form-group">
          <label className="form-label">
            Exclude Patterns
          </label>
          <div className="flex">
            <input
              type="text"
              className="input flex-grow"
              value={newPattern}
              onChange={(e) => setNewPattern(e.target.value)}
              placeholder="/admin/* or */logout"
            />
            <button
              type="button"
              className="btn-secondary ml-2"
              onClick={handleAddPattern}
            >
              Add
            </button>
          </div>
          <small className="text-text-secondary">
            URL patterns to exclude from crawling
          </small>
          
          {/* Pattern list */}
          <div className="mt-2 space-y-2">
            {!formState.excludePatterns?.length ? (
              <p className="text-sm text-text-secondary italic">
                No exclusion patterns added.
              </p>
            ) : (
              formState.excludePatterns.map((pattern, index) => (
                <div key={index} className="flex items-center bg-background p-2 rounded-md">
                  <span className="flex-grow">{pattern}</span>
                  <button
                    type="button"
                    className="text-error"
                    onClick={() => handleRemovePattern(index)}
                    title="Remove pattern"
                  >
                    &times;
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
      
      {/* Crawl Limits */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium">Crawl Limits</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="form-group">
            <label htmlFor="maxPages" className="form-label">
              Max Pages
            </label>
            <input
              type="number"
              id="maxPages"
              name="maxPages"
              className="input w-full"
              value={formState.maxPages === null ? '' : formState.maxPages}
              onChange={handleInputChange}
              min="1"
              placeholder="500"
            />
            <small className="text-text-secondary">
              Maximum number of pages to crawl
            </small>
          </div>
          
          <div className="form-group">
            <label htmlFor="maxDepth" className="form-label">
              Max Depth
            </label>
            <input
              type="number"
              id="maxDepth"
              name="maxDepth"
              className="input w-full"
              value={formState.maxDepth === null ? '' : formState.maxDepth}
              onChange={handleInputChange}
              min="0"
              placeholder="3"
            />
            <small className="text-text-secondary">
              Maximum click distance from start page
            </small>
          </div>
          
          <div className="form-group">
            <label htmlFor="imageMaxBytes" className="form-label">
              Image Max Size (bytes)
            </label>
            <input
              type="number"
              id="imageMaxBytes"
              name="imageMaxBytes"
              className="input w-full"
              value={formState.imageMaxBytes === null ? '' : formState.imageMaxBytes}
              onChange={handleInputChange}
              min="1"
              placeholder="5242880"
            />
            <small className="text-text-secondary">
              Maximum image file size to download (default: 5MB = 5242880)
            </small>
          </div>
        </div>
      </div>

      {/* Image Selectors (New Section) */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium">Image Selectors (Optional)</h3>
        <p className="text-sm text-text-secondary">
          Use CSS selectors to target specific images (e.g., hero image, images within article content). Leave blank to skip image extraction from page content.
        </p>
        <div className="form-group">
          <label htmlFor="heroImageSelector" className="form-label">
            Hero Image Selector
          </label>
          <input
            type="text"
            id="heroImageSelector"
            name="heroImageSelector"
            className="input w-full font-mono text-sm"
            value={formState.heroImageSelector || ''}
            onChange={handleInputChange}
            placeholder=".article-hero img, #main-image"
          />
          <small className="text-text-secondary">
            CSS selector to identify the main hero image(s).
          </small>
        </div>
        <div className="form-group">
          <label htmlFor="articleContentSelector" className="form-label">
            Article Content Selector
          </label>
          <input
            type="text"
            id="articleContentSelector"
            name="articleContentSelector"
            className="input w-full font-mono text-sm"
            value={formState.articleContentSelector || ''}
            onChange={handleInputChange}
            placeholder=".article-body, #content-main"
          />
          <small className="text-text-secondary">
            CSS selector for the container holding the main article text and its images. Images within this container will be extracted.
          </small>
        </div>
      </div>
      
      {/* Test Crawl Section */}
      <div className="space-y-4 pt-4 border-t border-gray-200">
        <h3 className="text-lg font-medium">Test Crawl</h3>
        <p className="text-sm text-text-secondary">
          Run a test crawl to estimate the number of pages and images that will be captured.
        </p>
        
        <div className="flex justify-between items-center">
          <button
            type="button"
            className="btn-secondary"
            onClick={handleTestCrawl}
            disabled={isTestCrawling || isSaving || (!hasConfig && !formState.name)}
          >
            {isTestCrawling ? 'Running Test...' : 'Run Test Crawl'}
          </button>
          
          {testCrawlError && (
            <p className="text-error">{testCrawlError}</p>
          )}
        </div>
        
        {/* Test Crawl Result */}
        {testCrawlResult && (
          <div className="bg-success bg-opacity-10 p-4 rounded-md">
            <h4 className="font-medium text-success mb-2">Test Results</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-text-secondary">Estimated Pages</p>
                <p className="text-2xl font-bold">{testCrawlResult.estimatedPages}</p>
              </div>
              <div>
                <p className="text-sm text-text-secondary">Estimated Images</p>
                <p className="text-2xl font-bold">{testCrawlResult.estimatedImages}</p>
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* Form Actions */}
      <div className="flex justify-between pt-4 border-t border-gray-200">
        {hasConfig ? (
          <button
            type="button"
            className="btn-error"
            onClick={handleDelete}
            disabled={isSaving}
          >
            Delete Configuration
          </button>
        ) : (
          <div></div> // Empty div to maintain flex spacing
        )}
        
        <div className="flex space-x-2">
          <button
            type="submit"
            className="btn-primary"
            disabled={isSaving}
          >
            {isSaving ? 'Saving...' : (hasConfig ? 'Update Configuration' : 'Create Configuration')}
          </button>
        </div>
      </div>
    </form>
  );
};

export default ChannelConfigForm;
