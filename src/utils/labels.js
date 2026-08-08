/**
 * Human names for every stored value.
 *
 * The database stores SCREAMING_SNAKE_CASE because that is what an enum column
 * wants. Nobody using this system should ever see it. "VERIFICATION_OFFICER",
 * "SITE_VISIT_FAILED" and "DECEASED_ESTATE" are our internal vocabulary; a
 * municipal official reading a screen wants "Verification Officer", "Site visit
 * could not be completed" and "Deceased estate".
 *
 * Everything lives here rather than being formatted at each use, so a value
 * cannot be labelled two different ways on two pages — and so adding a new enum
 * value has one obvious place to name it.
 */

export const ROLE = {
  APPLICANT: 'Applicant',
  ADMIN: 'Administrator',
  COUNCILLOR: 'Ward Councillor',
  CAPTURE_OFFICER: 'Capture Officer',
  VERIFICATION_OFFICER: 'Verification Officer',
  ASSESSMENT_OFFICER: 'Assessment Officer',
  SUPERVISOR: 'Supervisor',
};

export const APPROVAL_STAGE = {
  NOT_SUBMITTED: 'Not submitted',
  VERIFICATION: 'Verification',
  ASSESSMENT: 'Assessment',
  SUPERVISOR_SIGNOFF: 'Sign-off',
  COMPLETE: 'Complete',
};

export const MEANS_TEST = {
  QUALIFIES: 'Qualifies',
  ABOVE_THRESHOLD: 'Above the threshold',
  INSUFFICIENT_DATA: 'Not enough information',
};

export const RENEWAL = {
  NOT_APPLICABLE: '',
  ACTIVE: 'Active',
  DUE_SOON: 'Due soon',
  OVERDUE: 'Overdue',
  LAPSED: 'Lapsed',
};

export const STEP_OUTCOME = {
  PENDING: 'In progress',
  RECOMMEND_APPROVE: 'Recommended approval',
  RECOMMEND_REJECT: 'Recommended refusal',
  APPROVED: 'Approved',
  REJECTED: 'Declined',
  RETURNED: 'Sent back',
};

export const STATUS = {
  DRAFT: 'Not submitted',
  PENDING: 'Awaiting review',
  APPROVED: 'Approved',
  DECLINED: 'Not approved',
};

export const EMPLOYMENT = {
  EMPLOYED: 'Employed',
  UNEMPLOYED: 'Unemployed',
  SELF_EMPLOYED: 'Self-employed',
  PENSIONER: 'Pensioner',
  OTHER: 'Other',
};

export const MARITAL = {
  SINGLE: 'Single',
  MARRIED: 'Married',
  DIVORCED: 'Divorced',
  WIDOWED: 'Widowed',
  SEPARATED: 'Separated',
};

export const TENURE = {
  OWNER: 'Owner',
  TENANT: 'Tenant',
  OCCUPIER: 'Occupier',
};

export const CATEGORY = {
  STANDARD: 'Standard',
  PENSIONER: 'Pensioner',
  DECEASED_ESTATE: 'Deceased estate',
  CHILD_HEADED: 'Child-headed household',
  DISABLED: 'Person with a disability',
};

export const CHANNEL = {
  SELF: 'Applied themselves',
  COUNCILLOR: 'Captured by a councillor',
  ADMIN: 'Captured at the office',
};

export const VERIFICATION_STAGE = {
  NOT_STARTED: 'Not started',
  IN_VERIFICATION: 'Being checked',
  AWAITING_INFORMATION: 'Waiting on the applicant',
  RECOMMENDED: 'Recommendation made',
  COMPLETE: 'Complete',
};

export const VISIT_OUTCOME = {
  SCHEDULED: 'Scheduled',
  VERIFIED: 'Household confirmed',
  NO_ACCESS: 'Could not gain access',
  OCCUPANT_ABSENT: 'Nobody home',
  ADDRESS_NOT_FOUND: 'Address not found',
  DETAILS_DISPUTED: 'Details do not match',
};

export const CHECK_SOURCE = {
  SARS: 'SARS',
  UIF: 'UIF',
  SASSA: 'SASSA',
  CREDIT_BUREAU: 'Credit bureau',
  DEEDS_OFFICE: 'Deeds office',
  MUNICIPAL_ACCOUNT: 'Municipal account',
  OTHER: 'Other',
};

export const CHECK_OUTCOME = {
  PASS: 'Consistent',
  FAIL: 'Contradicts the declaration',
  INCONCLUSIVE: 'Inconclusive',
  NOT_APPLICABLE: 'Not applicable',
};

export const RECOMMENDATION = {
  APPROVE: 'Approve',
  REJECT: 'Reject',
  ESCALATE: 'Escalate',
};

