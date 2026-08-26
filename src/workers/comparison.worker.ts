/// <reference lib="webworker" />

import { compareJson } from "../domain/comparison/engine";
import { formatAlignedForDisplay } from "../domain/comparison/display-format";
import { parseJson } from "../domain/comparison/parse";
import type { ComparisonOptions, ComparisonResult } from "../domain/comparison/types";

export interface WorkerRequest {
  jobId: string;
  textA: string;
  textB: string;
  options: ComparisonOptions;
  maxBytes: number;
}

export type WorkerResponse =
  | {
      jobId: string;
      ok: true;
      formattedA: string;
      formattedB: string;
      result: ComparisonResult;
      durationMs: number;
    }
  | { jobId: string; ok: false; error: string };

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const started = performance.now();
  try {
    const a = parseJson(event.data.textA, "A", event.data.maxBytes);
    const b = parseJson(event.data.textB, "B", event.data.maxBytes);
    const result = compareJson(a.value, b.value, event.data.options);
    const aligned = formatAlignedForDisplay(a.value, b.value);
    self.postMessage({
      jobId: event.data.jobId,
      ok: true,
      formattedA: aligned.textA,
      formattedB: aligned.textB,
      result,
      durationMs: performance.now() - started
    } satisfies WorkerResponse);
  } catch (error) {
    self.postMessage({
      jobId: event.data.jobId,
      ok: false,
      error: error instanceof Error ? error.message : "Comparison failed"
    } satisfies WorkerResponse);
  }
};

export {};
