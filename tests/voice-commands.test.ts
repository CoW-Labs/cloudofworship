import { describe, expect, it } from "vitest"
import {
  detectBibleVersionVoiceCommand,
  detectVerseVoiceCommand,
  planVoiceCommand,
} from "~/utils/voiceCommands"

/** The translations a church would typically have downloaded. */
const versions = ["KJV", "NKJV", "NIV", "AMP", "TPT", "MSG", "WEB"]

const plan = (text: string) => planVoiceCommand(text, { availableVersions: versions })
const version = (text: string) => detectBibleVersionVoiceCommand(text, versions)

describe("planVoiceCommand — the reported utterances", () => {
  it("advances AND switches translation in one command", () => {
    expect(plan("give me the next verse but give me in amplified version")).toMatchObject({
      action: "next-verse",
      version: "AMP",
    })
  })

  it("handles the verb-less form", () => {
    expect(plan("the next verse in amplified version")).toMatchObject({
      action: "next-verse",
      version: "AMP",
    })
  })

  it("handles a bare, repeated version name", () => {
    expect(plan("amplified version please amplified")).toMatchObject({
      action: "change-bible-version",
      version: "AMP",
    })
  })

  it("handles a spoken acronym after a verb", () => {
    expect(plan("give me in NKJV")).toMatchObject({
      action: "change-bible-version",
      version: "NKJV",
    })
    expect(plan("give me TPT")).toMatchObject({
      action: "change-bible-version",
      version: "TPT",
    })
  })
})

describe("planVoiceCommand — combined navigation", () => {
  it("carries the version on a previous-verse command", () => {
    expect(plan("go back one verse in the new king james")).toMatchObject({
      action: "previous-verse",
      version: "NKJV",
    })
  })

  it("carries the version on an explicit verse number", () => {
    expect(plan("go to verse 7 in amplified")).toMatchObject({
      action: "goto-verse-number",
      verseNumber: 7,
      version: "AMP",
    })
  })

  it("an explicit verse number outranks next/previous", () => {
    expect(plan("go to verse 12")).toMatchObject({
      action: "goto-verse-number",
      verseNumber: 12,
    })
  })

  it("gives a combined command its own latch key", () => {
    // Otherwise an interim "next verse" would suppress the corrected
    // "next verse in amplified" that follows it within the cooldown.
    expect(plan("next verse")?.key).toBe("next-verse")
    expect(plan("next verse in amplified")?.key).toBe("next-verse+version:AMP")
  })

  it("keeps the navigation identity stable as an interim gains a version", () => {
    expect(plan("next verse")?.navigationKey).toBe("next-verse")
    expect(plan("next verse in amplified")?.navigationKey).toBe("next-verse")
    expect(plan("go to verse 7")?.navigationKey).toBe("goto-verse-number:7")
    expect(plan("go to verse 7 in amplified")?.navigationKey).toBe(
      "goto-verse-number:7"
    )
  })

  it("returns null when nothing was said", () => {
    expect(plan("and the lord spoke to him saying")).toBeNull()
    expect(plan("")).toBeNull()
  })

  it("respects the version-commands setting", () => {
    expect(
      planVoiceCommand("the next verse in amplified version", {
        availableVersions: versions,
        versionCommandsEnabled: false,
      })
    ).toMatchObject({ action: "next-verse" })
    expect(
      planVoiceCommand("the next verse in amplified version", {
        availableVersions: versions,
        versionCommandsEnabled: false,
      })?.version
    ).toBeUndefined()
  })

  it("only offers versions the church actually has", () => {
    expect(planVoiceCommand("give me TPT", { availableVersions: ["KJV", "NIV"] })).toBeNull()
  })
})

describe("detectBibleVersionVoiceCommand — bare utterances", () => {
  it("matches a version name on its own", () => {
    expect(version("amplified")).toBe("AMP")
    expect(version("nkjv please")).toBe("NKJV")
    expect(version("n k j v")).toBe("NKJV")
    expect(version("amplified bible amplified version")).toBe("AMP")
  })

  it("ignores an utterance that is not purely version names", () => {
    // A single non-alias word means this is speech, not a command
    expect(version("the amplified bible says here")).toBeNull()
    expect(version("that is amplified in my spirit")).toBeNull()
  })

  it("ignores a run of names for different versions", () => {
    expect(version("amplified nkjv")).toBeNull()
  })
})

describe("detectBibleVersionVoiceCommand — ambiguous aliases", () => {
  it("still resolves them from an explicit command", () => {
    expect(version("switch to the message")).toBe("MSG")
    expect(version("give me the passion translation")).toBe("TPT")
    expect(version("use the world english bible")).toBe("WEB")
  })

  it("does not resolve them from the verb-less trailing form", () => {
    // These are sentences a preacher says, not commands
    expect(version("it is written in the message")).toBeNull()
    expect(version("he speaks of the love in the passion")).toBeNull()
  })

  it("does not resolve them as a bare utterance", () => {
    expect(version("the message")).toBeNull()
    expect(version("passion")).toBeNull()
  })

  it("still resolves their acronyms anywhere", () => {
    expect(version("msg")).toBe("MSG")
    expect(version("in tpt")).toBe("TPT")
  })
})

describe("regressions — existing behaviour is unchanged", () => {
  it("keeps plain navigation working", () => {
    expect(detectVerseVoiceCommand("next verse")).toBe("next-verse")
    expect(detectVerseVoiceCommand("previous verse")).toBe("previous-verse")
    expect(plan("next verse")).toMatchObject({ action: "next-verse" })
    expect(plan("go back please")).toMatchObject({ action: "previous-verse" })
  })

  it("keeps the explicit version commands working", () => {
    expect(version("switch the bible version to niv")).toBe("NIV")
    expect(version("show this passage in the king james version")).toBe("KJV")
    expect(version("give me the new king james")).toBe("NKJV")
  })

  it("does not read a verse reference as a version", () => {
    expect(version("give me verse 7")).toBeNull()
    expect(version("give me the next verse")).toBeNull()
  })
})
