import { Mod, BedrinthPackage, Server } from '../types';

export interface CompatibilityCheckResult {
  isSupported: boolean;
  reason?: string;
}

/**
 * Extracts branch from LeviLamina version string (e.g. "26.51.3" -> "26.51")
 */
export function extractLeviLaminaBranch(version: string | undefined | null): string {
  if (!version) return '';
  const clean = version.replace(/^[^\d]*/, ''); // strip prefixes like v, >=, etc.
  const parts = clean.split('.');
  if (parts.length >= 2) {
    return `${parts[0]}.${parts[1]}`;
  }
  return clean;
}

/**
 * Compares semver versions roughly: returns > 0 if v1 > v2, < 0 if v1 < v2, 0 if equal
 */
function compareSemver(v1: string, v2: string): number {
  const p1 = v1.replace(/^[^\d]*/, '').split('.').map(n => parseInt(n, 10) || 0);
  const p2 = v2.replace(/^[^\d]*/, '').split('.').map(n => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(p1.length, p2.length); i++) {
    const num1 = p1[i] || 0;
    const num2 = p2[i] || 0;
    if (num1 !== num2) return num1 - num2;
  }
  return 0;
}

/**
 * Checks whether an installed mod is compatible with the active server's LeviLamina loader version.
 */
export function checkInstalledModCompatibility(
  mod: Mod,
  server: Server | null
): CompatibilityCheckResult {
  if (!server) return { isSupported: true };

  const serverLlVersion = server.leviLaminaVersion;
  if (!serverLlVersion || serverLlVersion === 'Not Installed' || serverLlVersion === 'None') {
    return { isSupported: true };
  }

  const modNameLower = mod.name.toLowerCase();

  // LeviLamina is the loader itself
  if (modNameLower === 'levilamina') {
    return { isSupported: true };
  }

  // Known problematic mods: Cleaner was built for LeviLamina 26.20 and crashes 26.51+
  if (modNameLower === 'cleaner') {
    const serverBranch = extractLeviLaminaBranch(serverLlVersion);
    if (serverBranch && serverBranch !== '26.20') {
      return {
        isSupported: false,
        reason: `Cleaner was built for LeviLamina 26.20 and causes a fatal crash on ${serverLlVersion}.`,
      };
    }
  }

  // Check explicit mod.leviLaminaVersion constraint (e.g. from tooth_lock.json)
  const reqLL = mod.leviLaminaVersion;
  if (reqLL) {
    const serverBranch = extractLeviLaminaBranch(serverLlVersion);

    // Exact branch pattern: e.g. "26.51.*" or "26.40.*" or "26.20.*"
    if (reqLL.includes('.*')) {
      const targetBranch = extractLeviLaminaBranch(reqLL);
      if (serverBranch && targetBranch && serverBranch !== targetBranch) {
        return {
          isSupported: false,
          reason: `Requires LeviLamina ${targetBranch}.* (Current: ${serverLlVersion})`,
        };
      }
    }

    // Range constraints like ">=26.51.2 <26.60.0"
    if (reqLL.includes('<') || reqLL.includes('>')) {
      const parts = reqLL.split(' ').map(p => p.trim()).filter(Boolean);
      for (const p of parts) {
        if (p.startsWith('>=')) {
          const min = p.substring(2);
          if (compareSemver(serverLlVersion, min) < 0) {
            return {
              isSupported: false,
              reason: `Requires LeviLamina ${p} (Current: ${serverLlVersion})`,
            };
          }
        } else if (p.startsWith('<=')) {
          const max = p.substring(2);
          if (compareSemver(serverLlVersion, max) > 0) {
            return {
              isSupported: false,
              reason: `Requires LeviLamina ${p} (Current: ${serverLlVersion})`,
            };
          }
        } else if (p.startsWith('<')) {
          const max = p.substring(1);
          if (compareSemver(serverLlVersion, max) >= 0) {
            return {
              isSupported: false,
              reason: `Requires LeviLamina ${p} (Current: ${serverLlVersion})`,
            };
          }
        }
      }
    }
  }

  return { isSupported: true };
}

/**
 * Checks whether a Bedrinth package is supported on the active server's LeviLamina loader version.
 */
export function checkBedrinthPackageCompatibility(
  pkg: BedrinthPackage,
  server: Server | null,
  selectedVersion?: string
): CompatibilityCheckResult {
  if (!server) return { isSupported: true };

  const serverLlVersion = server.leviLaminaVersion;
  if (!serverLlVersion || serverLlVersion === 'Not Installed') {
    return { isSupported: true };
  }

  const pkgTooth = pkg.tooth.toLowerCase();
  const pkgName = pkg.name.toLowerCase();

  // LeviLamina is the loader itself
  if (pkgTooth.includes('levilamina') && !pkgTooth.includes('levilamina-loc')) {
    return { isSupported: true };
  }

  const serverBranch = extractLeviLaminaBranch(serverLlVersion);

  // Known legacy packages that have not updated to 26.51
  if (pkgTooth.includes('cleaner') || pkgName === 'cleaner') {
    if (serverBranch && serverBranch !== '26.20') {
      return {
        isSupported: false,
        reason: `Only available for LeviLamina 26.20 (Incompatible with ${serverLlVersion})`,
      };
    }
  }

  // 1. If user has chosen a specific version:
  const versionToCheck = selectedVersion || pkg.versions[0] || '';
  if (versionToCheck) {
    // If version contains branch identifier like "0.3.1-mc26.40"
    const mcMatch = versionToCheck.match(/mc(\d+\.\d+)/i);
    if (mcMatch && mcMatch[1]) {
      if (serverBranch && mcMatch[1] !== serverBranch) {
        return {
          isSupported: false,
          reason: `Built for Minecraft ${mcMatch[1]} (Current: ${serverBranch})`,
        };
      }
    }

    // If version is formatted as BDS/LL version: e.g. "26.40.0" while server is "26.51.3"
    if (versionToCheck.startsWith('26.')) {
      const verBranch = extractLeviLaminaBranch(versionToCheck);
      // Check if any version in the package supports serverBranch
      const hasBranchVersion = pkg.versions.some(v => extractLeviLaminaBranch(v) === serverBranch);
      if (!hasBranchVersion && verBranch !== serverBranch) {
        return {
          isSupported: false,
          reason: `No release available for LeviLamina ${serverBranch} (Highest is ${verBranch})`,
        };
      }
    }
  }

  return { isSupported: true };
}
