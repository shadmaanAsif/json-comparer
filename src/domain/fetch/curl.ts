export interface RemoteFetchRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string | null;
}

/** @deprecated Use RemoteFetchRequest. */
export type ParsedFetchRequest = RemoteFetchRequest;

const dataFlags = new Set(["-d", "--data", "--data-raw", "--data-binary", "--data-ascii"]);
const noValueFlags = new Set([
  "--compressed",
  "-s",
  "--silent",
  "-k",
  "--insecure",
  "-L",
  "--location",
  "-v",
  "--verbose"
]);

function tokenize(input: string): string[] {
  const tokens: string[] = [];
  let token = "";
  let quote: "'" | '"' | null = null;
  let escaped = false;
  for (const char of input.trim()) {
    if (escaped) {
      token += char;
      escaped = false;
      continue;
    }
    if (quote === '"' && char === "\\") {
      escaped = true;
      continue;
    }
    if (quote) {
      if (char === quote) quote = null;
      else token += char;
      continue;
    }
    if (char === "'" || char === '"') {
      quote = char;
      continue;
    }
    if (/\s/.test(char)) {
      if (token) {
        tokens.push(token);
        token = "";
      }
      continue;
    }
    token += char;
  }
  if (quote) throw new Error("The cURL command contains an unclosed quote.");
  if (escaped) token += "\\";
  if (token) tokens.push(token);
  return tokens;
}

function basic(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

export function parseCurlCommand(input: string): RemoteFetchRequest {
  const trimmed = input.trim();
  if (!trimmed) throw new Error("Enter a URL or a curl command first.");
  if (/^https:\/\//i.test(trimmed) && !/\s/.test(trimmed)) {
    return { url: trimmed, method: "GET", headers: {}, body: null };
  }
  const tokens = tokenize(trimmed);
  if (tokens[0]?.toLowerCase() === "curl") tokens.shift();
  const headers: Record<string, string> = {};
  const bodies: string[] = [];
  let url = "";
  let explicitMethod = "";
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index]!;
    const value = tokens[index + 1];
    if (token === "-X" || token === "--request") {
      if (!value) throw new Error(`${token} requires a value.`);
      explicitMethod = value.toUpperCase();
      index += 1;
    } else if (token === "-H" || token === "--header") {
      if (!value) throw new Error(`${token} requires a value.`);
      const separator = value.indexOf(":");
      if (separator < 1) throw new Error(`Invalid header: ${value}`);
      headers[value.slice(0, separator).trim()] = value.slice(separator + 1).trim();
      index += 1;
    } else if (dataFlags.has(token)) {
      if (value === undefined) throw new Error(`${token} requires a value.`);
      bodies.push(value);
      index += 1;
    } else if (token === "-u" || token === "--user") {
      if (!value) throw new Error(`${token} requires a value.`);
      headers.Authorization = `Basic ${basic(value)}`;
      index += 1;
    } else if (token === "-A" || token === "--user-agent") {
      if (!value) throw new Error(`${token} requires a value.`);
      headers["User-Agent"] = value;
      index += 1;
    } else if (token === "-b" || token === "--cookie") {
      if (!value) throw new Error(`${token} requires a value.`);
      headers.Cookie = value;
      index += 1;
    } else if (noValueFlags.has(token)) {
      /* accepted but controlled by the proxy */
    } else if (token.startsWith("-")) {
      throw new Error(`Unsupported cURL option: ${token}`);
    } else if (!url) url = token;
    else throw new Error(`Unexpected cURL argument: ${token}`);
  }
  if (!url) throw new Error("Could not find a URL in that command.");
  return {
    url,
    method: explicitMethod || (bodies.length ? "POST" : "GET"),
    headers,
    body: bodies.length ? bodies.join("&") : null
  };
}
