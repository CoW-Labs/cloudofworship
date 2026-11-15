//! Converts an RTF document to plain text.
//!
//! EasyWorship stores each song's lyrics as an RTF blob (its "Words" memo
//! field) so it can carry per-line formatting this app never needs — just
//! the words. This is a line-for-line Rust port of the backend's
//! `rtf.js` stripper (see worshipcloud-api `src/modules/song/rtf.js`):
//! control words, `\par`/`\line` breaks, `\'XX` hex escapes (decoded per
//! cp1252), `\uNNNN` Unicode escapes, and ignored destinations
//! (font/colour tables, pictures, objects, etc.) are all handled the same
//! way so previously-validated output stays byte-for-byte identical.

use regex::Regex;
use std::sync::OnceLock;

const IGNORED_DESTINATIONS: &[&str] = &[
  "fonttbl", "colortbl", "stylesheet", "info", "pict", "object", "objdata",
  "generator", "header", "footer", "footnote", "listtable", "listoverridetable",
  "revtbl", "rsidtbl", "xmlnstbl", "themedata", "colorschememapping",
  "latentstyles", "datastore", "fldinst", "pgptbl", "panose", "operator",
  "company", "doccomm", "atnid", "atnauthor", "atnref",
];

// \'XX bytes are encoded per the RTF \ansicpgN codepage. Only cp1252 (RTF's
// default "ANSI" codepage, and what EasyWorship/Windows writes) is mapped
// here; anything else passes through as its own byte value.
fn cp1252_high(byte: u8) -> u32 {
  match byte {
    0x80 => 0x20ac,
    0x82 => 0x201a,
    0x83 => 0x0192,
    0x84 => 0x201e,
    0x85 => 0x2026,
    0x86 => 0x2020,
    0x87 => 0x2021,
    0x88 => 0x02c6,
    0x89 => 0x2030,
    0x8a => 0x0160,
    0x8b => 0x2039,
    0x8c => 0x0152,
    0x8e => 0x017d,
    0x91 => 0x2018,
    0x92 => 0x2019,
    0x93 => 0x201c,
    0x94 => 0x201d,
    0x95 => 0x2022,
    0x96 => 0x2013,
    0x97 => 0x2014,
    0x98 => 0x02dc,
    0x99 => 0x2122,
    0x9a => 0x0161,
    0x9b => 0x203a,
    0x9c => 0x0153,
    0x9e => 0x017e,
    0x9f => 0x0178,
    other => other as u32,
  }
}

fn token_regex() -> &'static Regex {
  static RE: OnceLock<Regex> = OnceLock::new();
  RE.get_or_init(|| {
    Regex::new(r#"\\([a-zA-Z]+)(-?\d+)?[ ]?|\\'([0-9a-fA-F]{2})|\\(.)|([{}])|(\r\n|\r|\n)|([^\\{}\r\n]+)"#)
      .expect("static RTF token regex is valid")
  })
}

fn trailing_space_regex() -> &'static Regex {
  static RE: OnceLock<Regex> = OnceLock::new();
  RE.get_or_init(|| Regex::new(r"[ \t]+\n").expect("static regex is valid"))
}

fn extra_blank_line_regex() -> &'static Regex {
  static RE: OnceLock<Regex> = OnceLock::new();
  RE.get_or_init(|| Regex::new(r"\n{3,}").expect("static regex is valid"))
}

