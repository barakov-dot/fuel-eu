'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  fetchAuthMe,
  logoutAccount,
} from '@/lib/api/auth';
import { fetchFavorites } from '@/lib/api/favorites';
import { ApiError } from '@/lib/api/types';
import type {
  AuthMeResponse,
  UserPreferences,
} from '@/lib/api/types';

type AuthState =
  | { status: 'loading' }
  | { status: 'anonymous' }
  | {
      status: 'authenticated';
      user: AuthMeResponse['user'];
      preferences: UserPreferences;
      favoriteStationIds: Set<string>;
    };

type AuthContextValue = {
  state: AuthState;
  refresh: () => Promise<void>;
  setAuthenticated: (response: AuthMeResponse) => void;
  logout: () => Promise<void>;
  isFavorite: (stationId: string) => boolean;
  toggleFavorite: (stationId: string) => Promise<boolean>;
  refreshFavorites: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading' });

  const refresh = useCallback(async () => {
    try {
      const response = await fetchAuthMe();
      let favoriteStationIds = new Set<string>();
      try {
        const favorites = await fetchFavorites();
        favoriteStationIds = new Set(favorites.items.map((item) => item.id));
      } catch {
        // Favorites are optional during initial auth load.
      }
      setState({
        status: 'authenticated',
        user: response.user,
        preferences: response.preferences,
        favoriteStationIds,
      });
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        setState({ status: 'anonymous' });
        return;
      }
      setState({ status: 'anonymous' });
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetchAuthMe();
        let favoriteStationIds = new Set<string>();
        try {
          const favorites = await fetchFavorites();
          favoriteStationIds = new Set(favorites.items.map((item) => item.id));
        } catch {
          // Favorites are optional during initial auth load.
        }
        if (!cancelled) {
          setState({
            status: 'authenticated',
            user: response.user,
            preferences: response.preferences,
            favoriteStationIds,
          });
        }
      } catch (error) {
        if (!cancelled) {
          if (error instanceof ApiError && error.status === 401) {
            setState({ status: 'anonymous' });
            return;
          }
          setState({ status: 'anonymous' });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  const setAuthenticated = useCallback((response: AuthMeResponse) => {
    setState({
      status: 'authenticated',
      user: response.user,
      preferences: response.preferences,
      favoriteStationIds: new Set(),
    });
    void fetchFavorites()
      .then((favorites) => {
        setState((current) =>
          current.status === 'authenticated'
            ? {
                ...current,
                favoriteStationIds: new Set(
                  favorites.items.map((item) => item.id),
                ),
              }
            : current,
        );
      })
      .catch(() => undefined);
  }, []);

  const logout = useCallback(async () => {
    await logoutAccount();
    setState({ status: 'anonymous' });
  }, []);

  const refreshFavorites = useCallback(async () => {
    if (state.status !== 'authenticated') {
      return;
    }
    const favorites = await fetchFavorites();
    setState((current) =>
      current.status === 'authenticated'
        ? {
            ...current,
            favoriteStationIds: new Set(favorites.items.map((item) => item.id)),
          }
        : current,
    );
  }, [state.status]);

  const isFavorite = useCallback(
    (stationId: string) =>
      state.status === 'authenticated'
        ? state.favoriteStationIds.has(stationId)
        : false,
    [state],
  );

  const toggleFavorite = useCallback(
    async (stationId: string) => {
      if (state.status !== 'authenticated') {
        return false;
      }
      const { addFavorite, removeFavorite } = await import('@/lib/api/favorites');
      const currentlyFavorite = state.favoriteStationIds.has(stationId);
      if (currentlyFavorite) {
        await removeFavorite(stationId);
      } else {
        await addFavorite(stationId);
      }
      setState((current) => {
        if (current.status !== 'authenticated') {
          return current;
        }
        const next = new Set(current.favoriteStationIds);
        if (currentlyFavorite) {
          next.delete(stationId);
        } else {
          next.add(stationId);
        }
        return { ...current, favoriteStationIds: next };
      });
      return !currentlyFavorite;
    },
    [state],
  );

  const value = useMemo(
    () => ({
      state,
      refresh,
      setAuthenticated,
      logout,
      isFavorite,
      toggleFavorite,
      refreshFavorites,
    }),
    [
      state,
      refresh,
      setAuthenticated,
      logout,
      isFavorite,
      toggleFavorite,
      refreshFavorites,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}

export function usePreferences(): UserPreferences | null {
  const { state } = useAuth();
  return state.status === 'authenticated' ? state.preferences : null;
}
