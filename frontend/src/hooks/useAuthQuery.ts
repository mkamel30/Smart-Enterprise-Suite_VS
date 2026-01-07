import { useQuery } from '@tanstack/react-query';
import type { UseQueryOptions, QueryKey } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';

/**
 * A wrapper around useQuery that automatically checks if the user is authenticated
 * before enabling the query. This prevents 500 errors from API calls before login.
 * 
 * Usage: Replace `useQuery` with `useAuthQuery` in components
 */
export function useAuthQuery<
  TQueryFnData = unknown,
  TError = unknown,
  TData = TQueryFnData,
  TQueryKey extends QueryKey = QueryKey
>(
  options: Omit<UseQueryOptions<TQueryFnData, TError, TData, TQueryKey>, 'enabled'> & {
    enabled?: boolean;
  }
) {
  const { user } = useAuth();

  return useQuery({
    ...options,
    // Combine authentication check with any custom enabled logic
    enabled: !!user && (options.enabled !== undefined ? options.enabled : true),
  });
}
