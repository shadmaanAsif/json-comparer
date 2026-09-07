import "@testing-library/jest-dom/vitest";

// jsdom does not implement native dialog methods; real focus/escape behavior is browser-checked.
if (typeof HTMLDialogElement !== "undefined")
  Object.defineProperties(HTMLDialogElement.prototype, {
    showModal: {
      configurable: true,
      value: function (this: HTMLDialogElement) {
        this.open = true;
      }
    },
    close: {
      configurable: true,
      value: function (this: HTMLDialogElement) {
        this.open = false;
      }
    }
  });
