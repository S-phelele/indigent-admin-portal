import Icon from './ui/Icon';
import { deriveFromId } from '../utils/idNumber';

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

export default function DerivedIdentity({ idNumber }) {
  const derived = deriveFromId(idNumber);
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
          <div><dt>Date of birth</dt><dd>{derived.dateOfBirthLabel}</dd></div>
          <div><dt>Age</dt><dd>{derived.age}</dd></div>
          <div><dt>Sex</dt><dd>{derived.sex}</dd></div>
        </dl>
        <p>If any of this is wrong, check the ID number above — it means a digit was mistyped.</p>
      </div>
    </div>
  );
}
