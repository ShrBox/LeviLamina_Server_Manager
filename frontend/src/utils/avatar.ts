// Safe avatar URL generation & inline SVG fallbacks for Xbox profiles

export const DEFAULT_AVATAR_SVG = (initial = 'X'): string => {
  const char = (initial && initial.trim().length > 0) ? initial.trim()[0].toUpperCase() : 'X';
  return `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%2310b981"/><stop offset="100%" stop-color="%23047857"/></linearGradient></defs><rect width="64" height="64" rx="32" fill="url(%23g)"/><text x="32" y="42" font-family="Segoe UI, sans-serif" font-weight="900" font-size="28" fill="%23ffffff" text-anchor="middle">${encodeURIComponent(char)}</text></svg>`;
};

export function getSafeAvatarUrl(avatarUrl?: string | null, gamertag?: string | null): string {
  // If we already have a valid data URL that is not an encoded 404 HTML body
  if (avatarUrl && typeof avatarUrl === 'string') {
    if (avatarUrl.startsWith('data:image/') && !avatarUrl.includes('PCFET0') && !avatarUrl.includes('html')) {
      return avatarUrl;
    }
    if (avatarUrl.startsWith('http') && !avatarUrl.includes('avatar-ssl.xboxlive.com')) {
      return avatarUrl;
    }
  }

  // Use unavatar.io for modern Xbox gamerpics
  if (gamertag && gamertag.trim()) {
    return `https://unavatar.io/xboxgamertag/${encodeURIComponent(gamertag.trim())}`;
  }

  return DEFAULT_AVATAR_SVG(gamertag?.[0] || 'X');
}
