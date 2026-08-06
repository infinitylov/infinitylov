const DEFAULTS = {
  enabled: false,
  stats: { promptCount: 0, errorCount: 0, lastPromptAt: 0 },
  intel: {},
  featureFlags: {},
  userEmail: '',
  licenseKey: '',
  lovableToken: '',
  lovableTokenAt: 0,
  lovableWorkspaceId: '',
  lovableCastleToken: '',
  lovableCastleTokenAt: 0,
  lovableSessionId: '',
  lovableClientGitSha: '',
  hiddenBadgesByProject: {},
  tryToFixHistory: {},
  chatModeByProject: {},
  activeTab: 'home',
  theme: 'dark',
  licenseState: {
    status: 'unknown',
    plan: null,
    expiresAt: null,
    boundEmail: null,
    config: null,
    licenseHash: null,
    lastChecked: 0,
    error: null,
  },
};

export async function getSettings() {
  const stored = await chrome.storage.local.get('settings');
  return deepMerge(DEFAULTS, stored.settings || {});
}

export async function setSettings(updates) {
  const current = await getSettings();
  const merged = deepMerge(current, updates);
  await chrome.storage.local.set({ settings: merged });
  return merged;
}

export async function resetSettings() {
  await chrome.storage.local.remove('settings');
  return getSettings();
}

function deepMerge(a, b) {
  if (b === null || b === undefined) return a;
  if (typeof a !== 'object' || typeof b !== 'object') return b;
  if (Array.isArray(b)) return b;
  const out = { ...a };
  for (const k of Object.keys(b)) {
    if (b[k] && typeof b[k] === 'object' && !Array.isArray(b[k])) {
      out[k] = deepMerge(a[k] || {}, b[k]);
    } else {
      out[k] = b[k];
    }
  }
  return out;
}
