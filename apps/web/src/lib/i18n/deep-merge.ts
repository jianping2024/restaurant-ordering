/**
 * Deep merge for plain objects - arrays replace, not merge.
 * Used for merging UI message packs.
 */
export function deepMerge<T>(target: T, source: Partial<T>): T {
  if (source === null || source === undefined) {
    return target;
  }

  if (typeof source !== 'object' || Array.isArray(source)) {
    return source as T;
  }

  if (typeof target !== 'object' || target === null || Array.isArray(target)) {
    return source as T;
  }

  const result = { ...target } as T;

  for (const key in source) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      const sourceValue = source[key];
      if (sourceValue !== undefined) {
        if (typeof sourceValue === 'object' && !Array.isArray(sourceValue) && sourceValue !== null) {
          // Recursively merge objects
          result[key] = deepMerge(result[key], sourceValue);
        } else {
          // Replace arrays and primitives
          result[key] = sourceValue;
        }
      }
    }
  }

  return result;
}