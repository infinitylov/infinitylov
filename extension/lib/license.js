import {
  INJECT_CONFIG_URL,
  LICENSE_CACHE_TTL_MS,
  supabaseHeaders,
} from './constants.js';
import { getSettings, setSettings } from './storage.js';

// Estado salvo em settings.licenseState:
//   { status: 'unknown' | 'valid' | 'invalid' | 'expired' | 'wrong_email',
//     plan, expiresAt, boundEmail, config, lastChecked, error }

export function emptyLicenseState() {
  return {
    status: 'unknown',
    plan: null,
    expiresAt: null,
    boundEmail: null,
    config: null,
    licenseHash: null,
    lastChecked: 0,
    error: null,
  };
}

async function computeLicenseHash(key) {
  try {
    const enc = new TextEncoder().encode(key);
    const buf = await crypto.subtle.digest('SHA-256', enc);
    return Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
      .slice(0, 16);
  } catch (_) {
    return null;
  }
}

// Retorna o estado atual; se o cache estiver fresco, não revalida.
// force=true ignora cache (use no toggle e no clique de "Ativar").
export async function getLicenseState({ force = false } = {}) {
  const settings = await getSettings();
  const key = settings.licenseKey;
  const email = settings.userEmail || null;
  const hwid = settings.deviceId || null;
  const cached = settings.licenseState || emptyLicenseState();

  if (!key) return emptyLicenseState();

  const fresh = Date.now() - (cached.lastChecked || 0) < LICENSE_CACHE_TTL_MS;
  if (!force && fresh && cached.status === 'valid') return cached;

  return validateLicense(key, email, hwid);
}

export async function validateLicense(key, email, hwid) {
  const trimmed = (key || '').trim();
  if (!trimmed) {
    const s = { ...emptyLicenseState(), status: 'invalid', error: 'Chave vazia' };
    await persistLicenseState(s);
    return s;
  }

  let res;
  try {
    // SEM validação de HWID: manda só key (+ email). Sem hwid, o inject-config
    // pula todo o bloco de dispositivo e valida só a licença (existe, não
    // revogada, não expirada). Isso elimina os falsos "outro dispositivo".
    const body = { key: trimmed };
    if (email) body.email = email;

    res = await fetch(INJECT_CONFIG_URL, {
      method: 'POST',
      headers: supabaseHeaders(),
      body: JSON.stringify(body),
    });
  } catch (e) {
    // Rede fora → transitório, NUNCA desloga. Se a licença salva era válida,
    // continua válida; senão marca 'transient' pra o polling não revogar.
    const cached = (await getSettings()).licenseState || emptyLicenseState();
    return { ...cached, status: cached.status === 'valid' ? 'valid' : 'transient', error: 'Sem conexão', lastChecked: cached.lastChecked };
  }

  let data = {};
  try {
    data = await res.json();
  } catch (_) {}

  if (res.ok && data?.config) {
    const state = {
      status: 'valid',
      plan: data.license?.plan || null,
      expiresAt: data.license?.expires_at || null,
      boundEmail: data.license?.bound_email || null,
      config: data.config,
      licenseHash: await computeLicenseHash(trimmed),
      lastChecked: Date.now(),
      error: null,
    };
    await persistLicenseState(state, { licenseKey: trimmed });
    return state;
  }

  const status = mapErrorToStatus(res.status, data?.error, data?.reason);

  // Transitório (5xx/rede/rate-limit) e device_mismatch (HWID) NÃO são revogação:
  // NÃO sobrescreve o estado salvo (não "gruda" um status ruim no storage). Só
  // devolve o status pro chamador (polling) — que NÃO desloga nesses casos.
  if (status === 'transient' || status === 'device_mismatch') {
    const prev = (await getSettings()).licenseState || emptyLicenseState();
    return { ...prev, status, error: data?.error || `HTTP ${res.status}`, reason: data?.reason || null };
  }

  // Definitivo (revoked/expired/invalid): persiste e devolve.
  const state = {
    ...emptyLicenseState(),
    status,
    error: data?.error || `HTTP ${res.status}`,
    reason: data?.reason || null,
    lastChecked: Date.now(),
  };
  await persistLicenseState(state);
  return state;
}

export async function clearLicense() {
  await setSettings({
    licenseKey: '',
    licenseState: emptyLicenseState(),
  });
}

async function persistLicenseState(state, extra = {}) {
  await setSettings({ ...extra, licenseState: state });
}

// Traduz a resposta de erro do servidor num status. Prioriza o campo "reason"
// estruturado (contrato novo do inject-config); cai pro texto/HTTP se não vier.
// Statuses: valid | revoked | expired | device_mismatch | transient | invalid
//   revoked/expired/invalid → DESLOGA (definitivo)
//   device_mismatch/transient → NÃO desloga (bloqueio ou blip do servidor)
function mapErrorToStatus(httpStatus, errorMsg, reason) {
  const r = String(reason || '').toLowerCase();
  if (r === 'revoked')          return 'revoked';
  if (r === 'expired')          return 'expired';
  if (r === 'device_mismatch')  return 'device_mismatch';
  if (r === 'post_reset_guard') return 'device_mismatch'; // mesmo tratamento: não desloga
  if (r === 'transient')        return 'transient';
  if (r === 'invalid_key')      return 'invalid';

  // ── Fallback (antes do deploy dos reason codes no servidor) ──
  // 5xx / rate-limit = SEMPRE transitório → nunca desloga por blip do servidor.
  if (httpStatus >= 500 || httpStatus === 429) return 'transient';

  const msg = String(errorMsg || '').toLowerCase();
  if (msg.includes('expirada') || msg.includes('expired')) return 'expired';
  if (msg.includes('revogada') || msg.includes('revoked')) return 'revoked';
  // HWID / outro dispositivo / rebind pós-reset = BLOQUEIO, não revogação.
  if (msg.includes('dispositivo') || msg.includes('hwid') || msg.includes('device') ||
      msg.includes('resetada recentemente') || msg.includes('resetar')) return 'device_mismatch';
  // 403/401 com "chave não encontrada" / "invalid" = chave realmente ruim → desloga.
  if (httpStatus === 403 || httpStatus === 401) return 'invalid';
  // Qualquer outra coisa não-conclusiva → transitório (fail-safe: não desloga por engano).
  return 'transient';
}
