import { getStoredTranslation } from '../i18n';

/**
 * Friendly Error Parser & Formatter for LeviLamina Server Manager
 * Translates raw CLI outputs, LIP logs, Go runtime errors, and network errors
 * into human-readable, clear explanations with actionable tips.
 */

export interface ParsedErrorInfo {
  title: string;
  message: string;
  suggestion?: string;
  type: 'error' | 'warning' | 'info' | 'success';
  rawDetails?: string;
}

export function parseFriendlyError(
  rawInput: string | any,
  context?: {
    packageName?: string;
    serverName?: string;
    action?: string;
  }
): ParsedErrorInfo {
  const raw = typeof rawInput === 'string' ? rawInput : String(rawInput || '');
  const lower = raw.toLowerCase();
  const pkgName = context?.packageName;

  // 1. Success cases that might contain logs
  if (
    lower.includes('successfully') ||
    lower.includes('is installed and active') ||
    (lower.includes('installed') && !lower.includes('failed') && !lower.includes('error') && !lower.includes('incompat'))
  ) {
    return {
      title: getStoredTranslation('friendlyError.installSuccessTitle', 'Installation Successful'),
      message: pkgName
        ? `"${pkgName}" ${getStoredTranslation('friendlyError.pkgInstalledSuccess', 'was installed successfully and is ready to use.')}`
        : getStoredTranslation('friendlyError.packageInstalledSuccess', 'The package was installed successfully.'),
      type: 'success',
      rawDetails: raw.length > 80 ? raw : undefined,
    };
  }

  // 2. Package already installed
  if (lower.includes('already explicitly installed') || lower.includes('already installed')) {
    return {
      title: getStoredTranslation('friendlyError.alreadyInstalledTitle', 'Already Installed'),
      message: pkgName
        ? `"${pkgName}" ${getStoredTranslation('friendlyError.pkgAlreadyInstalled', 'is already installed on your server.')}`
        : getStoredTranslation('friendlyError.packageAlreadyInstalled', 'This package is already installed on your server.'),
      suggestion: getStoredTranslation('friendlyError.alreadyInstalledSuggestion', 'You can use it right away, or uninstall it first if you wish to perform a fresh reinstall.'),
      type: 'info',
      rawDetails: raw.length > 80 ? raw : undefined,
    };
  }

  // 3. Mod / Dependency / LeviLamina Version Incompatibility
  if (
    lower.includes('incompat') ||
    lower.includes('could not find compatible') ||
    lower.includes('no matching version') ||
    lower.includes('unsatisfied') ||
    lower.includes('candidate with 0') ||
    lower.includes('no solution') ||
    (lower.includes('resolving dependencies for') && (lower.includes('candidate') || lower.includes('exit status'))) ||
    lower.includes('conflict')
  ) {
    let extraHint = '';
    const llMatch = raw.match(/LeviLamina@\[([^\]]+)\]/i);
    if (llMatch && llMatch[1]) {
      extraHint = ` (${getStoredTranslation('friendlyError.serverOnLlVersion', 'Your server is currently on LeviLamina')} v${llMatch[1]})`;
    }

    return {
      title: getStoredTranslation('friendlyError.incompatibleModTitle', 'Incompatible Mod Version'),
      message: pkgName
        ? `${getStoredTranslation('friendlyError.versionOf', 'This version of')} "${pkgName}" ${getStoredTranslation('friendlyError.isIncompatible', 'is incompatible with your current server setup')}${extraHint}.`
        : `${getStoredTranslation('friendlyError.modIncompatible', 'This mod version is incompatible with your current server or LeviLamina setup')}${extraHint}.`,
      suggestion: pkgName
        ? `${getStoredTranslation('friendlyError.trySelectVersion', 'Try selecting a different version of')} "${pkgName}" ${getStoredTranslation('friendlyError.fromDropdownOrUpdate', 'from the version dropdown, or update your LeviLamina version.')}`
        : getStoredTranslation('friendlyError.trySelectDifferentVersion', 'Try selecting a different version from the dropdown, or check if an updated LeviLamina version is available.'),
      type: 'warning',
      rawDetails: raw,
    };
  }

  // 4. File locked / Server is running
  if (
    lower.includes('sharing violation') ||
    lower.includes('used by another process') ||
    lower.includes('file is locked') ||
    lower.includes('process cannot access the file') ||
    lower.includes('busy')
  ) {
    return {
      title: getStoredTranslation('friendlyError.filesLockedTitle', 'Server Files Locked'),
      message: pkgName
        ? `${getStoredTranslation('friendlyError.cannotModifyPkg', 'Cannot install or modify')} "${pkgName}" ${getStoredTranslation('friendlyError.filesInUse', 'because server files are currently in use.')}`
        : getStoredTranslation('friendlyError.cannotModifyRunning', 'Cannot modify files because the server is currently running.'),
      suggestion: getStoredTranslation('friendlyError.stopServerRetry', 'Please stop your server first, then try the operation again.'),
      type: 'warning',
      rawDetails: raw,
    };
  }

  // 5. Network / Proxy / Download failure
  if (
    lower.includes('proxy.golang.org') ||
    lower.includes('connectex') ||
    lower.includes('dial tcp') ||
    lower.includes('connection refused') ||
    lower.includes('i/o timeout') ||
    lower.includes('tls handshake') ||
    lower.includes('failed to fetch') ||
    lower.includes('network error') ||
    lower.includes('dns') ||
    lower.includes('404 not found')
  ) {
    return {
      title: getStoredTranslation('friendlyError.networkErrorTitle', 'Download Connection Error'),
      message: pkgName
        ? `${getStoredTranslation('friendlyError.unableToDownloadPkg', 'Unable to download')} "${pkgName}" ${getStoredTranslation('friendlyError.fromRepo', 'from the mod repository.')}`
        : getStoredTranslation('friendlyError.failedToDownloadFromRepo', 'Failed to download package files from the repository.'),
      suggestion: getStoredTranslation('friendlyError.checkInternetProxy', 'Check your internet connection. If you are using a proxy or VPN, make sure proxy.golang.org and github.com are reachable.'),
      type: 'error',
      rawDetails: raw,
    };
  }

  // 6. Permission / Access Denied
  if (lower.includes('access is denied') || lower.includes('permission denied')) {
    return {
      title: getStoredTranslation('friendlyError.permissionDeniedTitle', 'Permission Denied'),
      message: getStoredTranslation('friendlyError.permissionDeniedMsg', 'Windows denied access to modify the server files or directories.'),
      suggestion: getStoredTranslation('friendlyError.permissionDeniedSuggestion', 'Ensure the server folder is not read-only and your user account has write permissions to it.'),
      type: 'error',
      rawDetails: raw,
    };
  }

  // 7. LIP Manager Missing
  if (lower.includes('lip is not installed') || lower.includes('cannot find lip') || lower.includes('lip.exe: not found')) {
    return {
      title: getStoredTranslation('friendlyError.lipRequiredTitle', 'LIP Package Manager Required'),
      message: getStoredTranslation('friendlyError.lipRequiredMsg', 'The LIP package manager was not found on your system.'),
      suggestion: getStoredTranslation('friendlyError.lipRequiredSuggestion', 'Click the "Install LIP" button in the Mods tab to install it automatically.'),
      type: 'warning',
      rawDetails: raw,
    };
  }

  // 8. Server not selected
  if (lower.includes('please select a server first') || lower.includes('no server selected')) {
    return {
      title: getStoredTranslation('friendlyError.serverRequiredTitle', 'Server Selection Required'),
      message: getStoredTranslation('friendlyError.serverRequiredMsg', 'Please select a server first to perform this action.'),
      suggestion: getStoredTranslation('friendlyError.serverRequiredSuggestion', 'Choose an active server from the top bar or create a new one.'),
      type: 'info',
      rawDetails: undefined,
    };
  }

  // 9. Generic clean-up for multi-line or command errors
  const lines = raw.split('\n').map(l => l.trim()).filter(Boolean);
  let mainMessage = lines[0] || getStoredTranslation('errorOccurred', 'An unexpected error occurred.');

  if (mainMessage.toLowerCase().startsWith('installation result for')) {
    mainMessage = pkgName 
      ? `${getStoredTranslation('friendlyError.installFailedFor', 'Installation failed for')} "${pkgName}".` 
      : getStoredTranslation('friendlyError.installNotCompleted', 'Installation could not be completed.');
  } else if (mainMessage.toLowerCase().startsWith('lip error:')) {
    mainMessage = getStoredTranslation('friendlyError.lipEncounteredError', 'The LIP package manager encountered an error.');
  } else if (mainMessage.toLowerCase().startsWith('failed to install package:')) {
    mainMessage = mainMessage.replace(/failed to install package:\s*/i, '');
  }

  return {
    title: getStoredTranslation('friendlyError.actionNoticeTitle', 'Action Notice'),
    message: mainMessage,
    suggestion: lines.length > 1 ? getStoredTranslation('friendlyError.seeLogBelow', 'See the technical log below for details.') : undefined,
    type: lower.includes('error') || lower.includes('fail') ? 'error' : 'warning',
    rawDetails: raw.includes('\n') || raw.length > 100 ? raw : undefined,
  };
}
