import { describe, expect, it } from "vitest";
import { alignValidInputText } from "./display-alignment";

describe("alignValidInputText", () => {
  it("returns formatted aligned text only when both inputs are valid", () => {
    expect(alignValidInputText('{"second":2,"first":1}', '{"first":10,"second":20}')).toMatchObject(
      {
        textA: '{\n  "second": 2,\n  "first": 1\n}',
        textB: '{\n  "second": 20,\n  "first": 10\n}'
      }
    );
    expect(alignValidInputText('{"valid":true}', "{")).toBeNull();
  });
});
