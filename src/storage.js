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

// User spaces never fall back to the historical unscoped browser cache.
export function storageKeyForSpace(key,spaceId='local') {
  return !spaceId||spaceId==='local' ? key : `mdd-space:${spaceId}:${key}`;
}
export function scopedStorage(storage,spaceId='local') {
  return {
    getItem:key=>storage.getItem(storageKeyForSpace(key,spaceId)),
    setItem:(key,value)=>storage.setItem(storageKeyForSpace(key,spaceId),value),
    removeItem:key=>storage.removeItem?.(storageKeyForSpace(key,spaceId))
  };
}
