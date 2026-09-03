/**
 * Date of birth, age and sex, read from a South African ID number.
 *
 * All three are encoded in the first ten digits, so anywhere the portal asks
 * for one of them separately from an ID number, this is what should fill it
 * in rather than asking twice. Mirrors src/lib/saIdNumber.js on the server,
 * which is the version that actually decides what gets saved — this one only
 * drives what the browser shows before that round trip happens.
 */

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** `{ dateOfBirth, dateOfBirthLabel, age, sex }`, or `null` if the number cannot be read. */
export function deriveFromId(idNumber) {
  const digits = String(idNumber || '').replace(/\D/g, '');
  if (digits.length !== 13) return null;

  const yy = Number(digits.slice(0, 2));
  const mm = Number(digits.slice(2, 4));
  const dd = Number(digits.slice(4, 6));
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;

  const currentYY = new Date().getFullYear() % 100;
  const century = yy <= currentYY ? 2000 : 1900;
  const birth = new Date(Date.UTC(century + yy, mm - 1, dd));

  // Rejects impossible dates such as 31 February, which roll over.
  if (birth.getUTCMonth() !== mm - 1 || birth.getUTCDate() !== dd) return null;
  if (birth.getTime() > Date.now()) return null;

  const now = new Date();
  let age = now.getFullYear() - birth.getUTCFullYear();
  const monthDiff = now.getMonth() - birth.getUTCMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getUTCDate())) age -= 1;

  return {
    dateOfBirth: birth,
    dateOfBirthLabel: `${birth.getUTCDate()} ${MONTHS[birth.getUTCMonth()]} ${birth.getUTCFullYear()}`,
    age,
    sex: Number(digits.slice(6, 10)) < 5000 ? 'Female' : 'Male',
  };
}
