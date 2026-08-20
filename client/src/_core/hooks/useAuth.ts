import { trpc } from "@/lib/trpc";
import { TRPCClientError } from "@trpc/client";
import { useCallback, useMemo } from "react";

type UseAuthOptions = {
  redirectOnUnauthenticated?: boolean;
};

export function useAuth(_options?: UseAuthOptions) {
  const utils = trpc.useUtils();
  const meQuery = trpc.auth.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: async result => {
      if (result.ok) {
        utils.auth.me.setData(undefined, result.user);
        await utils.auth.me.invalidate();
      }
    },
  });

  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: async () => {
      utils.auth.me.setData(undefined, null);
      await utils.auth.me.invalidate();
    },
  });

  const login = useCallback(async (pin: string) => {
    return loginMutation.mutateAsync({ pin });
  }, [loginMutation]);

  const logout = useCallback(async () => {
    try {
      await logoutMutation.mutateAsync();
    } catch (error: unknown) {
      if (!(error instanceof TRPCClientError) || error.data?.code !== "UNAUTHORIZED") throw error;
    } finally {
      utils.auth.me.setData(undefined, null);
      await utils.auth.me.invalidate();
    }
  }, [logoutMutation, utils]);

  return useMemo(() => ({
    user: meQuery.data ?? null,
    loading: meQuery.isLoading || loginMutation.isPending || logoutMutation.isPending,
    error: meQuery.error ?? loginMutation.error ?? logoutMutation.error ?? null,
    isAuthenticated: Boolean(meQuery.data),
    login,
    logout,
    refresh: () => meQuery.refetch(),
  }), [meQuery.data, meQuery.error, meQuery.isLoading, loginMutation.error, loginMutation.isPending, logoutMutation.error, logoutMutation.isPending, login, logout, meQuery]);
}
