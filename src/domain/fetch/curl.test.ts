import { describe, expect, it } from "vitest";
import { parseCurlCommand } from "./curl";

describe("parseCurlCommand", () => {
  it("parses a bare HTTPS URL", () =>
    expect(parseCurlCommand("https://api.example.com/data")).toEqual({
      url: "https://api.example.com/data",
      method: "GET",
      headers: {},
      body: null
    }));
  it("parses realistic copied cURL commands", () =>
    expect(
      parseCurlCommand(
        `curl 'https://api.example.com/items' -X PUT -H 'Accept: application/json' -H 'X-Token: abc:def' --data-raw '{"ok":true}' -u 'user:pass' -A 'Comparer' -b 'sid=1' --compressed`
      )
    ).toEqual({
      url: "https://api.example.com/items",
      method: "PUT",
      headers: {
        Accept: "application/json",
        "X-Token": "abc:def",
        Authorization: "Basic dXNlcjpwYXNz",
        "User-Agent": "Comparer",
        Cookie: "sid=1"
      },
      body: '{"ok":true}'
    }));
  it("joins repeated data and defaults to POST", () =>
    expect(parseCurlCommand("curl https://api.example.com -d a=1 --data b=2").body).toBe(
      "a=1&b=2"
    ));
  it("rejects ambiguous and unsupported flags", () =>
    expect(() => parseCurlCommand("curl --foo bar https://example.com")).toThrow(
      "Unsupported cURL option"
    ));
  it("rejects malformed commands", () =>
    expect(() => parseCurlCommand("curl 'https://example.com")).toThrow("unclosed quote"));
});
