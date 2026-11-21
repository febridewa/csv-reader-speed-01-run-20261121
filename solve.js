// Fast drop-in for csv-reader 1.0.0 (make.fun's own CSV reader).
//
// Same answers as the reference on every input, produced the fast way: the
// reference walks the text one character at a time and builds each field a
// character at a time; this module instead cuts fields out of the text with
// indexOf/slice, and takes a split(',') fast path for a whole record line
// that holds no quote and no stray CR. Every edge case of the reference is
// kept exactly: BOM, LF/CRLF, stray CR (dropped, error stray_cr), quoted
// fields ("" -> ", CRLF/lone CR inside -> LF), quote_junk after a closing
// quote, unterminated_quote (the quote becomes literal and the rest is read
// again as unquoted, with the line count rewound), quotes as literals inside
// unquoted fields, blank lines as no record, short_row/long_row padding and
// cutting to the first record's width, and errors {code, line, row} in the
// order met, line the 1-based line the record starts on.
//
// Ended codes: 0 = at a comma (the record goes on), 1 = at a line break
// (the record ends), 2 = at the end of the text (the record ends).

const COMMA = 0;
const LINE_BREAK = 1;
const END = 2;

/** The next field delimiter: a comma, a line feed or a carriage return (sticky: one scan finds it). */
const DELIM = /[,\n\r]/g;

/** csv-reader 1.0.0's answer for one case's input, {columns, rows, errors}. */
export function run(input) {
  const text = String(input.text);
  const header = input.header === true;
  const errors = [];
  const rows = [];
  let columns = null;
  let width = -1;

  const len = text.length;
  let pos = 0; // the next character to read
  let line = 1; // the line that character is on
  if (text.charCodeAt(0) === 0xfeff) pos = 1;

  // The record being read: the line it starts on and the index in rows it takes (null: the header).
  let recordLine = 1;
  let recordRow = null;

  function error(code) {
    errors.push({ code, line: recordLine, row: recordRow });
  }

  // Reads unquoted characters onto `value` up to the next comma or line break: a CR not followed by LF is dropped
  // (stray_cr). Returns the field and how it ended; `added` counts the characters kept.
  function readUnquoted(value) {
    let added = 0;
    for (;;) {
      DELIM.lastIndex = pos;
      const m = DELIM.exec(text);
      if (m === null) {
        if (pos < len) {
          value += text.slice(pos);
          added += len - pos;
          pos = len;
        }
        return { value, ended: END, added };
      }
      const idx = m.index;
      const ch = m[0];
      if (ch === ',') {
        value += text.slice(pos, idx);
        added += idx - pos;
        pos = idx + 1;
        return { value, ended: COMMA, added };
      }
      if (ch === '\n') {
        value += text.slice(pos, idx);
        added += idx - pos;
        pos = idx + 1;
        line += 1;
        return { value, ended: LINE_BREAK, added };
      }
      // A CR: a line break when followed by LF, else a dropped stray CR.
      if (text.charCodeAt(idx + 1) === 10) {
        value += text.slice(pos, idx);
        added += idx - pos;
        pos = idx + 2;
        line += 1;
        return { value, ended: LINE_BREAK, added };
      }
      value += text.slice(pos, idx);
      added += idx - pos;
      error('stray_cr');
      pos = idx + 1;
    }
  }

  // Reads a quoted field whose opening quote is at pos.
  function readQuoted() {
    const open = pos;
    const openLine = line;
    // The closing quote is the first quote not doubled by another right after it.
    let q = text.indexOf('"', pos + 1);
    while (q !== -1 && text.charCodeAt(q + 1) === 34) q = text.indexOf('"', q + 2);
    if (q === -1) {
      // The quote never closes: it is a literal character, and the text after it is read again as unquoted.
      pos = open + 1;
      line = openLine;
      error('unterminated_quote');
      return readUnquoted('"');
    }
    let value = text.slice(open + 1, q);
    // Inside quotes every "" is one quote and every CRLF or lone CR is one LF; each counts one line.
    if (value.indexOf('"') !== -1) value = value.split('""').join('"');
    if (value.indexOf('\r') !== -1) value = value.replace(/\r\n?/g, '\n');
    let i = -1;
    let n = 0;
    while ((i = value.indexOf('\n', i + 1)) !== -1) n += 1;
    line += n;
    pos = q + 1;
    if (pos >= len) return { value, ended: END };
    const cc = text.charCodeAt(pos);
    if (cc === 44) {
      pos += 1;
      return { value, ended: COMMA };
    }
    if (cc === 10) {
      pos += 1;
      line += 1;
      return { value, ended: LINE_BREAK };
    }
    if (cc === 13 && text.charCodeAt(pos + 1) === 10) {
      pos += 2;
      line += 1;
      return { value, ended: LINE_BREAK };
    }
    // What follows the closing quote is appended as it stands, up to the next comma or line break.
    const junk = readUnquoted(value);
    if (junk.added > 0) error('quote_junk');
    return junk;
  }

  while (true) {
    // Lines with no characters are no records.
    while (pos < len) {
      const cc = text.charCodeAt(pos);
      if (cc === 10) {
        pos += 1;
        line += 1;
      } else if (cc === 13 && text.charCodeAt(pos + 1) === 10) {
        pos += 2;
        line += 1;
      } else {
        break;
      }
    }
    if (pos >= len) break;

    recordLine = line;
    recordRow = header && columns === null ? null : rows.length;
    let fields;
    let quoted = false;

    // Fast path: a record line holding no quote and no stray CR is one split(',').
    // (A quote on the line means a quoted field may span lines; a CR other than
    // the CRLF at its end is a stray CR the slow path must drop with its error.)
    const nl = text.indexOf('\n', pos);
    const lineEnd = nl === -1 ? len : nl;
    const qi = text.indexOf('"', pos);
    if (qi === -1 || qi >= lineEnd) {
      const ri = text.indexOf('\r', pos);
      if (ri === -1 || ri >= lineEnd) {
        fields = text.slice(pos, lineEnd).split(',');
        pos = nl === -1 ? len : nl + 1;
        line += 1;
      } else if (ri === lineEnd - 1 && nl !== -1) {
        fields = text.slice(pos, lineEnd - 1).split(',');
        pos = nl + 1;
        line += 1;
      }
    }
    if (fields === undefined) {
      fields = [];
      let field;
      do {
        quoted = text.charCodeAt(pos) === 34;
        field = quoted ? readQuoted() : readUnquoted('');
        fields.push(field.value);
      } while (field.ended === COMMA);
    }

    // A line that held only stray CRs is left with no characters: no record (its stray_cr errors stay).
    if (fields.length === 1 && fields[0] === '' && !quoted) continue;

    if (width < 0) width = fields.length;
    if (header && columns === null) {
      columns = fields;
      continue;
    }
    if (fields.length < width) {
      errors.push({ code: 'short_row', line: recordLine, row: recordRow, fields: fields.length });
      while (fields.length < width) fields.push('');
    } else if (fields.length > width) {
      errors.push({ code: 'long_row', line: recordLine, row: recordRow, extra: fields.splice(width) });
    }
    rows.push(fields);
  }
  return { columns: header ? (columns ?? []) : null, rows, errors };
}
