import { customAlphabet } from 'nanoid';

// 7 random characters from a base62 alphabet gives 62^7 (about 3.5 trillion)
// possible codes. Random codes cannot be guessed the way sequential ones can.
export const CODE_LENGTH = 7;
export const ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

// Codes that would clash with a route registered before the redirect router.
// "metrics" is exactly 7 base62 characters, so nanoid could generate it.
export const RESERVED_CODES = new Set(['metrics']);

const CODE_PATTERN = new RegExp(`^[0-9A-Za-z]{${CODE_LENGTH}}$`);
const randomCode = customAlphabet(ALPHABET, CODE_LENGTH);

// True if the code clashes with a route. Compared in lower case, so
// "Metrics" or "METRICS" are never handed out either.
export function isReservedCode(code) {
  return RESERVED_CODES.has(code.toLowerCase());
}

// Returns a random code that is never a reserved word. The random source
// can be swapped in tests to force a reserved code.
export function generateCode(nextRandom = randomCode) {
  let code;
  do {
    code = nextRandom();
  } while (isReservedCode(code));
  return code;
}

// True if the value could be a code we generated. Used to answer 404 for
// obviously wrong paths without querying the database.
export function isValidCode(value) {
  return typeof value === 'string' && CODE_PATTERN.test(value);
}
