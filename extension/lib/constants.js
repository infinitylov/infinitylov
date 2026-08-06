/**
 * InfinityLov — backend Supabase Edge Functions
 */
export const SUPABASE_URL = 'https://saxxqxkhyakqvfcjbkqa.supabase.co';
export const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNheHhxeGtoeWFrcXZmY2pia3FhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU5NjQ3NTUsImV4cCI6MjEwMTU0MDc1NX0.dOnJNaymjObVvSZoCYPKEr2B5MLC0G3Xlc4q-BEHdk8';

/** Base das Edge Functions */
export const API_BASE = `${SUPABASE_URL}/functions/v1`;

export const INJECT_CONFIG_URL = `${API_BASE}/inject-config`;
export const VALIDATE_URL = `${API_BASE}/validate-license`;
export const PROXY_URL = `${API_BASE}/send-lovable-prompt`;
/** Alias histórico — mesmo endpoint de envio */
export const SEND_PROMPT_URL = `${API_BASE}/send-lovable-prompt`;
export const STORAGE_UPLOAD_URL = `${API_BASE}/storage-upload`;
export const STORAGE_PUBLIC_BASE = `${SUPABASE_URL}/storage/v1/object/public/extension-uploads`;
export const SUPPORT_INFO_URL = `${API_BASE}/get-support-info`;

export const LICENSE_CACHE_TTL_MS = 1 * 60 * 1000;

/** Headers exigidos pelas Edge Functions Supabase */
export function supabaseHeaders(extra = {}) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    apikey: SUPABASE_ANON_KEY,
    ...extra,
  };
}
