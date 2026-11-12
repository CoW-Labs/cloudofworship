//! Minimal reader for Corel/Borland Paradox `.DB`/`.MB` table files.
//!
//! This only reads the handful of field types EasyWorship's `Songs.DB`
//! actually uses for the columns this feature cares about (`Title`,
//! `Author`, alpha; `Words`, memo/RTF) — it is not a general Paradox
//! reader. The binary layout and blob-pointer algorithm are a Rust port of
//! the backend's `paradox-reader` usage (see worshipcloud-api
//! `node_modules/paradox-reader/index.js`, itself based on pxlib's
//! `px_head.c` / `px_get_data_blob`), kept narrow on purpose: unsupported
//! field types are skipped rather than decoded, and an encrypted table is
//! reported as an error rather than attempted, since EasyWorship never
//! offers a way to password-protect a song table and a wrong decrypt
//! would be worse than a clear "not supported".

use std::collections::{HashMap, HashSet};

const FIELD_DESC_OFFSETS: [usize; 3] = [0x78, 0x58, 0x38];

fn is_valid_field_type(field_type: u8) -> bool {
  matches!(
    field_type,
    0x01 | 0x02 | 0x03 | 0x04 | 0x05 | 0x06 | 0x09 | 0x0C | 0x0D | 0x0E | 0x10 | 0x11 | 0x14 | 0x15 | 0x16 | 0x17 | 0x18
  )
}

fn read_u16_le(buf: &[u8], offset: usize) -> u16 {
  u16::from_le_bytes([buf[offset], buf[offset + 1]])
}

fn read_u32_le(buf: &[u8], offset: usize) -> u32 {
  u32::from_le_bytes([buf[offset], buf[offset + 1], buf[offset + 2], buf[offset + 3]])
}

// Paradox text is stored as Windows-1252/Latin-1 bytes. Every byte 0-255
// maps 1:1 onto a Unicode scalar value here (the same mapping JS's
// `Buffer.toString('latin1')` performs), so no table/crate is needed.
fn latin1_to_string(bytes: &[u8]) -> String {
  bytes.iter().map(|&b| b as char).collect()
}

struct FieldDesc {
  field_type: u8,
  size: u8,
  name: String,
}

fn detect_field_desc_start(buf: &[u8], num_fields: usize, record_size: usize) -> usize {
  for &offset in FIELD_DESC_OFFSETS.iter() {
    if offset + num_fields * 2 > buf.len() {
      continue;
    }
    let mut total = 0usize;
    let mut ok = true;
    for i in 0..num_fields {
      let field_type = buf[offset + i * 2];
      let size = buf[offset + i * 2 + 1];
      if !is_valid_field_type(field_type) || size == 0 {
        ok = false;
        break;
      }
      total += size as usize;
    }
    if ok && total == record_size {
      return offset;
    }
  }
  0x78
}

fn find_field_names(buf: &[u8], header_size: usize, num_fields: usize, search_from: usize) -> Option<Vec<String>> {
  let search_end = header_size.saturating_sub(num_fields);
  'outer: for start in search_from..search_end {
    if buf[start] < 0x20 || buf[start] > 0x7E {
      continue;
    }
    let mut pos = start;
    let mut names = Vec::with_capacity(num_fields);
    for _ in 0..num_fields {
      let name_start = pos;
      let mut end = pos;
      while end < header_size && buf[end] != 0x00 {
        end += 1;
      }
      if end >= header_size || end == name_start {
        continue 'outer;
      }
      for &b in &buf[name_start..end] {
        if b < 0x20 || b > 0x7E {
          continue 'outer;
        }
      }
      names.push(latin1_to_string(&buf[name_start..end]));
      pos = end + 1;
    }
    if names.len() == num_fields {
      return Some(names);
    }
  }
  None
}

