import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { restoreSession } from '../store/authSlice';
import { LoginForm } from './LoginForm';
import { SignupForm } from './SignupForm';
import type { AppDispatch, RootState } from '../store';

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const dispatch = useDispatch<AppDispatch>();
  const { isAuthenticated, isLoading } = useSelector((state: RootState) => state.auth);
  const [showSignup, setShowSignup] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    // Try to restore session from localStorage on mount
    const initAuth = async () => {
      try {
        await dispatch(restoreSession()).unwrap();
      } catch (error) {
        // Session restoration failed, user needs to login
        console.log('No valid session found');
      } finally {
        setIsInitializing(false);
      }
    };

    initAuth();
  }, [dispatch]);

  // Show loading spinner during initialization
  if (isInitializing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // If authenticated, render the main app
  if (isAuthenticated) {
    return <>{children}</>;
  }

  // Otherwise, show login or signup form
  if (showSignup) {
    return <SignupForm onSwitchToLogin={() => setShowSignup(false)} />;
  }

  return <LoginForm onSwitchToSignup={() => setShowSignup(true)} />;
};
