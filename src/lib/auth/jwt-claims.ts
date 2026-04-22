type UnknownRecord = Record<string, unknown>;

const TRUE_VALUES = new Set(["1", "true", "t", "yes", "y", "on"]);
const FALSE_VALUES = new Set(["0", "false", "f", "no", "n", "off"]);

const IS_ADMIN_CLAIM_KEYS = [
  "is_admin",
  "isAdmin",
  "crm_is_admin",
  "crm.is_admin",
  "crm.isAdmin",
] as const;

const TENANT_IDS_CLAIM_KEYS = [
  "tenant_ids",
  "tenantIds",
  "crm_tenant_ids",
  "crm.tenant_ids",
  "crm.tenantIds",
  "allowed_tenant_ids",
  "tenants",
] as const;

const ACTIVE_CLAIM_KEYS = [
  "active",
  "is_active",
  "isActive",
  "crm_active",
  "crm.active",
] as const;

const USER_NAME_CLAIM_KEYS = [
  "name",
  "full_name",
  "crm_name",
  "crm.name",
] as const;

function asRecord(value: unknown): UnknownRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as UnknownRecord;
}

function readPath(record: UnknownRecord, path: string): unknown {
  const parts = path.split(".");
  let cursor: unknown = record;

  for (const part of parts) {
    const current = asRecord(cursor);
    if (!current || !(part in current)) {
      return undefined;
    }

    cursor = current[part];
  }

  return cursor;
}

function getClaimSources(user: unknown): UnknownRecord[] {
  const userRecord = asRecord(user);
  if (!userRecord) {
    return [];
  }

  const appMetadata = asRecord(userRecord.app_metadata);
  const userMetadata = asRecord(userRecord.user_metadata);

  const sources: UnknownRecord[] = [];

  if (appMetadata) {
    const appClaims = asRecord(appMetadata.claims);
    if (appClaims) {
      sources.push(appClaims);
    }
    sources.push(appMetadata);
  }

  if (userMetadata) {
    const userClaims = asRecord(userMetadata.claims);
    if (userClaims) {
      sources.push(userClaims);
    }
    sources.push(userMetadata);
  }

  return sources;
}

function readClaim(user: unknown, keys: readonly string[]): unknown {
  for (const source of getClaimSources(user)) {
    for (const key of keys) {
      const value = readPath(source, key);
      if (value !== undefined && value !== null) {
        return value;
      }
    }
  }

  return null;
}

function parseBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    if (value === 1) return true;
    if (value === 0) return false;
    return null;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (!normalized) {
      return null;
    }

    if (TRUE_VALUES.has(normalized)) {
      return true;
    }

    if (FALSE_VALUES.has(normalized)) {
      return false;
    }
  }

  return null;
}

function parseString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed || null;
}

function parseStringArray(value: unknown): string[] | null {
  if (Array.isArray(value)) {
    const values = value
      .map((item) => (typeof item === "string" || typeof item === "number" ? String(item).trim() : ""))
      .filter(Boolean);

    return Array.from(new Set(values));
  }

  if (typeof value === "string") {
    const values = value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

    return Array.from(new Set(values));
  }

  return null;
}

export function getIsAdminFromJwt(user: unknown): boolean | null {
  return parseBoolean(readClaim(user, IS_ADMIN_CLAIM_KEYS));
}

export function getTenantIdsFromJwt(user: unknown): string[] | null {
  return parseStringArray(readClaim(user, TENANT_IDS_CLAIM_KEYS));
}

export function getActiveFromJwt(user: unknown): boolean | null {
  return parseBoolean(readClaim(user, ACTIVE_CLAIM_KEYS));
}

export function getUserNameFromJwt(user: unknown): string | null {
  return parseString(readClaim(user, USER_NAME_CLAIM_KEYS));
}
