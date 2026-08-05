/**
 * Uppercases the first non-whitespace character of `value`, leaving everything else as it is.
 *
 * `\S` rather than `charAt(0)` because ManicTime cells keep their padding — `handleCsvData`
 * trims whole lines, not individual cells — and the `u` flag so an astral first character is
 * matched as one code point instead of a lone surrogate half. A string that is empty, all
 * whitespace, or starts with a caseless character has no effective match and is returned
 * unchanged.
 */
function capitalizeFirstLetter(value: string): string {
  return value.replace(/\S/u, (character) => character.toUpperCase());
}

export default capitalizeFirstLetter;
