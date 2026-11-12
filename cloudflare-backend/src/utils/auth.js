// Shared deterministic session token derivation for Admin and Kitchen portals.
// Binding tokens to the active password ensures password resets revoke older sessions.

export const DEFAULT_ADMIN_PASSWORD = 'supersecret';
export const DEFAULT_KITCHEN_PASSWORD = 'kitchen123';

async function sha256Hex(input) {
  const data = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function computeAdminToken(secret, password) {
  const hex = await sha256Hex(`${secret || 'cafaqr_admin'}:${password}`);
  return `cf_admin_${hex.slice(0, 40)}`;
}

export async function computeKitchenToken(secret, password) {
  const hex = await sha256Hex(`${secret || 'cafaqr_kitchen'}:${password}`);
  return `cf_kitchen_${hex.slice(0, 40)}`;
}

