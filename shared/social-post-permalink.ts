const SOCIAL_POST_PERMALINK_PREFIX = "sp_";
const SOCIAL_POST_PERMALINK_XOR_MASK = 0x5f3759df;
const SOCIAL_POST_PERMALINK_CHECKSUM_MASK = 0x9e3779b1;

function toChecksum(postId: number) {
  return ((((postId * SOCIAL_POST_PERMALINK_CHECKSUM_MASK) >>> 0) ^ SOCIAL_POST_PERMALINK_XOR_MASK) >>> 0)
    .toString(36)
    .padStart(4, "0")
    .slice(0, 4);
}

export function encodeSocialPostId(postId: number) {
  if (!Number.isInteger(postId) || postId <= 0) {
    throw new Error("Invalid social post ID");
  }

  const obfuscated = (postId ^ SOCIAL_POST_PERMALINK_XOR_MASK) >>> 0;
  return `${SOCIAL_POST_PERMALINK_PREFIX}${obfuscated.toString(36)}${toChecksum(postId)}`;
}

export function decodeSocialPostId(value: string) {
  const normalized = value.trim().toLowerCase();

  if (!normalized) {
    return null;
  }

  const legacyPostId = Number(normalized);
  if (Number.isInteger(legacyPostId) && legacyPostId > 0) {
    return legacyPostId;
  }

  if (!normalized.startsWith(SOCIAL_POST_PERMALINK_PREFIX)) {
    return null;
  }

  const payload = normalized.slice(SOCIAL_POST_PERMALINK_PREFIX.length);
  if (payload.length <= 4) {
    return null;
  }

  const encodedId = payload.slice(0, -4);
  const checksum = payload.slice(-4);
  const obfuscated = Number.parseInt(encodedId, 36);

  if (!Number.isSafeInteger(obfuscated)) {
    return null;
  }

  const postId = (obfuscated ^ SOCIAL_POST_PERMALINK_XOR_MASK) >>> 0;
  if (postId <= 0) {
    return null;
  }

  return toChecksum(postId) === checksum ? postId : null;
}
