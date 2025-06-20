import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StopButton, StopButtonOptions } from '../../src/components/controls/StopButton';

describe('StopButton', () => {
  let mockParent: HTMLElement;
  let mockElement: HTMLButtonElement;
  let mockOnClick: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockOnClick = vi.fn();
    
    // Create mock button element
    mockElement = {
      setText: vi.fn(),
      disabled: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      click: vi.fn(),
      dispatchEvent: vi.fn(),
      textContent: '',
      className: '',
      style: {},
      tagName: 'BUTTON',
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
      parentNode: null,
      childNodes: [],
      children: [],
      firstChild: null,
      lastChild: null,
      nextSibling: null,
      previousSibling: null,
      ownerDocument: null,
    } as unknown as HTMLButtonElement;

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
    it('should create a StopButton with default options', () => {
      const options: StopButtonOptions = {
        onClick: mockOnClick
      };

      const stopButton = new StopButton(mockParent, options);

      expect(mockParent.createEl).toHaveBeenCalledWith("button", {
        text: "停止",
        cls: "stop-button"
      });
      expect(mockElement.addEventListener).toHaveBeenCalledWith("click", mockOnClick);
      expect(stopButton.el).toBe(mockElement);
    });

    it('should create a StopButton with custom initial text', () => {
      const options: StopButtonOptions = {
        onClick: mockOnClick,
        initialText: "Custom Stop"
      };

      const stopButton = new StopButton(mockParent, options);

      expect(mockParent.createEl).toHaveBeenCalledWith("button", {
        text: "Custom Stop",
        cls: "stop-button"
      });
      expect(stopButton.el).toBe(mockElement);
    });

    it('should create a StopButton with custom className', () => {
      const options: StopButtonOptions = {
        onClick: mockOnClick,
        className: "custom-stop-button"
      };

      const stopButton = new StopButton(mockParent, options);

      expect(mockParent.createEl).toHaveBeenCalledWith("button", {
        text: "停止",
        cls: "custom-stop-button"
      });
      expect(stopButton.el).toBe(mockElement);
    });

    it('should create a StopButton with both custom text and className', () => {
      const options: StopButtonOptions = {
        onClick: mockOnClick,
        initialText: "Custom Stop",
        className: "custom-stop-button"
      };

      const stopButton = new StopButton(mockParent, options);

      expect(mockParent.createEl).toHaveBeenCalledWith("button", {
        text: "Custom Stop",
        cls: "custom-stop-button"
      });
      expect(stopButton.el).toBe(mockElement);
    });

    it('should attach click event listener to the button', () => {
      const options: StopButtonOptions = {
        onClick: mockOnClick
      };

      new StopButton(mockParent, options);

      expect(mockElement.addEventListener).toHaveBeenCalledWith("click", mockOnClick);
    });
  });

  describe('setText', () => {
    let stopButton: StopButton;

    beforeEach(() => {
      const options: StopButtonOptions = {
        onClick: mockOnClick
      };
      stopButton = new StopButton(mockParent, options);
    });

    it('should call setText on the button element', () => {
      const newText = "New Stop Text";
      
      stopButton.setText(newText);

      expect(mockElement.setText).toHaveBeenCalledWith(newText);
    });

    it('should handle empty string text', () => {
      stopButton.setText("");

      expect(mockElement.setText).toHaveBeenCalledWith("");
    });

    it('should handle special characters in text', () => {
      const specialText = "停止 & 重置 <button>";
      
      stopButton.setText(specialText);

      expect(mockElement.setText).toHaveBeenCalledWith(specialText);
    });
  });

  describe('setEnabled', () => {
    let stopButton: StopButton;

    beforeEach(() => {
      const options: StopButtonOptions = {
        onClick: mockOnClick
      };
      stopButton = new StopButton(mockParent, options);
    });

    it('should enable the button when enabled is true', () => {
      stopButton.setEnabled(true);

      expect(mockElement.disabled).toBe(false);
    });

    it('should disable the button when enabled is false', () => {
      stopButton.setEnabled(false);

      expect(mockElement.disabled).toBe(true);
    });

    it('should toggle button state correctly', () => {
      // Initially enabled
      stopButton.setEnabled(true);
      expect(mockElement.disabled).toBe(false);

      // Then disabled
      stopButton.setEnabled(false);
      expect(mockElement.disabled).toBe(true);

      // Then enabled again
      stopButton.setEnabled(true);
      expect(mockElement.disabled).toBe(false);
    });
  });

  describe('Element properties', () => {
    let stopButton: StopButton;

    beforeEach(() => {
      const options: StopButtonOptions = {
        onClick: mockOnClick
      };
      stopButton = new StopButton(mockParent, options);
    });

    it('should expose the button element as el property', () => {
      expect(stopButton.el).toBe(mockElement);
    });

    it('should maintain reference to the same element', () => {
      const initialElement = stopButton.el;
      
      // Perform some operations
      stopButton.setText("New Text");
      stopButton.setEnabled(false);
      
      // Element reference should remain the same
      expect(stopButton.el).toBe(initialElement);
    });
  });

  describe('StopButtonOptions interface', () => {
    it('should accept minimal required options', () => {
      const options: StopButtonOptions = {
        onClick: mockOnClick
      };

      expect(() => new StopButton(mockParent, options)).not.toThrow();
    });

    it('should accept options with all properties', () => {
      const options: StopButtonOptions = {
        onClick: mockOnClick,
        initialText: "Custom Stop",
        className: "custom-class"
      };

      expect(() => new StopButton(mockParent, options)).not.toThrow();
    });

    it('should handle onClick function properly', () => {
      const customOnClick = vi.fn();
      const options: StopButtonOptions = {
        onClick: customOnClick
      };

      new StopButton(mockParent, options);

      expect(mockElement.addEventListener).toHaveBeenCalledWith("click", customOnClick);
    });
  });
});
