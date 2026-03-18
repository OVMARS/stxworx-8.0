type AuthState = {
  walletAddress: string | null;
  role: 'client' | 'freelancer' | null;
};

let state: AuthState = {
  walletAddress: null,
  role: null,
};

export const authStore = {
  getState: () => state,
  setWalletAddress: (walletAddress: string | null) => {
    state = { ...state, walletAddress };
    return state;
  },
  setRole: (role: 'client' | 'freelancer' | null) => {
    state = { ...state, role };
    return state;
  },
};
