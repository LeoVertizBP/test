'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ROUTES } from '@/constants/routes';
import PublisherManagement from '@/components/management/PublisherManagement';
import ProductManagement from '@/components/management/ProductManagement';
import RuleManagement from '@/components/management/RuleManagement';
import RuleSetManagement from '@/components/management/RuleSetManagement';
import UserManagement from '@/components/management/UserManagement';
import AdvertiserManagement from '@/components/management/AdvertiserManagement';
import publisherService from '@/services/publisherService';
import advertiserService from '@/services/advertiserService';
import productService from '@/services/productService';
import ruleService from '@/services/ruleService';
import userService from '@/services/userService';

enum ManagementView {
  Overview = 'overview',
  Publishers = 'publishers',
  Advertisers = 'advertisers',
  Products = 'products',
  RuleSets = 'ruleSets',
  Rules = 'rules',
  Users = 'users',
  Settings = 'settings'
}

interface CountsData {
  publisherCount: number;
  advertiserCount: number;
  productCount: number;
  ruleSetCount: number;
  ruleCount: number;
  userCount: number;
  loading: boolean;
  error: string | null;
}

const ConnectedManagementContent: React.FC = () => {
  const [currentView, setCurrentView] = useState<ManagementView>(ManagementView.Overview);
  const [countsData, setCountsData] = useState<CountsData>({
    publisherCount: 0,
    advertiserCount: 0,
    productCount: 0,
    ruleSetCount: 0,
    ruleCount: 0,
    userCount: 0,
    loading: true,
    error: null
  });
  const router = useRouter();

  // Fetch all counts for the overview page
  useEffect(() => {
    if (currentView === ManagementView.Overview) {
      const fetchCounts = async () => {
        try {
          // Start with loading state
          setCountsData(prev => ({ ...prev, loading: true, error: null }));

          // Fetch all counts in parallel
          const [
            publisherResponse,
            advertiserResponse,
            productResponse,
            ruleSetResponse,
            productRulesResponse,
            channelRulesResponse,
            userResponse
          ] = await Promise.allSettled([
            publisherService.getPublishers(),
            advertiserService.getAdvertisers(),
            productService.getProducts(),
            ruleService.getRuleSets(),
            ruleService.getProductRules(),
            ruleService.getChannelRules(),
            userService.getAllUsers()
          ]);

          // Process responses
          const counts: Partial<CountsData> = {
            loading: false,
            error: null
          };

          if (publisherResponse.status === 'fulfilled') {
            counts.publisherCount = publisherResponse.value.data.length;
          }

          if (advertiserResponse.status === 'fulfilled') {
            counts.advertiserCount = advertiserResponse.value.data.length;
          }

          if (productResponse.status === 'fulfilled') {
            counts.productCount = productResponse.value.data.length;
          }

          if (ruleSetResponse.status === 'fulfilled') {
            counts.ruleSetCount = ruleSetResponse.value.data.length;
          }

          // Combine product and channel rules counts
          let ruleCount = 0;
          if (productRulesResponse.status === 'fulfilled') {
            ruleCount += productRulesResponse.value.data.length;
          }
          if (channelRulesResponse.status === 'fulfilled') {
            ruleCount += channelRulesResponse.value.data.length;
          }
          counts.ruleCount = ruleCount;

          if (userResponse.status === 'fulfilled') {
            counts.userCount = userResponse.value.data.length;
          }

          setCountsData(prev => ({ ...prev, ...counts }));
        } catch (error) {
          console.error("Error fetching management counts:", error);
          setCountsData(prev => ({
            ...prev,
            loading: false,
            error: "Failed to load management data. Please try again later."
          }));
        }
      };

      fetchCounts();
    }
  }, [currentView]);

  // Publisher management handlers
  const handleAddPublisher = () => {
    // The modal is directly handled in the PublisherManagement component
  };
  
  const handleEditPublisher = (id: string) => {
    console.log(`Editing publisher ${id}`);
  };
  
  // Advertiser management handlers
  const handleAddAdvertiser = () => {
    // The modal is directly handled in the AdvertiserManagement component
  };
  
  const handleEditAdvertiser = (id: string) => {
    console.log(`Editing advertiser ${id}`);
  };
  
  // Product management handlers
  const handleAddProduct = () => {
    // The modal is directly handled in the ProductManagement component
  };
  
  const handleEditProduct = (id: string) => {
    console.log(`Editing product ${id}`);
  };
  
  const handleViewProductFlags = (id: string) => {
    console.log(`Viewing flags for product ${id}`);
    // In a real implementation, navigate to flag review with filter
    // router.push(`${ROUTES.FLAG_REVIEW}?product=${id}`);
  };
  
  // Rule management handlers
  const handleAddRule = () => {
    // The modal is directly handled in the RuleManagement component
  };
  
  const handleEditRule = (id: string) => {
    console.log(`Editing rule ${id}`);
  };
  
  const handleViewRuleViolations = (id: string) => {
    console.log(`Viewing violations for rule ${id}`);
    // In a real implementation, navigate to flag review with filter
    // router.push(`${ROUTES.FLAG_REVIEW}?rule=${id}`);
  };

  // Rule set management handlers
  const handleAddRuleSet = () => {
    // The modal is directly handled in the RuleSetManagement component
  };
  
  const handleEditRuleSet = (id: string) => {
    console.log(`Editing rule set ${id}`);
  };
  
  const handleViewRuleSetDetails = (id: string) => {
    console.log(`Viewing details for rule set ${id}`);
    router.push(`${ROUTES.MANAGEMENT_RULE_SET}/${id}`);
  };
  
  const navigateToView = (view: ManagementView) => {
    setCurrentView(view);
  };
  
  // User management handlers
  const handleAddUser = () => {
    // The modal is directly handled in the UserManagement component
  };
  
  const handleEditUser = (id: string) => {
    console.log(`Editing user ${id}`);
  };
  
  // Render the current view
  const renderView = () => {
    switch (currentView) {
      case ManagementView.Publishers:
        return (
          <PublisherManagement 
            onAddPublisher={handleAddPublisher}
            onEditPublisher={handleEditPublisher}
          />
        );
      case ManagementView.Advertisers:
        return (
          <AdvertiserManagement 
            onAddAdvertiser={handleAddAdvertiser}
            onEditAdvertiser={handleEditAdvertiser}
          />
        );
      case ManagementView.Products:
        return (
          <ProductManagement 
            onAddProduct={handleAddProduct}
            onEditProduct={handleEditProduct}
            onViewProductFlags={handleViewProductFlags}
          />
        );
      case ManagementView.RuleSets:
        return (
          <RuleSetManagement
            onAddRuleSet={handleAddRuleSet}
            onEditRuleSet={handleEditRuleSet}
            onViewRuleSetDetails={handleViewRuleSetDetails}
          />
        );
      case ManagementView.Rules:
        return (
          <RuleManagement
            onAddRule={handleAddRule}
            onEditRule={handleEditRule}
            onViewRuleViolations={handleViewRuleViolations}
          />
        );
      case ManagementView.Users:
        return (
          <UserManagement
            onAddUser={handleAddUser}
            onEditUser={handleEditUser}
          />
        );
      case ManagementView.Overview:
      default:
        return renderOverview();
    }
  };
  
  // Render the overview cards
  const renderOverview = () => {
    if (countsData.loading) {
      return <div className="text-center py-12">Loading management data...</div>;
    }

    if (countsData.error) {
      return (
        <div className="alert alert-error">
          <p>{countsData.error}</p>
          <button 
            className="btn-primary mt-4"
            onClick={() => setCurrentView(ManagementView.Overview)} // This will trigger a re-fetch
          >
            Try Again
          </button>
        </div>
      );
    }

    return (
      <>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="card card-hover">
            <h2 className="mb-4">Publishers</h2>
            <p className="text-text-secondary mb-6">Manage publishers and their associated products</p>
            <div className="flex justify-between items-center">
              <span className="text-secondary font-semibold">{countsData.publisherCount} Publishers</span>
              <button 
                className="btn-secondary"
                onClick={() => setCurrentView(ManagementView.Publishers)}
              >
                View Publishers
              </button>
            </div>
          </div>
          
          <div className="card card-hover">
            <h2 className="mb-4">Advertisers</h2>
            <p className="text-text-secondary mb-6">Manage advertisers and their products</p>
            <div className="flex justify-between items-center">
              <span className="text-secondary font-semibold">{countsData.advertiserCount} Advertisers</span>
              <button 
                className="btn-secondary"
                onClick={() => setCurrentView(ManagementView.Advertisers)}
              >
                View Advertisers
              </button>
            </div>
          </div>
          
          <div className="card card-hover">
            <h2 className="mb-4">Products</h2>
            <p className="text-text-secondary mb-6">Manage products and their compliance rules</p>
            <div className="flex justify-between items-center">
              <span className="text-secondary font-semibold">{countsData.productCount} Products</span>
              <button 
                className="btn-secondary"
                onClick={() => setCurrentView(ManagementView.Products)}
              >
                View Products
              </button>
            </div>
          </div>
          
          <div className="card card-hover">
            <h2 className="mb-4">Rule Sets</h2>
            <p className="text-text-secondary mb-6">Configure and manage compliance rule sets for detection</p>
            <div className="flex justify-between items-center">
              <span className="text-secondary font-semibold">{countsData.ruleSetCount} Rule Sets</span>
              <button 
                className="btn-secondary"
                onClick={() => navigateToView(ManagementView.RuleSets)}
              >
                View Rule Sets
              </button>
            </div>
          </div>
          
          <div className="card card-hover">
            <h2 className="mb-4">Rules</h2>
            <p className="text-text-secondary mb-6">Define and configure individual compliance rules</p>
            <div className="flex justify-between items-center">
              <span className="text-secondary font-semibold">{countsData.ruleCount} Rules</span>
              <button 
                className="btn-secondary"
                onClick={() => navigateToView(ManagementView.Rules)}
              >
                View Rules
              </button>
            </div>
          </div>
          
          <div className="card card-hover">
            <h2 className="mb-4">Users</h2>
            <p className="text-text-secondary mb-6">Manage user accounts and permissions</p>
            <div className="flex justify-between items-center">
              <span className="text-secondary font-semibold">{countsData.userCount} Users</span>
              <button 
                className="btn-secondary"
                onClick={() => navigateToView(ManagementView.Users)}
              >
                View Users
              </button>
            </div>
          </div>
        </div>
        
        <div className="card card-hover">
          <h2 className="mb-4">System Settings</h2>
          <div className="space-y-4">
            <div className="flex justify-between items-center p-3 bg-background rounded-input">
              <div>
                <h3 className="text-text-primary">AI Detection Sensitivity</h3>
                <p className="text-sm text-text-secondary">Configure the sensitivity of AI-powered compliance detection</p>
              </div>
              <button 
                className="btn-tertiary"
                onClick={() => setCurrentView(ManagementView.Settings)}
              >
                Configure
              </button>
            </div>
            
            <div className="flex justify-between items-center p-3 bg-background rounded-input">
              <div>
                <h3 className="text-text-primary">Notification Settings</h3>
                <p className="text-sm text-text-secondary">Configure email and in-app notification preferences</p>
              </div>
              <button className="btn-tertiary">Configure</button>
            </div>
            
            <div className="flex justify-between items-center p-3 bg-background rounded-input">
              <div>
                <h3 className="text-text-primary">API Integrations</h3>
                <p className="text-sm text-text-secondary">Manage connections to external systems and APIs</p>
              </div>
              <button className="btn-tertiary">Configure</button>
            </div>
          </div>
        </div>
      </>
    );
  };
  
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1>Management</h1>
        
        {/* Show back button when not on overview */}
        {currentView !== ManagementView.Overview && (
          <button 
            className="btn-secondary"
            onClick={() => navigateToView(ManagementView.Overview)}
          >
            Back to Overview
          </button>
        )}
      </div>
      
      {renderView()}
    </div>
  );
};

export default ConnectedManagementContent;
