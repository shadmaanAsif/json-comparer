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

  it("skips alignment when a duplicated key hasn't been renamed yet, so pasting a line to edit doesn't erase it", () => {
    // A user duplicating "first" to then rename the copy would otherwise watch JSON.parse's
    // last-key-wins behavior silently delete the very line they just pasted.
    expect(alignValidInputText('{"first":1,"first":2}', '{"first":10}')).toBeNull();
  });

  it("does not mistake same-named keys in different objects, or repeated array values, for duplicates", () => {
    expect(
      alignValidInputText('{"a":{"x":1},"b":{"x":2}}', '[{"a":1},{"a":1}]')
    ).toMatchObject({
      textA: '{\n  "a": {\n    "x": 1\n  },\n  "b": {\n    "x": 2\n  }\n}',
      textB: '[\n  {\n    "a": 1\n  },\n  {\n    "a": 1\n  }\n]'
    });
    expect(alignValidInputText('["first","first"]', '{"first":1}')).toMatchObject({
      textB: '{\n  "first": 1\n}\n'
    });
  });
});
