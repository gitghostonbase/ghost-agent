const FORBIDDEN_RESOURCE_NAMES = new Set(["identity", "identity.json"]);
const SECRET_FIELD_NAMES = new Set(["secret", "privateKey", "identity"]);

export function assertSafeGitghostResource(uri: string): void {
  const resourceName = uri.replace(/^gitghost:\/\//, "").trim().toLowerCase();
  if (FORBIDDEN_RESOURCE_NAMES.has(resourceName)) {
    throw new Error("identity resource is forbidden");
  }
  if (resourceName !== "ring" && resourceName !== "anchors") {
    throw new Error(`unsupported gitghost resource: ${resourceName}`);
  }
}

export function redactSecretFields(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => redactSecretFields(item));
  }

  if (value === null || typeof value !== "object") {
    return value;
  }

  const entries = Object.entries(value).map(([key, entryValue]) => {
    if (SECRET_FIELD_NAMES.has(key)) {
      return [key, "[REDACTED]"] as const;
    }
    return [key, redactSecretFields(entryValue)] as const;
  });

  return Object.fromEntries(entries);
}

export function sanitizeErrorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  return raw.split(/\r?\n/)[0]?.trim() || "unknown error";
}
