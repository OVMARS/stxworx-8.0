import { AppConfig, UserSession, authenticate as showConnectFn, request as stacksRequest } from '@stacks/connect';
import { STACKS_TESTNET, STACKS_MAINNET } from '@stacks/network';
import { APP_CONFIG, IS_TESTNET } from './constants';

const appConfig = new AppConfig(['store_write', 'publish_data']);
export const userSession = new UserSession({ appConfig });

export const network = IS_TESTNET ? STACKS_TESTNET : STACKS_MAINNET;

export function authenticate(onFinish?: (payload: any) => void) {
  showConnectFn({
    appDetails: {
      name: APP_CONFIG.name,
      icon: window.location.origin + APP_CONFIG.icon,
    },
    redirectTo: '/',
    onFinish: payload => {
      if (onFinish) {
        onFinish(payload);
      } else {
        window.location.reload();
      }
    },
    userSession,
  });
}

export function getUserData() {
  if (userSession.isUserSignedIn()) {
    return userSession.loadUserData();
  }
  return null;
}

export function getUserAddress() {
  const userData = getUserData();
  return (
    userData?.profile?.stxAddress?.testnet || userData?.profile?.stxAddress?.mainnet || null
  );
}

export function signOut() {
  userSession.signUserOut();
  window.location.reload();
}

export async function requestSignMessage(message: string): Promise<{ signature: string; publicKey: string } | null> {
  try {
    const result = await stacksRequest('stx_signMessage', { message });
    return { signature: result.signature, publicKey: result.publicKey };
  } catch {
    return null;
  }
}
