import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TimePositionDisplay, TimePositionDisplayOptions } from '../../src/components/controls/TimePositionDisplay';

describe('TimePositionDisplay', () => {
  let mockParent: HTMLElement;
  let mockElement: HTMLSpanElement;

  beforeEach(() => {
    // Create mock span element
    mockElement = {
      setText: vi.fn(),
      textContent: '',
      className: '',
      style: {},
      tagName: 'SPAN',
      nodeType: 1,
      getAttribute: vi.fn(),
      setAttribute: vi.fn(),
      removeAttribute: vi.fn(),
      hasAttribute: vi.fn(),
      querySelector: vi.fn(),
      querySelectorAll: vi.fn(),
      appendChild: vi.fn(),
      removeChild: vi.fn(),
      contains: vi.fn(),
      cloneNode: vi.fn(),
      insertBefore: vi.fn(),
      replaceChild: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
      parentNode: null,
      childNodes: [],
      children: [],
      firstChild: null,
      lastChild: null,
      nextSibling: null,
      previousSibling: null,
      ownerDocument: null,
    } as unknown as HTMLSpanElement;

    // Create mock parent element
    mockParent = {
      createEl: vi.fn().mockReturnValue(mockElement),
      appendChild: vi.fn(),
      removeChild: vi.fn(),
      querySelector: vi.fn(),
      querySelectorAll: vi.fn(),
      getAttribute: vi.fn(),
      setAttribute: vi.fn(),
      removeAttribute: vi.fn(),
      hasAttribute: vi.fn(),
      contains: vi.fn(),
      cloneNode: vi.fn(),
      insertBefore: vi.fn(),
      replaceChild: vi.fn(),
      textContent: '',
      className: '',
      style: {},
      tagName: 'DIV',
      nodeType: 1,
      parentNode: null,
      childNodes: [],
      children: [],
      firstChild: null,
      lastChild: null,
      nextSibling: null,
      previousSibling: null,
      ownerDocument: null,
    } as unknown as HTMLElement;
  });

  describe('Constructor', () => {
    it('should create a TimePositionDisplay with default options', () => {
      const display = new TimePositionDisplay(mockParent);

      expect(mockParent.createEl).toHaveBeenCalledWith("span", {
        text: "00:00 / 00:00",
        cls: "time-position"
      });
      expect(display.el).toBe(mockElement);
    });

    it('should create a TimePositionDisplay with empty options object', () => {
      const options: TimePositionDisplayOptions = {};
      const display = new TimePositionDisplay(mockParent, options);

      expect(mockParent.createEl).toHaveBeenCalledWith("span", {
        text: "00:00 / 00:00",
        cls: "time-position"
      });
      expect(display.el).toBe(mockElement);
    });

    it('should create a TimePositionDisplay with custom initial text', () => {
      const options: TimePositionDisplayOptions = {
        initialText: "01:30 / 03:45"
      };
      const display = new TimePositionDisplay(mockParent, options);

      expect(mockParent.createEl).toHaveBeenCalledWith("span", {
        text: "01:30 / 03:45",
        cls: "time-position"
      });
      expect(display.el).toBe(mockElement);
    });

    it('should create a TimePositionDisplay with custom className', () => {
      const options: TimePositionDisplayOptions = {
        className: "custom-time-display"
      };
      const display = new TimePositionDisplay(mockParent, options);

      expect(mockParent.createEl).toHaveBeenCalledWith("span", {
        text: "00:00 / 00:00",
        cls: "custom-time-display"
      });
      expect(display.el).toBe(mockElement);
    });

    it('should create a TimePositionDisplay with both custom text and className', () => {
      const options: TimePositionDisplayOptions = {
        initialText: "02:15 / 04:30",
        className: "custom-time-display"
      };
      const display = new TimePositionDisplay(mockParent, options);

      expect(mockParent.createEl).toHaveBeenCalledWith("span", {
        text: "02:15 / 04:30",
        cls: "custom-time-display"
      });
      expect(display.el).toBe(mockElement);
    });
  });

  describe('setText', () => {
    let display: TimePositionDisplay;

    beforeEach(() => {
      display = new TimePositionDisplay(mockParent);
    });

    it('should call setText on the span element', () => {
      const newText = "01:23 / 04:56";
      
      display.setText(newText);

      expect(mockElement.setText).toHaveBeenCalledWith(newText);
    });

    it('should handle empty string text', () => {
      display.setText("");

      expect(mockElement.setText).toHaveBeenCalledWith("");
    });

    it('should handle various time format strings', () => {
      const timeFormats = [
        "00:00 / 00:00",
        "01:30 / 03:45",
        "12:34 / 56:78",
        "0:05 / 2:30",
        "Loading...",
        "-- / --"
      ];

      timeFormats.forEach(format => {
        display.setText(format);
        expect(mockElement.setText).toHaveBeenCalledWith(format);
      });
    });

    it('should handle special characters in text', () => {
      const specialText = "播放中 01:30 / 总时长 03:45";
      
      display.setText(specialText);

      expect(mockElement.setText).toHaveBeenCalledWith(specialText);
    });

    it('should handle numeric-only text', () => {
      const numericText = "12345";
      
      display.setText(numericText);

      expect(mockElement.setText).toHaveBeenCalledWith(numericText);
    });
  });

  describe('Element properties', () => {
    let display: TimePositionDisplay;

    beforeEach(() => {
      display = new TimePositionDisplay(mockParent);
    });

    it('should expose the span element as el property', () => {
      expect(display.el).toBe(mockElement);
    });

    it('should maintain reference to the same element', () => {
      const initialElement = display.el;
      
      // Perform some operations
      display.setText("01:00 / 02:00");
      display.setText("02:00 / 02:00");
      
      // Element reference should remain the same
      expect(display.el).toBe(initialElement);
    });

    it('should have correct element type', () => {
      expect(display.el.tagName).toBe('SPAN');
    });
  });

  describe('TimePositionDisplayOptions interface', () => {
    it('should accept no options (undefined)', () => {
      expect(() => new TimePositionDisplay(mockParent)).not.toThrow();
    });

    it('should accept empty options object', () => {
      const options: TimePositionDisplayOptions = {};
      expect(() => new TimePositionDisplay(mockParent, options)).not.toThrow();
    });

    it('should accept options with only initialText', () => {
      const options: TimePositionDisplayOptions = {
        initialText: "Custom Time"
      };
      expect(() => new TimePositionDisplay(mockParent, options)).not.toThrow();
    });

    it('should accept options with only className', () => {
      const options: TimePositionDisplayOptions = {
        className: "custom-class"
      };
      expect(() => new TimePositionDisplay(mockParent, options)).not.toThrow();
    });

    it('should accept options with all properties', () => {
      const options: TimePositionDisplayOptions = {
        initialText: "Custom Time",
        className: "custom-class"
      };
      expect(() => new TimePositionDisplay(mockParent, options)).not.toThrow();
    });
  });

  describe('Integration scenarios', () => {
    it('should handle multiple setText calls', () => {
      const display = new TimePositionDisplay(mockParent);
      
      display.setText("00:10 / 03:00");
      display.setText("00:20 / 03:00");
      display.setText("00:30 / 03:00");

      expect(mockElement.setText).toHaveBeenCalledTimes(3);
      expect(mockElement.setText).toHaveBeenNthCalledWith(1, "00:10 / 03:00");
      expect(mockElement.setText).toHaveBeenNthCalledWith(2, "00:20 / 03:00");
      expect(mockElement.setText).toHaveBeenNthCalledWith(3, "00:30 / 03:00");
    });

    it('should work with different parent elements', () => {
      const anotherMockParent = {
        createEl: vi.fn().mockReturnValue(mockElement),
      } as unknown as HTMLElement;

      const display = new TimePositionDisplay(anotherMockParent);

      expect(anotherMockParent.createEl).toHaveBeenCalledWith("span", {
        text: "00:00 / 00:00",
        cls: "time-position"
      });
      expect(display.el).toBe(mockElement);
    });
  });
});