pub fn strip_rtf(input: &str) -> String {
  if input.is_empty() {
    return String::new();
  }
  if !input.contains("\\rtf") {
    return input.trim().to_string();
  }

  let mut out = String::new();
  // One ignorable flag per nested group ({...}); a group is ignorable when
  // its own destination word is ignorable, or its parent group already was.
  let mut group_ignorable: Vec<bool> = vec![false];
  let mut pending_unicode_skip: i32 = 0;
  let mut unicode_fallback_len: i32 = 1;

  macro_rules! ignorable {
    () => {
      *group_ignorable.last().unwrap()
    };
  }

  for caps in token_regex().captures_iter(input) {
    let word = caps.get(1).map(|m| m.as_str());
    let param = caps.get(2).map(|m| m.as_str());
    let hex = caps.get(3).map(|m| m.as_str());
    let escaped_char = caps.get(4).map(|m| m.as_str());
    let brace = caps.get(5).map(|m| m.as_str());
    let newline = caps.get(6).map(|m| m.as_str());
    let text = caps.get(7).map(|m| m.as_str());

    if let Some(brace) = brace {
      if brace == "{" {
        group_ignorable.push(ignorable!());
      } else {
        group_ignorable.pop();
        if group_ignorable.is_empty() {
          group_ignorable.push(false);
        }
      }
      continue;
    }

    if newline.is_some() {
      // Bare newlines in the source are formatting whitespace, not sung
      // line breaks — only \par/\line (below) represent those.
      continue;
    }

    if let Some(hex) = hex {
      if pending_unicode_skip > 0 {
        pending_unicode_skip -= 1;
        continue;
      }
      if !ignorable!() {
        let byte = u8::from_str_radix(hex, 16).unwrap_or(0);
        if let Some(c) = char::from_u32(cp1252_high(byte)) {
          out.push(c);
        }
      }
      continue;
    }

    if let Some(word) = word {
      let lower = word.to_ascii_lowercase();

      if IGNORED_DESTINATIONS.contains(&lower.as_str()) {
        let last = group_ignorable.len() - 1;
        group_ignorable[last] = true;
        continue;
      }

      match lower.as_str() {
        "par" | "line" => {
          if !ignorable!() {
            out.push('\n');
          }
        }
        "tab" => {
          if !ignorable!() {
            out.push('\t');
          }
        }
        "u" => {
          let code_point: i32 = param.and_then(|p| p.parse().ok()).unwrap_or(0);
          let code_point = if code_point < 0 { code_point + 65536 } else { code_point };
          if !ignorable!() {
            if let Some(c) = char::from_u32(code_point as u32) {
              out.push(c);
            }
          }
          // \uN is followed by \ucN fallback chars (default 1) for readers
          // that can't render the escape; skip them so they don't duplicate.
          pending_unicode_skip = unicode_fallback_len;
        }
        "uc" => {
          unicode_fallback_len = param.and_then(|p| p.parse().ok()).unwrap_or(1).max(0);
        }
        "emdash" => {
          if !ignorable!() {
            out.push('\u{2014}');
          }
        }
        "endash" => {
          if !ignorable!() {
            out.push('\u{2013}');
          }
        }
        "bullet" => {
          if !ignorable!() {
            out.push('\u{2022}');
          }
        }
        "lquote" => {
          if !ignorable!() {
            out.push('\u{2018}');
          }
        }
        "rquote" => {
          if !ignorable!() {
            out.push('\u{2019}');
          }
        }
        "ldblquote" => {
          if !ignorable!() {
            out.push('\u{201c}');
          }
        }
        "rdblquote" => {
          if !ignorable!() {
            out.push('\u{201d}');
          }
        }
        // Any other control word (font/size/color/alignment switches,
        // \pard, \plain, \fntnamaut, ...) carries no text of its own.
        _ => {}
      }
      continue;
    }

    if let Some(escaped_char) = escaped_char {
      if escaped_char == "*" {
        // \* marks "the rest of this group is safe to skip if you don't
        // understand it" — list-style/bookmark/etc. definitions that are
        // never part of the visible document.
        let last = group_ignorable.len() - 1;
        group_ignorable[last] = true;
      } else if !ignorable!() {
        match escaped_char {
          "\\" | "{" | "}" => out.push_str(escaped_char),
          "~" => out.push(' '),
          "-" => out.push('\u{00AD}'),
          "_" => out.push('\u{2011}'),
          _ => {}
        }
      }
      continue;
    }

    if let Some(text) = text {
      // A text run holds the fallback char and the words after it, so skip
      // only the fallback chars, not the whole run.
      let mut chars = text.chars();
      while pending_unicode_skip > 0 && chars.next().is_some() {
        pending_unicode_skip -= 1;
      }
      if !ignorable!() {
        out.push_str(chars.as_str());
      }
      continue;
    }
  }

  let out = trailing_space_regex().replace_all(&out, "\n");
  let out = extra_blank_line_regex().replace_all(&out, "\n\n");
  out.trim().to_string()
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn passes_through_plain_text_untouched() {
    assert_eq!(strip_rtf("Amazing grace, how sweet the sound"), "Amazing grace, how sweet the sound");
  }

  #[test]
  fn empty_input_is_empty() {
    assert_eq!(strip_rtf(""), "");
  }

  #[test]
  fn strips_control_words_and_keeps_par_as_newline() {
    let rtf = r"{\rtf1\ansi\deff0 {\fonttbl{\f0 Arial;}}\f0\fs24 Line one\par Line two}";
    assert_eq!(strip_rtf(rtf), "Line one\nLine two");
  }

  #[test]
  fn strips_ignored_destinations_entirely() {
    let rtf = r"{\rtf1 {\colortbl;\red0\green0\blue0;}Verse one\par {\*\pnseclvl1{\pntxtb.}}Verse two}";
    assert_eq!(strip_rtf(rtf), "Verse one\nVerse two");
  }

  #[test]
  fn decodes_hex_escapes_as_cp1252() {
    // \'93 / \'94 are cp1252 smart double quotes.
    let rtf = r"{\rtf1 \'93Holy\'94}";
    assert_eq!(strip_rtf(rtf), "\u{201c}Holy\u{201d}");
  }

  #[test]
  fn decodes_unicode_escape_and_skips_fallback_char() {
    let rtf = r"{\rtf1 \u8364?}";
    assert_eq!(strip_rtf(rtf), "\u{20ac}");
  }

  #[test]
  fn keeps_the_rest_of_a_word_after_a_unicode_escape() {
    assert_eq!(strip_rtf(r"{\rtf1 Ol\u7907?run ni}"), "Ol\u{1ee3}run ni");
  }

  #[test]
  fn honours_uc0_with_no_fallback_chars() {
    assert_eq!(strip_rtf(r"{\rtf1\uc0 \u233 te}"), "\u{e9}te");
  }

  #[test]
  fn collapses_trailing_spaces_and_extra_blank_lines() {
    let rtf = r"{\rtf1 One  \par\par\par Two}";
    assert_eq!(strip_rtf(rtf), "One\n\nTwo");
  }
}
