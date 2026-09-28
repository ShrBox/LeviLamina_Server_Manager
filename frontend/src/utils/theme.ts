import { Api } from '../services/api';

export type AccentColor = 'emerald' | 'cyan' | 'violet' | 'amber' | 'rose' | 'blue' | 'custom';
export type ThemeMode = 'dark' | 'light';

export interface PaletteInfo {
  id: AccentColor;
  name: string;
  hex500: string;
  rgb500: string;
  rgb600: string;
  rgbAccent: string;
}

export const ACCENT_PALETTES: Record<Exclude<AccentColor, 'custom'>, PaletteInfo> = {
  emerald: {
    id: 'emerald',
    name: 'Levi Emerald',
    hex500: '#00d084',
    rgb500: '0 208 132',
    rgb600: '0 176 112',
    rgbAccent: '59 130 246',
  },
  cyan: {
    id: 'cyan',
    name: 'Electric Cyan',
    hex500: '#06b6d4',
    rgb500: '6 182 212',
    rgb600: '8 145 178',
    rgbAccent: '14 165 233',
  },
  violet: {
    id: 'violet',
    name: 'Cosmic Violet',
    hex500: '#8b5cf6',
    rgb500: '139 92 246',
    rgb600: '124 58 237',
    rgbAccent: '168 85 247',
  },
  amber: {
    id: 'amber',
    name: 'Solar Amber',
    hex500: '#f59e0b',
    rgb500: '245 158 11',
    rgb600: '217 119 6',
    rgbAccent: '234 88 12',
  },
  rose: {
    id: 'rose',
    name: 'Neon Rose',
    hex500: '#f43f5e',
    rgb500: '244 63 94',
    rgb600: '225 29 72',
    rgbAccent: '236 72 153',
  },
  blue: {
    id: 'blue',
    name: 'Cobalt Blue',
    hex500: '#3b82f6',
    rgb500: '59 130 246',
    rgb600: '37 99 235',
    rgbAccent: '99 102 241',
  },
};

export function applyAccentColor(paletteKey: AccentColor, customHex?: string) {
  const root = document.documentElement;
  // If custom hex is chosen
  if (paletteKey === 'custom' && customHex && /^#[0-9A-Fa-f]{6}$/.test(customHex)) {
    const r = parseInt(customHex.slice(1, 3), 16);
    const g = parseInt(customHex.slice(3, 5), 16);
    const b = parseInt(customHex.slice(5, 7), 16);
    root.style.setProperty('--brand-500', `${r} ${g} ${b}`);
    root.style.setProperty('--brand-600', `${Math.max(0, r - 25)} ${Math.max(0, g - 25)} ${Math.max(0, b - 25)}`);
    root.style.setProperty('--brand-accent', `${r} ${g} ${b}`);
    return;
  }
  // If paletteKey is a valid preset in ACCENT_PALETTES, prioritize it
  if (paletteKey && paletteKey !== 'custom' && (ACCENT_PALETTES as any)[paletteKey]) {
    const pal = (ACCENT_PALETTES as any)[paletteKey];
    root.style.setProperty('--brand-500', pal.rgb500);
    root.style.setProperty('--brand-600', pal.rgb600);
    root.style.setProperty('--brand-accent', pal.rgbAccent);
    return;
  }
  // If custom hex is provided and valid, apply custom RGB values
  if (customHex && /^#[0-9A-Fa-f]{6}$/.test(customHex)) {
    const r = parseInt(customHex.slice(1, 3), 16);
    const g = parseInt(customHex.slice(3, 5), 16);
    const b = parseInt(customHex.slice(5, 7), 16);
    root.style.setProperty('--brand-500', `${r} ${g} ${b}`);
    root.style.setProperty('--brand-600', `${Math.max(0, r - 25)} ${Math.max(0, g - 25)} ${Math.max(0, b - 25)}`);
    root.style.setProperty('--brand-accent', `${r} ${g} ${b}`);
    return;
  }
  const pal = ACCENT_PALETTES.emerald;
  root.style.setProperty('--brand-500', pal.rgb500);
  root.style.setProperty('--brand-600', pal.rgb600);
  root.style.setProperty('--brand-accent', pal.rgbAccent);
}

export function applyThemeMode(mode: ThemeMode) {
  const root = document.documentElement;
  if (mode === 'light') {
    root.classList.add('light-mode');
    root.classList.remove('dark');
  } else {
    root.classList.remove('light-mode');
    root.classList.add('dark');
  }
}

export type GuiScale = '75%' | '85%' | '90%' | '100%' | '110%' | '125%' | '150%';

export function applyGuiScale(scale: string | number) {
  const root = document.documentElement;
  let scaleVal = typeof scale === 'number' ? `${scale}%` : scale;
  if (!scaleVal.endsWith('%')) {
    scaleVal = `${scaleVal}%`;
  }
  (root.style as any).zoom = scaleVal;
  try {
    localStorage.setItem('llsm_gui_scale', scaleVal);
  } catch {}
}

export async function initSavedTheme() {
  const applyConfig = (parsed: any) => {
    if (!parsed) return;
    if (parsed.accentColor && (ACCENT_PALETTES as any)[parsed.accentColor]) {
      applyAccentColor(parsed.accentColor as AccentColor);
    } else if (parsed.accentColor === 'custom' && parsed.customAccentHex) {
      applyAccentColor('custom', parsed.customAccentHex);
    } else {
      applyAccentColor('emerald');
    }

    if (parsed.themeMode === 'light' || parsed.themeMode === 'dark') {
      applyThemeMode(parsed.themeMode);
    } else {
      applyThemeMode('light');
    }

    if (parsed.guiScale) {
      applyGuiScale(parsed.guiScale);
    } else {
      const savedScale = localStorage.getItem('llsm_gui_scale');
      if (savedScale) {
        applyGuiScale(savedScale);
      } else {
        applyGuiScale('100%');
      }
    }
  };

  // 1. Instant apply from localStorage cache to prevent flicker
  try {
    const stored = localStorage.getItem('llsm_settings');
    const localScale = localStorage.getItem('llsm_gui_scale');
    if (localScale) {
      applyGuiScale(localScale);
    }
    if (stored) {
      applyConfig(JSON.parse(stored));
    } else {
      applyAccentColor('emerald');
      applyThemeMode('light');
    }
  } catch (e) {
    applyAccentColor('emerald');
    applyThemeMode('light');
  }

  // 2. Synchronize with backend permanent storage ~/.llsm/app_settings.json
  try {
    const backendSettings = await Api.getAppSettings();
    if (backendSettings && backendSettings.trim().length > 0) {
      const parsed = JSON.parse(backendSettings);
      applyConfig(parsed);
      localStorage.setItem('llsm_settings', backendSettings);
    }
  } catch (e) {
    // fallback gracefully
  }
}
