import { parsePhoneNumberFromString } from "libphonenumber-js";

// Only interpret numbers with an explicit, valid international dialing code.
// A national number alone does not identify the account's country.
export function internationalPhone(value: string) {
  const raw = value.trim();
  if (!raw) return "";
  const digits = raw.replace(/[\s().-]/g, "");
  const candidate = digits.startsWith("00") ? `+${digits.slice(2)}` : digits.startsWith("+") ? digits : `+${digits}`;
  const parsed = parsePhoneNumberFromString(candidate);
  return parsed?.isValid() ? parsed.number.toString() : raw;
}

export function displayPhone(value: string) {
  const normalized = internationalPhone(value);
  const parsed = normalized.startsWith("+") ? parsePhoneNumberFromString(normalized) : undefined;
  return parsed?.isValid() ? parsed.formatInternational() : normalized;
}