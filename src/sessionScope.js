let activeSpace = null;
export function setRequestSpace(spaceId) { activeSpace = typeof spaceId === 'string' ? spaceId : null; }
export function getRequestSpace() { return activeSpace; }
