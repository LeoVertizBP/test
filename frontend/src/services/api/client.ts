import axios from 'axios';

// Create base API client
const apiClient = axios.create({
  // Base URL should be updated based on your environment
  baseURL: `${process.env.NEXT_PUBLIC_API_URL}/api`, // Dynamically set from env var
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // Handle common errors here
    console.error('API Error:', error);
    return Promise.reject(error);
  }
);

// Add request interceptor for auth token, cache busting, and detailed logging
apiClient.interceptors.request.use(
  (config) => {
    // Get token from localStorage or a secure storage mechanism
    const token = localStorage.getItem('authToken');
    
    // If token exists, add it to the headers
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    // Add cache-busting parameter to GET requests
    if (config.method?.toLowerCase() === 'get') {
      config.params = {
        ...config.params,
        _t: new Date().getTime() // Add timestamp to prevent caching
      };
    }
    
    // Log detailed request information
    console.log(`API Request: ${config.method?.toUpperCase()} ${config.url}`, {
      headers: config.headers,
      params: config.params,
      data: config.data,
      timestamp: new Date().toISOString()
    });
    
    return config;
  },
  (error) => {
    console.error('API Request Error:', error);
    return Promise.reject(error);
  }
);

// Add response interceptor for detailed logging
apiClient.interceptors.response.use(
  (response) => {
    console.log(`API Response: ${response.status} ${response.config.method?.toUpperCase()} ${response.config.url}`, {
      data: response.data,
      headers: response.headers,
      timestamp: new Date().toISOString()
    });
    return response;
  },
  (error) => {
    console.error('API Response Error:', {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data,
      url: error.config?.url,
      method: error.config?.method?.toUpperCase(),
      timestamp: new Date().toISOString()
    });
    return Promise.reject(error);
  }
);

export default apiClient;
