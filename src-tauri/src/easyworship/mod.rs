//! Decodes a zipped EasyWorship database export (`File -> Backup` in
//! EasyWorship) entirely on-device: unzips it, reads the Paradox
//! `Songs.DB`/`Songs.MB` table, and converts each song's RTF lyrics to
//! plain text. Nothing here touches the network — the frontend takes the
//! parsed `{title, artist, lyrics}` list this returns and creates each
//! song through the normal song-creation API itself, the same lightweight
//! write any manual "Add a song" already does.
//!
//! This was originally a backend route that unzipped and parsed on the
//! server; it moved here (desktop-only) so importing a large export never
//! costs the server CPU/memory, only the church's own machine.

mod paradox;
mod rtf;

use serde::Serialize;
use std::collections::HashSet;
use std::fs::File;
use std::io::Read;
use zip::ZipArchive;

// This now reads straight off the church's own disk — no upload, and only
// the two small Songs.DB/.MB entries are ever decompressed into memory, not
// the whole archive — so the real EasyWorship export sizes seen in practice
// (which bundle every past "Rebuild Backup"/"oldData" copy plus media BLOBs,
// often 1GB+) are fine. This is a sanity backstop against an unrelated huge
// file, not a memory-safety limit.
const MAX_IMPORT_FILE_SIZE: u64 = 4 * 1024 * 1024 * 1024; // 4 GB
const MAX_SONGS_PER_IMPORT: usize = 2000;
const WANTED_COLUMNS: [&str; 3] = ["Title", "Author", "Words"];

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ParsedSong {
  title: String,
  artist: String,
  lyrics: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EasyWorshipImportResult {
  songs: Vec<ParsedSong>,
  total_parsed: usize,
}

#[tauri::command]
pub async fn import_easyworship_songs(path: String) -> Result<EasyWorshipImportResult, String> {
  tauri::async_runtime::spawn_blocking(move || import_blocking(&path))
    .await
    .map_err(|error| error.to_string())?
}

fn import_blocking(path: &str) -> Result<EasyWorshipImportResult, String> {
  let metadata = std::fs::metadata(path).map_err(|_| "Could not open that file.".to_string())?;
  if metadata.len() > MAX_IMPORT_FILE_SIZE {
    let max_mb = MAX_IMPORT_FILE_SIZE / (1024 * 1024);
    return Err(format!("File size exceeds the {max_mb}MB limit."));
  }

  let file = File::open(path).map_err(|_| "Could not open that file.".to_string())?;
  let mut archive = ZipArchive::new(file).map_err(|_| "That file isn't a zip archive.".to_string())?;

  // by_index_raw reads only the central directory record, so listing a
  // 1GB+ backup never touches the compressed media inside it.
  let entry_names: Vec<(String, u64)> = (0..archive.len())
    .filter_map(|i| archive.by_index_raw(i).ok().map(|entry| (entry.name().to_string(), entry.size())))
    .collect();

  let songs_entry_name = select_best_songs_entry(&entry_names)
    .ok_or_else(|| "No EasyWorship song database (Songs.DB) was found in this file.".to_string())?;

  let db_data = read_zip_entry(&mut archive, &songs_entry_name)
    .ok_or_else(|| "Could not read the song database inside this file.".to_string())?;

  let mb_entry_name = sibling_mb_entry_name(&songs_entry_name);
  let mb_data = read_zip_entry_ci(&mut archive, &mb_entry_name);

  let records = paradox::read_table(&db_data, mb_data.as_deref(), &WANTED_COLUMNS)?;

  let mut seen = HashSet::new();
  let mut songs = Vec::new();

  for record in &records {
    let title = record.get("Title").map(|s| s.trim()).unwrap_or("").to_string();
    let lyrics = rtf::strip_rtf(record.get("Words").map(|s| s.as_str()).unwrap_or(""));
    if title.is_empty() || lyrics.is_empty() {
      continue;
    }

    // The same song can appear twice inside one export (e.g. a near-miss
    // in the "Data" table that a rebuild never cleaned up); keep the
    // first occurrence only.
    let dedupe_key = format!("{}\n{}", title.to_lowercase(), lyrics.to_lowercase());
    if !seen.insert(dedupe_key) {
      continue;
    }

    let artist = record.get("Author").map(|s| s.trim()).unwrap_or("").to_string();
    songs.push(ParsedSong {
      title,
      artist: if artist.is_empty() { "Unknown".to_string() } else { artist },
      lyrics,
    });
  }

  // Counted after blank and repeated rows are dropped, so only real songs
  // count towards the cap.
  if songs.len() > MAX_SONGS_PER_IMPORT {
    return Err(format!(
      "This backup has {} songs, which is more than one import can handle (max {MAX_SONGS_PER_IMPORT}).",
      songs.len()
    ));
  }

  let total_parsed = songs.len();
  Ok(EasyWorshipImportResult { songs, total_parsed })
}

/// EasyWorship keeps one *live* song table (`Databases/Data/Songs.DB`)
/// plus a full copy of every past one under folders named "Rebuild
/// Backup ..." or "oldData ...", left behind by each database
/// compact/rebuild. A church's backup zip carries all of them. This
/// picks the one table to read: whichever path contains a "Data"
/// directory and isn't itself named like a backup, falling back to the
/// largest candidate (the most records) when that heuristic finds none.
fn select_best_songs_entry(entries: &[(String, u64)]) -> Option<String> {
  let candidates: Vec<&(String, u64)> = entries.iter().filter(|(name, _)| name.to_lowercase().ends_with("songs.db")).collect();
  if candidates.is_empty() {
    return None;
  }

  let segments = |name: &str| -> Vec<String> { name.to_lowercase().split(['/', '\\']).map(|s| s.to_string()).collect() };
  let looks_like_backup =
    |name: &str| segments(name).iter().any(|seg| seg.starts_with("rebuild backup") || seg.starts_with("olddata"));
  let has_data_dir = |name: &str| segments(name).iter().any(|seg| seg == "data");

  let live: Vec<&(String, u64)> = candidates.iter().filter(|(name, _)| has_data_dir(name) && !looks_like_backup(name)).copied().collect();
  let pool: &[&(String, u64)] = if live.is_empty() { &candidates } else { &live };

  pool.iter().max_by_key(|(_, size)| *size).map(|(name, _)| name.clone())
}

/// The `.MB` memo/blob file that holds a Paradox table's long text fields
/// (here, the RTF "Words") sits next to the `.DB` in the same folder,
/// same base name, different extension — never bundled any other way.
fn sibling_mb_entry_name(db_entry_name: &str) -> String {
  let lower = db_entry_name.to_lowercase();
  match lower.strip_suffix(".db") {
    Some(_) => format!("{}.MB", &db_entry_name[..db_entry_name.len() - 3]),
    None => format!("{db_entry_name}.MB"),
  }
}

// The size in a zip header is only a claim, so it's capped before it's
// used to reserve memory.
const MAX_PREALLOC: u64 = 64 * 1024 * 1024;

fn read_zip_entry(archive: &mut ZipArchive<File>, name: &str) -> Option<Vec<u8>> {
  let mut entry = archive.by_name(name).ok()?;
  let mut buf = Vec::with_capacity(entry.size().min(MAX_PREALLOC) as usize);
  entry.read_to_end(&mut buf).ok()?;
  Some(buf)
}

/// Case-insensitive lookup: the sibling `.MB` is usually the same case as
/// its `.DB`, but not guaranteed, and `ZipArchive::by_name` is exact-match.
fn read_zip_entry_ci(archive: &mut ZipArchive<File>, name: &str) -> Option<Vec<u8>> {
  let target = name.to_lowercase();
  let actual = archive.file_names().find(|n| n.to_lowercase() == target)?.to_string();
  read_zip_entry(archive, &actual)
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn picks_the_live_data_table_over_backup_copies() {
    let entries = vec![
      ("Databases/Rebuild Backup 2023-01-01/Data/Songs.DB".to_string(), 500_000),
      ("Databases/Data/Songs.DB".to_string(), 450_000),
      ("Databases/oldData 2022/Songs.DB".to_string(), 600_000),
    ];
    assert_eq!(select_best_songs_entry(&entries), Some("Databases/Data/Songs.DB".to_string()));
  }

  #[test]
  fn falls_back_to_the_largest_candidate_when_no_live_table_is_found() {
    let entries = vec![
      ("Databases/Rebuild Backup 2023-01-01/Data/Songs.DB".to_string(), 500_000),
      ("Databases/oldData 2022/Songs.DB".to_string(), 600_000),
    ];
    assert_eq!(select_best_songs_entry(&entries), Some("Databases/oldData 2022/Songs.DB".to_string()));
  }

  #[test]
  fn returns_none_when_no_songs_db_entry_exists() {
    let entries = vec![("Databases/Data/Media.DB".to_string(), 1000)];
    assert_eq!(select_best_songs_entry(&entries), None);
  }

  #[test]
  fn builds_the_sibling_mb_name_from_the_db_name() {
    assert_eq!(sibling_mb_entry_name("Databases/Data/Songs.DB"), "Databases/Data/Songs.MB");
    assert_eq!(sibling_mb_entry_name("Databases/Data/Songs.db"), "Databases/Data/Songs.MB");
  }
}
