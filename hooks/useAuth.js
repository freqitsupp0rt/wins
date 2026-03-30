"use client";

import { useState, useEffect, createContext, useContext, useCallback } from 'react';
import { useRouter } from 'next/navigation';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tokenExpiryCheck, setTokenExpiryCheck] = useState(null);
  const router = useRouter();

  const refreshSession = useCallback(async (refreshToken) => {
    try {
      console.log('Attempting to refresh session...');
      
      const response = await fetch('/api/auth/extend-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken }),
      });

      const data = await response.json();

      if (data.success) {
        console.log('Session refreshed successfully');
        localStorage.setItem('token', data.data.token);
        localStorage.setItem('refreshToken', data.data.refreshToken);
        setUser(data.data.user);
        return { 
          success: true, 
          token: data.data.token,
          refreshToken: data.data.refreshToken,
          user: data.data.user
        };
      } else {
        console.log('Session refresh failed:', data.message);
        return { success: false, message: data.message };
      }
    } catch (error) {
      console.error('Failed to refresh session:', error);
      return { success: false, message: 'Failed to refresh session' };
    }
  }, []);

  const checkTokenStatus = useCallback((token) => {
    if (!token) return { isValid: false };
    
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const expiresAt = payload.exp * 1000;
      const now = Date.now();
      const timeLeft = expiresAt - now;
      
      return {
        isValid: timeLeft > 0,
        expiresAt,
        timeLeft,
        isAboutToExpire: timeLeft < 30 * 60 * 1000, // 30 minutes
        isExpired: timeLeft <= 0
      };
    } catch (error) {
      return { isValid: false, error };
    }
  }, []);

  const checkAuth = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const refreshToken = localStorage.getItem('refreshToken');
      
      if (!token || !refreshToken) {
        console.log('No tokens found in storage');
        setUser(null);
        setLoading(false);
        return;
      }

      // Check token status
      const tokenStatus = checkTokenStatus(token);
      
      // If token is expired or about to expire, try to refresh
      if (tokenStatus.isExpired || tokenStatus.isAboutToExpire) {
        console.log('Token needs refresh:', {
          isExpired: tokenStatus.isExpired,
          isAboutToExpire: tokenStatus.isAboutToExpire,
          timeLeft: Math.round(tokenStatus.timeLeft / 1000 / 60)
        });
        
        const refreshed = await refreshSession(refreshToken);
        if (!refreshed.success) {
          // Refresh failed, clear storage
          console.log('Token refresh failed, logging out');
          localStorage.removeItem('token');
          localStorage.removeItem('refreshToken');
          setUser(null);
          setLoading(false);
          return;
        }
        
        // Use the new token for the API call
        const newToken = refreshed.token || localStorage.getItem('token');
        await fetchUserData(newToken);
      } else {
        // Token is still valid, fetch user data
        await fetchUserData(token);
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, [checkTokenStatus, refreshSession]);

  const fetchUserData = async (token) => {
    try {
      const response = await fetch('/api/auth/me', {
        headers: {
          'Authorization': `Bearer ${token}`
        },
        cache: 'no-store'
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setUser(data.data.user);
          console.log('User authenticated:', data.data.user.username);
        } else {
          console.log('API returned success: false');
          handleAuthFailure();
        }
      } else {
        console.log('API response not OK:', response.status);
        handleAuthFailure();
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
      handleAuthFailure();
    }
  };

  const handleAuthFailure = () => {
    // Try one more time with refresh token before giving up
    const refreshToken = localStorage.getItem('refreshToken');
    if (refreshToken) {
      refreshSession(refreshToken).then((result) => {
        if (!result.success) {
          localStorage.removeItem('token');
          localStorage.removeItem('refreshToken');
          setUser(null);
        }
      });
    } else {
      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
      setUser(null);
    }
  };

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // Auto-refresh token logic
  useEffect(() => {
    if (!user) return;

    const checkAndRefreshToken = () => {
      const token = localStorage.getItem('token');
      const refreshToken = localStorage.getItem('refreshToken');
      
      if (!token || !refreshToken) return;

      const tokenStatus = checkTokenStatus(token);
      
      // Refresh if token expires in less than 15 minutes
      if (tokenStatus.isValid && tokenStatus.isAboutToExpire) {
        console.log('Auto-refreshing token...');
        refreshSession(refreshToken);
      }
    };

    // Check every 5 minutes
    const interval = setInterval(checkAndRefreshToken, 5 * 60 * 1000);
    
    // Also check immediately on mount
    checkAndRefreshToken();

    return () => clearInterval(interval);
  }, [user, checkTokenStatus, refreshSession]);

  const login = async (username, password) => {
    try {
      setLoading(true);
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (data.success) {
        localStorage.setItem('token', data.data.token);
        localStorage.setItem('refreshToken', data.data.refreshToken);
        setUser(data.data.user);
        return { success: true, user: data.data.user };
      } else {
        return { success: false, message: data.message };
      }
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, message: 'Login failed' };
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      // Clear local storage first
      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
      setUser(null);
      
      // Then call logout API (non-blocking)
      fetch('/api/auth/logout', { method: 'POST' }).catch(console.error);
      
      // Redirect to login
      router.push('/login');
    } catch (error) {
      console.error('Logout error:', error);
      // Still clear local storage even if API call fails
      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
      setUser(null);
      router.push('/login');
    }
  };

  const checkTokenExpiry = () => {
    const token = localStorage.getItem('token');
    return checkTokenStatus(token);
  };

  const extendSession = async () => {
    const refreshToken = localStorage.getItem('refreshToken');
    if (!refreshToken) {
      return { success: false, message: 'No refresh token available' };
    }
    
    return await refreshSession(refreshToken);
  };

  const value = {
    user,
    loading,
    login,
    logout,
    isAuthenticated: !!user,
    checkTokenExpiry,
    extendSession,
    refreshSession,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};