import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';

export interface AuthUser {
  id: number;
  username: string;
  email?: string | null;
  displayName?: string | null;
}

export interface AuthSession {
  token: string;
  expiresAt: number;
}

interface AuthState {
  user: AuthUser | null;
  session: AuthSession | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

const initialState: AuthState = {
  user: null,
  session: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
};

// Async thunks
export const signup = createAsyncThunk(
  'auth/signup',
  async (
    { username, password, email, displayName }: {
      username: string;
      password: string;
      email?: string;
      displayName?: string;
    },
    { rejectWithValue }
  ) => {
    try {
      const response = await window.electronAPI.authSignup(username, password, email, displayName);
      if (!response.success || !response.data) {
        return rejectWithValue(response.error || 'Signup failed');
      }
      // Store session token in localStorage
      localStorage.setItem('sessionToken', response.data.session.token);
      return response.data;
    } catch (error) {
      return rejectWithValue('Network error during signup');
    }
  }
);

export const login = createAsyncThunk(
  'auth/login',
  async (
    { username, password }: { username: string; password: string },
    { rejectWithValue }
  ) => {
    try {
      const response = await window.electronAPI.authLogin(username, password);
      if (!response.success || !response.data) {
        return rejectWithValue(response.error || 'Login failed');
      }
      // Store session token in localStorage
      localStorage.setItem('sessionToken', response.data.session.token);
      return response.data;
    } catch (error) {
      return rejectWithValue('Network error during login');
    }
  }
);

export const logout = createAsyncThunk(
  'auth/logout',
  async (_, { getState, rejectWithValue }) => {
    try {
      const state = getState() as { auth: AuthState };
      const token = state.auth.session?.token;

      if (token) {
        await window.electronAPI.authLogout(token);
        localStorage.removeItem('sessionToken');
      }

      return null;
    } catch (error) {
      return rejectWithValue('Logout failed');
    }
  }
);

export const validateSession = createAsyncThunk(
  'auth/validateSession',
  async (token: string, { rejectWithValue }) => {
    try {
      const response = await window.electronAPI.authValidateSession(token);
      if (!response.success || !response.data) {
        localStorage.removeItem('sessionToken');
        return rejectWithValue(response.error || 'Session validation failed');
      }
      return response.data;
    } catch (error) {
      localStorage.removeItem('sessionToken');
      return rejectWithValue('Network error during session validation');
    }
  }
);

export const restoreSession = createAsyncThunk(
  'auth/restoreSession',
  async (_, { dispatch }) => {
    const token = localStorage.getItem('sessionToken');
    if (!token) {
      throw new Error('No session token found');
    }
    return dispatch(validateSession(token));
  }
);

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    clearAuth: (state) => {
      state.user = null;
      state.session = null;
      state.isAuthenticated = false;
      state.error = null;
      localStorage.removeItem('sessionToken');
    },
  },
  extraReducers: (builder) => {
    // Signup
    builder.addCase(signup.pending, (state) => {
      state.isLoading = true;
      state.error = null;
    });
    builder.addCase(signup.fulfilled, (state, action) => {
      state.isLoading = false;
      state.user = action.payload.user;
      state.session = action.payload.session;
      state.isAuthenticated = true;
      state.error = null;
    });
    builder.addCase(signup.rejected, (state, action) => {
      state.isLoading = false;
      state.error = action.payload as string;
    });

    // Login
    builder.addCase(login.pending, (state) => {
      state.isLoading = true;
      state.error = null;
    });
    builder.addCase(login.fulfilled, (state, action) => {
      state.isLoading = false;
      state.user = action.payload.user;
      state.session = action.payload.session;
      state.isAuthenticated = true;
      state.error = null;
    });
    builder.addCase(login.rejected, (state, action) => {
      state.isLoading = false;
      state.error = action.payload as string;
    });

    // Logout
    builder.addCase(logout.fulfilled, (state) => {
      state.user = null;
      state.session = null;
      state.isAuthenticated = false;
      state.error = null;
    });

    // Validate Session
    builder.addCase(validateSession.pending, (state) => {
      state.isLoading = true;
    });
    builder.addCase(validateSession.fulfilled, (state, action) => {
      state.isLoading = false;
      state.user = action.payload.user;
      state.session = action.payload.session;
      state.isAuthenticated = true;
      state.error = null;
    });
    builder.addCase(validateSession.rejected, (state) => {
      state.isLoading = false;
      state.user = null;
      state.session = null;
      state.isAuthenticated = false;
    });
  },
});

export const { clearError, clearAuth } = authSlice.actions;
export default authSlice.reducer;
