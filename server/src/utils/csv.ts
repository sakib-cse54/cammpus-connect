const FORMULA_PREFIX = /^[=+\-@\t\r]/;

/**
 * Escapes one CSV cell: neutralizes spreadsheet formulas by prefixing a
 * single quote when the value starts with = + - @ (or tab/CR), doubles
 * embedded quotes and always wraps the cell in quotes.
 */
export function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? '' : String(value);
  const safe = FORMULA_PREFIX.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
}

export function csvRow(values: readonly unknown[]): string {
  return values.map(csvCell).join(',');
}
