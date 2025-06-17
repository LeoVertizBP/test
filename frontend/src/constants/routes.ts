/**
 * Route Constants
 * 
 * This file contains constants for all routes used in the application.
 * Using these constants instead of hardcoded strings helps with maintainability
 * and reduces the risk of errors from typos.
 */

export const ROUTES = {
  // Main navigation
  DASHBOARD: '/dashboard',
  FLAG_REVIEW: '/flag-review',
  MANAGEMENT: '/management',
  REPORTS: '/reports',
  
  // Connected routes (using real API data)
  DASHBOARD_CONNECTED: '/dashboard/connected',
  FLAG_REVIEW_CONNECTED: '/flag-review/connected',
  MANAGEMENT_CONNECTED: '/management/connected',
  
  // Management sub-routes
  MANAGEMENT_RULE_SET: '/management/ruleset',
  
  // Flag review sub-routes
  FLAG_DETAIL: '/flag-review/detail',
  
  // Other routes
  LOGIN: '/login',
  SETTINGS: '/settings',
  
  // Fragment identifiers (anchors)
  FRAGMENT_OVERVIEW: '#overview',
};

export default ROUTES;
