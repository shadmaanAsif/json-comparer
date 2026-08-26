import { parseCurlCommand } from "@/domain/fetch/curl";

export interface RemoteFetchResponse {
  status: number;
  statusText: string;
  bodyText: string;
  isJson: boolean;
}

export interface RemoteFetchResult {
  request: ReturnType<typeof parseCurlCommand>;
  response: RemoteFetchResponse;
  formattedBody: string;
}

export async function fetchRemoteResponse(
  command: string,
  signal?: AbortSignal
): Promise<RemoteFetchResult> {
  const request = parseCurlCommand(command);
  const result = await fetch("/api/fetch-proxy", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
    signal
  });
  const payload = (await result.json()) as RemoteFetchResponse | { message?: string };
  if (!result.ok) {
    throw new Error(
      "message" in payload && payload.message
        ? payload.message
        : "The secure fetch service rejected the request."
    );
  }
  const response = payload as RemoteFetchResponse;
  return {
    request,
    response,
    formattedBody: response.isJson
      ? JSON.stringify(JSON.parse(response.bodyText), null, 2)
      : response.bodyText
  };
}
