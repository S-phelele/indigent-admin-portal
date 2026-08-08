import Icon from './ui/Icon';

/**
 * The Washington Group Short Set on Functioning.
 *
 * Six questions, one scale. This is the international standard instrument and
 * the same wording Statistics South Africa uses in the Census, which is what
 * makes the municipality's disability figures comparable with national data
 * rather than being a number only this system understands.
 *
 * ## Why it never says "disability"
 *
 * Asking "are you disabled?" gets an inconsistent answer. Many people with
 * substantial functional limitations do not describe themselves that way, and
 * the word carries a stigma that suppresses honest answers. Asking whether
 * somebody has difficulty walking gets the truth from the same person.
 *
 * So the questions ask about difficulty, the heading says "how you manage day
 * to day", and whether that amounts to a disability is worked out afterwards —
 * on the server, from the answers, and never shown back as a verdict on the
 * person answering.
 */

const SCALE = [
  { value: 'NO_DIFFICULTY', label: 'No difficulty' },
  { value: 'SOME_DIFFICULTY', label: 'Some difficulty' },
  { value: 'A_LOT_OF_DIFFICULTY', label: 'A lot of difficulty' },
  { value: 'CANNOT_DO_AT_ALL', label: 'Cannot do it at all' },
];

const DOMAINS = [
  { field: 'difficultySeeing', label: 'Seeing', question: 'Do you have difficulty seeing, even if wearing glasses?' },
  { field: 'difficultyHearing', label: 'Hearing', question: 'Do you have difficulty hearing, even if using a hearing aid?' },
  { field: 'difficultyWalking', label: 'Walking', question: 'Do you have difficulty walking or climbing steps?' },
  { field: 'difficultyRemembering', label: 'Remembering', question: 'Do you have difficulty remembering or concentrating?' },
  { field: 'difficultySelfCare', label: 'Self-care', question: 'Do you have difficulty with self-care, such as washing all over or dressing?' },
  {
    field: 'difficultyCommunicating',
    label: 'Communicating',
    question: 'Using your usual language, do you have difficulty communicating — for example understanding or being understood?',
  },
];

export default function FunctioningQuestions({ form, update, readOnly = false }) {
  const answered = DOMAINS.filter((d) => form[d.field]).length;

  return (
    <div className="functioning">
      <p className="field-hint">
        These six questions help the municipality understand how you manage day to day. They are the same questions
        Statistics South Africa asks in the census. Answer for yourself, as you normally are — with your glasses or
        hearing aid if you use them.
      </p>

      {DOMAINS.map((domain) => (
        <fieldset className="functioning-item" key={domain.field}>
          <legend>
            <span className="functioning-label">{domain.label}</span>
            <span className="functioning-question">{domain.question}</span>
          </legend>

          <div className="functioning-options">
            {SCALE.map((option) => (
              <label
                key={option.value}
                className={`functioning-option${form[domain.field] === option.value ? ' selected' : ''}`}
              >
                <input
                  type="radio"
                  name={domain.field}
                  value={option.value}
                  checked={form[domain.field] === option.value}
                  onChange={() => update(domain.field, option.value)}
                  disabled={readOnly}
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
        </fieldset>
      ))}

      <p className={`functioning-progress${answered === DOMAINS.length ? ' complete' : ''}`}>
        <Icon name={answered === DOMAINS.length ? 'check' : 'info'} size={15} />
        <span>
          {answered === DOMAINS.length
            ? 'All six answered, thank you.'
            : `${answered} of ${DOMAINS.length} answered. You can leave any of these blank if you prefer not to say.`}
        </span>
      </p>
    </div>
  );
}
