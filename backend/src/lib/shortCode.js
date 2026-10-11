import { customAlphabet } from 'nanoid';

// 7 random characters from a base62 alphabet gives 62^7 (about 3.5 trillion)
// possible codes. Random codes cannot be guessed the way sequential ones can.
export const CODE_LENGTH = 7;
export const ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

const CODE_PATTERN = new RegExp(`^[0-9A-Za-z]{${CODE_LENGTH}}$`);

export const generateCode = customAlphabet(ALPHABET, CODE_LENGTH);

// True if the value could be a code we generated. Used to answer 404 for
// obviously wrong paths without querying the database.
export function isValidCode(value) {
  return typeof value === 'string' && CODE_PATTERN.test(value);
}
