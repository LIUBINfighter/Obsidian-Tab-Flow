let _deprecationWarned = false;

/**
 * @deprecated These helpers are legacy and unused by runtime code. They are kept for
 * backward compatibility with tests and external callers. Prefer using explicit
 * extension lists in calling code instead of these helpers.
 */
export function isGuitarProFile(extension: string | undefined): boolean {
  if (!_deprecationWarned) {
    console.warn('[DEPRECATED] isGuitarProFile is deprecated and may be removed in a future release.');
    _deprecationWarned = true;
  }
  if (!extension) return false;
  return ["gp", "gp3", "gp4", "gp5", "gpx", "gp7"].includes(
    extension.toLowerCase()
  );
}

/**
 * @deprecated See `isGuitarProFile` deprecation note.
 */
export function isAlphaTexFile(extension: string | undefined): boolean {
  if (!_deprecationWarned) {
    console.warn('[DEPRECATED] isAlphaTexFile is deprecated and may be removed in a future release.');
    _deprecationWarned = true;
  }
  if (!extension) return false;
  return ["alphatab", "alphatex"].includes(extension.toLowerCase());
}

/**
 * @deprecated Convenience wrapper for the two deprecated helpers above.
 */
export function isSupportedTabFile(extension: string | undefined): boolean {
  if (!_deprecationWarned) {
    console.warn('[DEPRECATED] isSupportedTabFile is deprecated and may be removed in a future release.');
    _deprecationWarned = true;
  }
  return isGuitarProFile(extension) || isAlphaTexFile(extension);
}