/// Ported from pxlib's `_px_get_data_blob()` via paradox-reader's
/// `readBlobFromBuffer`. The 10-byte pointer at the field's tail is
/// `rawOffset(4 LE) + blobSize(4 LE) + modNr(2 LE)`; `rawOffset` splits
/// into a block offset (masked to a 256-byte boundary) and a sub-index
/// used only by "type 3" (multi-record) blocks.
fn read_blob(mb_buf: Option<&[u8]>, rec_buf: &[u8], rec_offset: usize, field_len: usize) -> Option<String> {
  let mb_buf = mb_buf?;
  let leader = field_len as i64 - 10;
  let ptr_start = rec_offset as i64 + leader;
  if ptr_start < 0 {
    return None;
  }
  let ptr_start = ptr_start as usize;
  if ptr_start + 10 > rec_buf.len() {
    return None;
  }

  let raw_offset = read_u32_le(rec_buf, ptr_start);
  let blob_size = read_u32_le(rec_buf, ptr_start + 4) as i64;

  if blob_size <= 0 {
    return if leader > 0 { inline_leader(rec_buf, rec_offset, leader as usize) } else { None };
  }

  if blob_size <= leader {
    return buf_to_str(rec_buf, rec_offset, blob_size as usize);
  }

  let block_off = (raw_offset & 0xFFFF_FF00) as usize;
  let idx = (raw_offset & 0xFF) as usize;
  if block_off == 0 || block_off >= mb_buf.len() {
    return None;
  }

  let hsize = 9usize; // Memo/blob/fmtmemo header size (graphics use 17, not needed for song text).
  let size = blob_size as usize;

  let block_type = mb_buf[block_off];

  if block_type == 2 {
    let pos = block_off + hsize;
    return buf_to_str(mb_buf, pos, size);
  }

  if block_type == 3 {
    let entry_pos = block_off + 12 + idx * 5;
    if entry_pos + 5 > mb_buf.len() {
      return None;
    }
    let slot = mb_buf[entry_pos] as usize;
    let pos = block_off + slot * 16;
    return buf_to_str(mb_buf, pos, size);
  }

  let pos = block_off + hsize;
  buf_to_str(mb_buf, pos, size)
}

fn inline_leader(buf: &[u8], offset: usize, len: usize) -> Option<String> {
  if offset >= buf.len() {
    return None;
  }
  let window_end = (offset + len).min(buf.len());
  let nul = buf[offset..window_end].iter().position(|&b| b == 0x00).map(|p| offset + p);
  let stop = nul.unwrap_or(window_end);
  let s = latin1_to_string(&buf[offset..stop]).trim_end().to_string();
  if s.is_empty() {
    None
  } else {
    Some(s)
  }
}

fn buf_to_str(buf: &[u8], offset: usize, len: usize) -> Option<String> {
  if offset >= buf.len() {
    return None;
  }
  let end = (offset + len).min(buf.len());
  if end <= offset {
    return None;
  }
  let slice = &buf[offset..end];
  let nul = slice.iter().position(|&b| b == 0x00).unwrap_or(slice.len());
  let s = latin1_to_string(&slice[..nul]).trim_end().to_string();
  if s.is_empty() {
    None
  } else {
    Some(s)
  }
}

fn decode_alpha(blk: &[u8], pos: usize, size: usize) -> Option<String> {
  let end = (pos + size).min(blk.len());
  if end <= pos {
    return None;
  }
  let nul = blk[pos..end].iter().position(|&b| b == 0x00).map(|p| pos + p).unwrap_or(end);
  let s = latin1_to_string(&blk[pos..nul]).trim_end().to_string();
  if s.is_empty() {
    None
  } else {
    Some(s)
  }
}

