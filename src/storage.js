// Records managed by this helper are arrays; billing has a separate schema.
// Malformed or unavailable storage
// should not prevent the user from opening the workspace.
export function readStoredArray(storage, key, fallback) {
  try {
    const value = JSON.parse(storage.getItem(key));
    return Array.isArray(value) ? value : fallback;
  } catch {
    return fallback;
  }
}

export function writeStoredValue(storage, key, value) {
  try {
    storage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}
