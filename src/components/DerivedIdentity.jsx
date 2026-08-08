import Icon from './ui/Icon';

/**
 * Date of birth, age and sex, read back from the ID number.
 *
 * All three are encoded in the first ten digits of a South African ID, so
 * asking for them separately would only create a second answer to contradict
 * the first — and one more thing to get wrong on a form somebody may already be
 * finding difficult.
 *
 * Shown rather than hidden, because an applicant needs to be able to see that
 * we read their ID correctly. A wrong date of birth here means a mistyped digit
 * in the number above, and catching that at capture is far cheaper than
 * catching it at verification.
 *
 * Purely presentational: the server derives these itself on save and never
 * accepts them from the browser.
 */

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** Mirrors src/lib/functioning.js on the server. Kept simple deliberately. */
function derive(idNumber) {
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
    dateOfBirth: `${birth.getUTCDate()} ${MONTHS[birth.getUTCMonth()]} ${birth.getUTCFullYear()}`,
    age,
    sex: Number(digits.slice(6, 10)) < 5000 ? 'Female' : 'Male',
  };
}

export default function DerivedIdentity({ idNumber }) {
  const derived = derive(idNumber);
  const entered = String(idNumber || '').replace(/\D/g, '').length;

  if (!entered) return null;

  if (!derived) {
    // Only complain once they have typed enough that it should have worked.
    if (entered < 13) return null;
    return (
      <p className="derived-identity is-warn">
        <Icon name="alert" size={15} />
        <span>We could not read a date of birth from that ID number. Please check it.</span>
      </p>
    );
  }

  return (
    <div className="derived-identity">
      <Icon name="check" size={15} />
      <div>
        <strong>From your ID number</strong>
        <dl>
          <div><dt>Date of birth</dt><dd>{derived.dateOfBirth}</dd></div>
          <div><dt>Age</dt><dd>{derived.age}</dd></div>
          <div><dt>Sex</dt><dd>{derived.sex}</dd></div>
        </dl>
        <p>If any of this is wrong, check the ID number above — it means a digit was mistyped.</p>
      </div>
    </div>
  );
}
