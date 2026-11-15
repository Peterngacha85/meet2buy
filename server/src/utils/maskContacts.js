// Doc 07 §6 / doc 02 rule 5: phone numbers and links never appear in public chat, so sales stay on the platform.

// Kenyan numbers: 07xx/01xx (10 digits), 2547xx/2541xx, +254…, with optional spaces, dots or dashes between digits.
const PHONE = /(?:\+?\s*254|\b0)[\s.-]*[17](?:[\s.-]*\d){8}\b/g;
// Any other run of 9+ digits (with separators) is very likely a number too.
const LONG_DIGITS = /\d(?:[\s.-]*\d){8,}/g;
// Links: http(s)://, www., or a bare domain with a common TLD.
const URL =
  /\b(?:https?:\/\/|www\.)\S+|\b[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:com|co\.ke|ke|net|org|io|app|shop|store|info|biz|link)\b(?:\/\S*)?/gi;
// Emails.
const EMAIL = /\b[\w.+-]+@[\w-]+(?:\.[\w-]+)+\b/g;

export const MASK = '•••';

export function maskContacts(text) {
  return text.replace(EMAIL, MASK).replace(URL, MASK).replace(PHONE, MASK).replace(LONG_DIGITS, MASK);
}
