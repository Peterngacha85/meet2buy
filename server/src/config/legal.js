// Version of the Terms of Use & Privacy Policy shown at sign-up. Change it (the date of the new text)
// whenever the wording on /terms or /privacy changes, so we know which version each account accepted.
export const TERMS_VERSION = '2026-11-16';

export const consent = () => ({ termsAcceptedAt: new Date(), termsVersion: TERMS_VERSION });
