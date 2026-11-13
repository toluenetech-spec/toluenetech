/**
 * Lightweight runtime validation helpers. No external dependency.
 *
 * Each validator returns { ok: true, value } or { ok: false, field, message }.
 * Use `shape()` to validate an entire request body against a schema map.
 */
export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; field: string; message: string };

export type Validator<T> = (raw: unknown, field?: string) => ValidationResult<T>;

export const v = {
  string(opts: { min?: number; max?: number; optional?: boolean; match?: RegExp; trim?: boolean } = {}): Validator<string | undefined> {
    return (raw, field = 'value') => {
      if (raw === undefined || raw === null || raw === '') {
        if (opts.optional) return { ok: true, value: undefined };
        return { ok: false, field, message: `${field} is required` };
      }
      if (typeof raw !== 'string') return { ok: false, field, message: `${field} must be a string` };
      let s = raw;
      if (opts.trim !== false) s = s.trim();
      if (opts.min != null && s.length < opts.min) return { ok: false, field, message: `${field} must be at least ${opts.min} characters` };
      if (opts.max != null && s.length > opts.max) return { ok: false, field, message: `${field} must be at most ${opts.max} characters` };
      if (opts.match && !opts.match.test(s)) return { ok: false, field, message: `${field} has an invalid format` };
      return { ok: true, value: s };
    };
  },
  email(opts: { optional?: boolean; max?: number } = {}): Validator<string | undefined> {
    const base = v.string({ optional: opts.optional, max: opts.max ?? 240, match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ });
    return (raw, field = 'email') => {
      const r = base(raw, field);
      if (!r.ok) return { ok: false, field, message: `${field} must be a valid email address` };
      return r;
    };
  },
  uuid(opts: { optional?: boolean } = {}): Validator<string | undefined> {
    return (raw, field = 'id') => {
      if (raw === undefined || raw === null || raw === '') {
        if (opts.optional) return { ok: true, value: undefined };
        return { ok: false, field, message: `${field} is required` };
      }
      if (typeof raw !== 'string') return { ok: false, field, message: `${field} must be a UUID` };
      if (!/^[0-9a-fA-F-]{36}$/.test(raw)) return { ok: false, field, message: `${field} must be a valid UUID` };
      return { ok: true, value: raw };
    };
  },
  bool(opts: { optional?: boolean } = {}): Validator<boolean | undefined> {
    return (raw, field = 'value') => {
      if (raw === undefined || raw === null) {
        if (opts.optional) return { ok: true, value: undefined };
        return { ok: false, field, message: `${field} is required` };
      }
      if (typeof raw !== 'boolean') return { ok: false, field, message: `${field} must be a boolean` };
      return { ok: true, value: raw };
    };
  },
  int(opts: { min?: number; max?: number; optional?: boolean; coerce?: boolean } = {}): Validator<number | undefined> {
    return (raw, field = 'value') => {
      if (raw === undefined || raw === null || raw === '') {
        if (opts.optional) return { ok: true, value: undefined };
        return { ok: false, field, message: `${field} is required` };
      }
      let n: number;
      if (opts.coerce && typeof raw === 'string') n = parseInt(raw, 10);
      else if (typeof raw === 'number') n = raw;
      else return { ok: false, field, message: `${field} must be an integer` };
      if (!Number.isFinite(n) || !Number.isInteger(n)) return { ok: false, field, message: `${field} must be an integer` };
      if (opts.min != null && n < opts.min) return { ok: false, field, message: `${field} must be >= ${opts.min}` };
      if (opts.max != null && n > opts.max) return { ok: false, field, message: `${field} must be <= ${opts.max}` };
      return { ok: true, value: n };
    };
  },
  enumValue<T extends string>(allowed: readonly T[], opts: { optional?: boolean } = {}): Validator<T | undefined> {
    return (raw, field = 'value') => {
      if (raw === undefined || raw === null || raw === '') {
        if (opts.optional) return { ok: true, value: undefined };
        return { ok: false, field, message: `${field} is required` };
      }
      if (typeof raw !== 'string' || !(allowed as readonly string[]).includes(raw)) {
        return { ok: false, field, message: `${field} must be one of ${allowed.join(', ')}` };
      }
      return { ok: true, value: raw as T };
    };
  },
  array<V>(item: Validator<V>, opts: { max?: number; optional?: boolean } = {}): Validator<V[] | undefined> {
    return (raw, field = 'items') => {
      if (raw === undefined || raw === null) {
        if (opts.optional) return { ok: true, value: undefined };
        return { ok: false, field, message: `${field} is required` };
      }
      if (!Array.isArray(raw)) return { ok: false, field, message: `${field} must be an array` };
      if (opts.max != null && raw.length > opts.max) return { ok: false, field, message: `${field} must have at most ${opts.max} items` };
      const out: V[] = [];
      for (let i = 0; i < raw.length; i++) {
        const r = item(raw[i], `${field}[${i}]`);
        if (!r.ok) return r;
        if (r.value !== undefined) out.push(r.value);
      }
      return { ok: true, value: out };
    };
  },
  any(opts: { optional?: boolean } = {}): Validator<unknown> {
    return (raw, field = 'value') => {
      if (raw === undefined || raw === null) {
        if (opts.optional) return { ok: true, value: undefined };
        return { ok: false, field, message: `${field} is required` };
      }
      return { ok: true, value: raw };
    };
  },
};

export function shape<T extends Record<string, Validator<any>>>(
  schema: T,
  body: unknown,
): ValidationResult<{ [K in keyof T]: T[K] extends Validator<infer V> ? V : never }> {
  if (!body || typeof body !== 'object') {
    return { ok: false, field: '_body', message: 'Request body must be a JSON object' };
  }
  const out: any = {};
  for (const key of Object.keys(schema)) {
    const r = schema[key]((body as any)[key], key);
    if (!r.ok) return r as ValidationResult<any>;
    if (r.value !== undefined) out[key] = r.value;
  }
  return { ok: true, value: out };
}

/**
 * Field whitelist helper: return a copy of `input` containing only the keys
 * explicitly listed in `allowed`. Prevents mass-assignment of e.g. `id`,
 * `createdAt`, `role`, or internal flags from request bodies.
 */
export function pick(input: Record<string, unknown>, allowed: readonly (string | number | symbol)[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of allowed) {
    const key = String(k);
    if (Object.prototype.hasOwnProperty.call(input, key) && (input as any)[key] !== undefined) out[key] = (input as any)[key];
  }
  return out;
}