/// Reads a Paradox `.DB` table (plus its sibling `.MB`, for memo fields)
/// and returns one `HashMap<field name, text value>` per record, limited
/// to the field names in `wanted_columns` — every other column is parsed
/// just enough to skip over its bytes, never decoded.
pub fn read_table(db_buf: &[u8], mb_buf: Option<&[u8]>, wanted_columns: &[&str]) -> Result<Vec<HashMap<String, String>>, String> {
  if db_buf.len() < 0x30 {
    return Err("Could not read the song database inside this file.".into());
  }

  let record_size = read_u16_le(db_buf, 0x00) as usize;
  let header_size = read_u16_le(db_buf, 0x02) as usize;
  let max_tbl_size = db_buf[0x05] as usize;
  let file_blocks = read_u16_le(db_buf, 0x0C) as usize;
  let first_block = read_u16_le(db_buf, 0x0E) as usize;
  let num_fields = read_u16_le(db_buf, 0x21) as usize;
  let block_size = max_tbl_size.max(1) * 1024;

  if num_fields == 0 || num_fields > 2000 {
    return Err("Could not read the song database inside this file.".into());
  }
  if record_size == 0 {
    return Err("Could not read the song database inside this file.".into());
  }

  let fds = detect_field_desc_start(db_buf, num_fields, record_size);
  if fds + num_fields * 2 > db_buf.len() {
    return Err("Could not read the song database inside this file.".into());
  }
  let mut fields: Vec<FieldDesc> = (0..num_fields)
    .map(|i| FieldDesc {
      field_type: db_buf[fds + i * 2],
      size: db_buf[fds + i * 2 + 1],
      name: format!("field_{i}"),
    })
    .collect();

  // A corrupt header can claim to be longer than the file itself.
  let name_search_end = header_size.min(db_buf.len());
  if let Some(names) = find_field_names(db_buf, name_search_end, num_fields, fds + num_fields * 2) {
    for (field, name) in fields.iter_mut().zip(names) {
      field.name = name;
    }
  }

  // Encryption detection (pxlib px_head.c): encryption1 at 0x25, falling
  // back to encryption2 at 0x5C when the first is the "look elsewhere"
  // sentinel. EasyWorship never exposes a way to password-protect a song
  // table, so rather than port pxlib's chunk cipher (and risk silently
  // mis-decrypting real data), an encrypted table is reported plainly.
  if first_block != 0 {
    let mut encryption = if db_buf.len() >= 0x29 { read_u32_le(db_buf, 0x25) } else { 0 };
    if encryption == 0xFF00_FF00 {
      encryption = if db_buf.len() >= 0x60 { read_u32_le(db_buf, 0x5C) } else { 0 };
    }
    if encryption != 0 {
      return Err("This EasyWorship database is password-protected. Remove the password in EasyWorship and export again.".into());
    }
  }

  let wanted: HashSet<&str> = wanted_columns.iter().copied().collect();

  let mut records = Vec::new();
  if file_blocks == 0 || first_block == 0 {
    return Ok(records);
  }

  let mut block_num = first_block;
  let mut visited = HashSet::new();

  while block_num != 0 {
    if !visited.insert(block_num) {
      break;
    }

    let block_start = header_size + (block_num - 1) * block_size;
    if block_start + 6 > db_buf.len() {
      break;
    }
    let block_end = (block_start + block_size).min(db_buf.len());
    let block = &db_buf[block_start..block_end];

    let next_block = read_u16_le(block, 0) as usize;
    let add_data = read_u16_le(block, 4) as usize;
    let max_recs_in_block = block_size.saturating_sub(6) / record_size;
    let num_recs = ((add_data / record_size) + 1).min(max_recs_in_block);

    for r in 0..num_recs {
      let record_start = 6 + r * record_size;
      if record_start + record_size > block.len() {
        break;
      }

      let mut record: HashMap<String, String> = HashMap::new();
      let mut pos = record_start;
      for field in &fields {
        let size = field.size as usize;
        if pos + size > block.len() {
          pos += size;
          continue;
        }
        if wanted.contains(field.name.as_str()) {
          let value = match field.field_type {
            0x01 => decode_alpha(block, pos, size),
            0x0C | 0x0D | 0x0E => read_blob(mb_buf, block, pos, size),
            _ => None,
          };
          if let Some(value) = value {
            record.insert(field.name.clone(), value);
          }
        }
        pos += size;
      }
      records.push(record);
    }

    block_num = next_block;
  }

  Ok(records)
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn a_header_longer_than_the_file_is_an_error_not_a_panic() {
    let mut buf = vec![0u8; 0x40];
    buf[0x00] = 10; // record size
    buf[0x02] = 0xFF; // header size claims far past the end
    buf[0x03] = 0xFF;
    buf[0x21] = 40; // field descriptors would run past the end too
    assert!(read_table(&buf, None, &["Title"]).is_err());
  }
}
