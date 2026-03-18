import React, { useCallback, useEffect, useMemo, useState } from "react";
import * as Shared from "../../shared";
import { getCurrentUser, logoutUser, verifyWallet } from "../../lib/api";
import { authenticate, userSession, getUserData, getUserAddress, requestSignMessage } from "../../lib/stacks";
import type { UserRole } from "../../types/user";

type WalletProviderProps = {
  value: Omit<Shared.WalletContextType, "connect" | "disconnect" | "isSignedIn" | "userSession" | "userData">;
  children: React.ReactNode;
};

const PENDING_ROLE_KEY = "stxworx_pending_role";

export function WalletProvider({ value, children }: WalletProviderProps) {
  const { setWalletAddress, setUserRole } = value;
  const [userData, setUserData] = useState<any>(null);
  const [isSignedIn, setIsSignedIn] = useState(false);

  const authenticateBackendSession = useCallback(
    async (roleOverride?: UserRole | null) => {
      const address = getUserAddress();
      if (!address) {
        return;
      }

      try {
        const currentUser = await getCurrentUser();
        setUserRole(currentUser.user.role);
        window.localStorage.removeItem(PENDING_ROLE_KEY);
        return;
      } catch {}

      const pendingRole = roleOverride || (window.localStorage.getItem(PENDING_ROLE_KEY) as UserRole | null);
      if (!pendingRole) {
        return;
      }

      const message = `Sign in to STXWORX as ${pendingRole} on ${window.location.host} at ${new Date().toISOString()}`;
      const signedMessage = await requestSignMessage(message);

      if (!signedMessage) {
        throw new Error("Wallet message signing was cancelled");
      }

      const session = await verifyWallet({
        stxAddress: address,
        publicKey: signedMessage.publicKey,
        signature: signedMessage.signature,
        message,
        role: pendingRole,
      });

      setUserRole(session.user.role);
      window.localStorage.removeItem(PENDING_ROLE_KEY);
    },
    [setUserRole],
  );

  useEffect(() => {
    const hydrateSession = async () => {
      if (userSession.isSignInPending()) {
        try {
          const data = await userSession.handlePendingSignIn();
          setUserData(data);
          const address =
            data.profile?.stxAddress?.testnet || data.profile?.stxAddress?.mainnet || null;
          setWalletAddress(address);
          setIsSignedIn(true);
          await authenticateBackendSession();
        } catch (error) {
          console.error("Error handling pending sign in:", error);
        }
        return;
      }

      if (userSession.isUserSignedIn()) {
        try {
          const data = getUserData();
          setUserData(data);
          setWalletAddress(getUserAddress());
          setIsSignedIn(true);
          await authenticateBackendSession();
        } catch (error) {
          console.error("Error loading user session:", error);
        }
      }
    };

    hydrateSession();
  }, [authenticateBackendSession, setWalletAddress]);

  const connect = useCallback((role?: UserRole) => {
    if (role) {
      window.localStorage.setItem(PENDING_ROLE_KEY, role);
    }

    authenticate(() => {
      if (userSession.isUserSignedIn()) {
        const data = getUserData();
        setUserData(data);
        setWalletAddress(getUserAddress());
        setIsSignedIn(true);
        authenticateBackendSession(role).catch((error) => {
          console.error("Error creating backend session:", error);
        });
      }
    });
  }, [authenticateBackendSession, setWalletAddress]);

  const disconnect = useCallback(() => {
    logoutUser().catch(() => undefined);
    userSession.signUserOut(window.location.origin);
    setIsSignedIn(false);
    setUserData(null);
    setWalletAddress(null);
    setUserRole(null);
    window.localStorage.removeItem(PENDING_ROLE_KEY);
  }, [setUserRole, setWalletAddress]);

  const providerValue = useMemo<Shared.WalletContextType>(
    () => ({
      ...value,
      connect,
      disconnect,
      isSignedIn,
      userSession,
      userData,
    }),
    [value, connect, disconnect, isSignedIn, userData],
  );

  return (
    <Shared.WalletContext.Provider value={providerValue}>{children}</Shared.WalletContext.Provider>
  );
}