export const DOCUMENT_TYPE = {
  ID_COPY: 'ID copy',
  BANK_STATEMENTS: 'Bank statements',
  AFFIDAVIT: 'Affidavit',
  PROOF_OF_GRANT: 'Proof of grant',
  PROOF_OF_INCOME: 'Proof of income',
  COPY_OF_DEATH_CERT: 'Death certificate',
  LETTER_OF_AUTHORITY: 'Letter of authority',
  PROOF_OF_OWNERSHIP: 'Proof of ownership',
  LEASE_AGREEMENT: 'Lease agreement',
  MUNICIPAL_STATEMENT: 'Municipal statement',
  BIRTH_CERTIFICATE: 'Birth certificate',
  GUARDIANSHIP_ORDER: 'Guardianship order',
  SOCIAL_WORKER_LETTER: 'Social worker letter',
  DIVORCE_DECREE: 'Divorce decree',
  MARRIAGE_CERTIFICATE: 'Marriage certificate',
  DISABILITY_CERTIFICATE: 'Disability certificate',
  COUNCILLOR_MOTIVATION: 'Councillor motivation',
  OTHER: 'Other',
};

/** What each audit action means, written as a past-tense event. */
export const AUDIT_ACTION = {
  LOGIN: 'Signed in',
  REGISTER: 'Registered',
  PASSWORD_RESET: 'Reset a password',
  PASSWORD_CHANGE: 'Changed a password',
  VIEW_APPLICATION: 'Opened an application',
  APPROVE_APPLICATION: 'Approved an application',
  DECLINE_APPLICATION: 'Declined an application',
  EXPORT_APPLICANTS: 'Exported applicants',
  EXPORT_APPLICATIONS: 'Exported applications',
  REJECT_DOCUMENT: 'Rejected a document',
  ACCEPT_DOCUMENT: 'Accepted a document',
  CREATE_APPLICANT: 'Created an applicant',
  UPDATE_APPLICANT: 'Updated an applicant',
  DELETE_APPLICANT: 'Deleted an applicant',
  CREATE_APPLICATION: 'Created an application',
  UPDATE_APPLICATION: 'Updated an application',
  DELETE_APPLICATION: 'Deleted an application',
  CREATE_COUNCILLOR: 'Created a staff member',
  UPDATE_COUNCILLOR: 'Updated a staff member',
  DEACTIVATE_COUNCILLOR: 'Deactivated a staff member',
  DELETE_COUNCILLOR: 'Deleted a staff member',
  RESET_STAFF_PASSWORD: 'Issued a new staff password',
  FIELD_REGISTER_RESIDENT: 'Registered a household in the field',
  FIELD_CAPTURE_APPLICATION: 'Started a field capture',
  FIELD_SUBMIT_APPLICATION: 'Submitted a field capture',
  SITE_VISIT: 'Recorded a site visit',
  VERIFICATION_CHECK: 'Recorded an external check',
  RECOMMEND_APPLICATION: 'Made a recommendation',
  REQUEST_INFORMATION: 'Asked the applicant for more',
  ASSESS_APPLICATION: 'Completed a means test',
  RETURN_APPLICATION: 'Sent an application back',
  SIGN_OFF_APPLICATION: 'Signed an application off',
  RENEW_REGISTRATION: 'Renewed a registration',
  RENEWAL_CHECK: 'Ran the re-verification check',
  PRINT_APPLICATION: 'Printed an application',
};

/** What each SMS was for. */
export const SMS_PURPOSE = {
  WELCOME: 'Welcome',
  WELCOME_CREDENTIALS: 'Sign-in details',
  PASSWORD_RESET_STAFF: 'Staff password reset',
  APPLICATION_SUBMITTED: 'Application received',
  CAPTURED_BY_COUNCILLOR: 'Captured in the field',
  APPLICATION_APPROVED: 'Approved',
  APPLICATION_DECLINED: 'Not approved',
  APPLICATION_REOPENED: 'Reopened',
  DOCUMENT_REJECTED: 'Document rejected',
  SITE_VISIT_SCHEDULED: 'Site visit arranged',
  SITE_VISIT_FAILED: 'Site visit could not be completed',
  INFORMATION_REQUESTED: 'More information needed',
  OTP: 'Verification code',
  PASSWORD_RESET: 'Password reset',
  GENERAL: 'General',
};

export const SMS_STATUS = {
  SENT: 'Sent',
  FAILED: 'Failed',
  QUEUED: 'Queued',
};

/**
 * Look up a label, falling back to something readable rather than the raw value.
 *
 * The fallback matters: a value added to the database before it is added here
 * should read as "Deceased estate", not "DECEASED_ESTATE". Getting the label
 * wrong is a small problem; showing somebody an enum is a visible defect.
 */
export function label(map, value, fallback = '—') {
  if (value === null || value === undefined || value === '') return fallback;
  if (map && map[value]) return map[value];
  return humanise(value);
}

/** SCREAMING_SNAKE_CASE → Sentence case. The last-resort formatter. */
export function humanise(value) {
  const s = String(value);
  if (!/^[A-Z0-9_]+$/.test(s)) return s;
  const words = s.toLowerCase().replace(/_/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export default {
  APPROVAL_STAGE, MEANS_TEST, RENEWAL, STEP_OUTCOME,
  ROLE, STATUS, EMPLOYMENT, MARITAL, TENURE, CATEGORY, CHANNEL,
  VERIFICATION_STAGE, VISIT_OUTCOME, CHECK_SOURCE, CHECK_OUTCOME,
  RECOMMENDATION, DOCUMENT_TYPE, AUDIT_ACTION, SMS_PURPOSE, SMS_STATUS,
  label, humanise,
};
