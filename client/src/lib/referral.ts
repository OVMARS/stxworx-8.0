export const PENDING_REFERRAL_CODE_KEY = 'stxworx_pending_referral_code';

export function normalizeReferralCode(value?: string | null) {
  return value?.trim().toUpperCase().replace(/[^A-Z0-9]/g, '') || '';
}

export function persistReferralCodeFromLocation(source = 'unknown') {
  if (typeof window === 'undefined') {
    return '';
  }

  const href = window.location.href;
  const search = window.location.search;
  const params = new URLSearchParams(search);
  const rawReferralCode = params.get('ref');
  const referralCode = normalizeReferralCode(rawReferralCode);

  console.log(`[REFERRAL DEBUG] ${source} href:`, href);
  console.log(`[REFERRAL DEBUG] ${source} search:`, search);
  console.log(`[REFERRAL DEBUG] ${source} extracted ref:`, rawReferralCode, '| normalized:', referralCode);

  if (!referralCode) {
    return '';
  }

  console.log(`[REFERRAL DEBUG] ${source} writing referral code to localStorage:`, referralCode);
  window.localStorage.setItem(PENDING_REFERRAL_CODE_KEY, referralCode);
  console.log(
    `[REFERRAL DEBUG] ${source} stored referral code after write:`,
    window.localStorage.getItem(PENDING_REFERRAL_CODE_KEY),
  );

  params.delete('ref');
  const nextSearch = params.toString();
  const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ''}${window.location.hash}`;

  console.log(`[REFERRAL DEBUG] ${source} before replaceState current URL:`, window.location.href);
  console.log(`[REFERRAL DEBUG] ${source} before replaceState next URL:`, nextUrl);
  window.history.replaceState({}, '', nextUrl);
  console.log(`[REFERRAL DEBUG] ${source} after replaceState URL:`, window.location.href);

  return referralCode;
}

export function getStoredPendingReferralCode(source = 'unknown') {
  if (typeof window === 'undefined') {
    return '';
  }

  const storedReferralCode = normalizeReferralCode(window.localStorage.getItem(PENDING_REFERRAL_CODE_KEY));
  console.log(`[REFERRAL DEBUG] ${source} stored referral code read:`, storedReferralCode);
  return storedReferralCode;
}

export function getPendingReferralCode(source = 'unknown') {
  const fromLocation = persistReferralCodeFromLocation(`${source}:location`);
  if (fromLocation) {
    return fromLocation;
  }

  return getStoredPendingReferralCode(`${source}:storage`);
}

export function clearPendingReferralCode(source = 'unknown') {
  if (typeof window === 'undefined') {
    return;
  }

  const beforeClear = window.localStorage.getItem(PENDING_REFERRAL_CODE_KEY);
  console.log(`[REFERRAL DEBUG] ${source} clearing stored referral code. before:`, beforeClear);
  window.localStorage.removeItem(PENDING_REFERRAL_CODE_KEY);
  console.log(
    `[REFERRAL DEBUG] ${source} stored referral code after clear:`,
    window.localStorage.getItem(PENDING_REFERRAL_CODE_KEY),
  );
}
