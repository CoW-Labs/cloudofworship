import { describe, expect, it } from "vitest"
import { isForeignHost } from "~/utils/deploymentHost"

describe("isForeignHost", () => {
  it.each([
    "app.cloudofworship.com",
    "staging.app.cloudofworship.com",
    "app.cloudofworship.com.",
    "cloudofworship.pages.dev",
    "7c1321f7.cloudofworship.pages.dev",
    "cloudofworship-git-staging-felixfavours-projects.vercel.app",
    "tauri.localhost",
    "localhost",
    "app.localhost",
    "127.0.0.1",
    "192.168.1.20",
    "172.16.195.164",
    "",
  ])("treats %s as ours", host => {
    expect(isForeignHost(host)).toBe(false)
  })

  it.each([
    "worship-copy.com",
    "cloudofworship.com.evil.net",
    "minimalist-church-presentation-software.vercel.app",
    "mycloudofworship.com",
    "172.32.0.1",
  ])("flags %s as foreign", host => {
    expect(isForeignHost(host)).toBe(true)
  })
})
