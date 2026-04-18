/**
 * Pattern-based ecosystem detection for package names.
 *
 * When a package's `os`/ecosystem field is missing from the datastore,
 * we can often infer it just from the name's format:
 *  - "org.bouncycastle:bcprov-jdk14" → Maven (group:artifact)
 *  - "@scope/pkg"                   → npm
 *  - "github.com/user/repo"         → Go
 *  - "Django"                       → likely PyPI (capitalized, no separators)
 *
 * Returns a canonical ecosystem key matching keys in LANGUAGE_REGISTRY
 * (e.g. 'maven', 'npm', 'pypi', 'go', 'rust', 'rubygems', 'composer',
 *  'nuget', 'pub', 'hex', 'crates.io').
 *
 * Returns null when no confident guess can be made.
 */
export type EcosystemGuess = {
  /** Lowercase key matching LANGUAGE_REGISTRY in EntityReferencePage. */
  key: string;
  /** Why we matched (for debugging / tooltip). */
  reason: string;
};

export const detectEcosystemFromName = (rawName: string): EcosystemGuess | null => {
  if (!rawName) return null;
  const name = rawName.trim();
  if (!name) return null;

  // Maven: group:artifact (and optionally :version). Group has dots, artifact doesn't need them.
  // e.g. "org.bouncycastle:bcprov-jdk14", "com.google.guava:guava"
  if (/^[a-zA-Z0-9_.-]+:[a-zA-Z0-9_.\-]+(:[^:]+)?$/.test(name) && name.includes('.') && name.includes(':')) {
    return { key: 'maven', reason: 'Maven group:artifact format' };
  }

  // npm scoped package: @scope/name
  if (/^@[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._-]*$/i.test(name)) {
    return { key: 'npm', reason: 'npm scoped package (@scope/name)' };
  }

  // Go module: hosted on a known forge (github.com/, gitlab.com/, gopkg.in/, golang.org/x/)
  if (/^(github\.com|gitlab\.com|bitbucket\.org|gopkg\.in|golang\.org|google\.golang\.org|k8s\.io|sigs\.k8s\.io)\//i.test(name)) {
    return { key: 'go', reason: 'Go module path (hosted import path)' };
  }

  // Composer / PHP: vendor/package, all lowercase, no @ prefix
  // e.g. "symfony/console", "guzzlehttp/guzzle"
  if (/^[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._-]*$/.test(name) && !name.includes('@')) {
    return { key: 'composer', reason: 'Composer vendor/package format' };
  }

  // NuGet / .NET: PascalCase dotted namespace, e.g. "Newtonsoft.Json", "Microsoft.AspNetCore.App"
  if (/^[A-Z][A-Za-z0-9]*(\.[A-Z][A-Za-z0-9]*)+$/.test(name)) {
    return { key: 'dotnet', reason: '.NET PascalCase dotted namespace' };
  }

  // Python PyPI common patterns:
  //  - lowercase with hyphens: "requests", "django-rest-framework"
  //  - underscore segments: "boto3", "scikit_learn"
  //  - common prefixes: py-, pytest-, flask-, django-
  if (/^(py|pytest|flask|django|sqlalchemy)[-_]/i.test(name)) {
    return { key: 'pypi', reason: 'Common Python package prefix' };
  }

  // Rust crate convention: lowercase, hyphens, no slashes/colons/dots.
  if (/^[a-z][a-z0-9_-]*$/.test(name) && name.includes('-')) {
    // Ambiguous with npm/pypi single names; only guess Rust on common crate names.
    // Default to npm since it's the most common single-word package registry.
    return { key: 'npm', reason: 'Lowercase hyphenated single word (defaulting to npm)' };
  }

  // Bare lowercase word — could be npm, pypi, rubygems. Default to npm (largest registry).
  if (/^[a-z][a-z0-9_]*$/.test(name)) {
    return { key: 'npm', reason: 'Lowercase single word (defaulting to npm)' };
  }

  return null;
};
