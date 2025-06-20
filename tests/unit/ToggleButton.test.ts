import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ToggleButton } from '../../src/components/controls/ToggleButton';

// Mock document.createElement globally
global.document = {
  createElement: vi.fn().mockImplementation((tagName: string) => {
    const element = {
      tagName: tagName.toUpperCase(),
      textContent: '',
      style: {},
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      click: vi.fn(),
      dispatchEvent: vi.fn(),
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
      ownerDocument: global.document,
      nodeType: 1,
      className: '',
    };
    return element;
  })
} as any;

describe('ToggleButton', () => {
  let mockElement: HTMLButtonElement;
  let mockOnClick: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockOnClick = vi.fn();
    
    // Reset the mock implementation
    mockElement = {
      tagName: 'BUTTON',
      textContent: '',
      style: {},
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      click: vi.fn(),
      dispatchEvent: vi.fn(),
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
      ownerDocument: global.document,
      nodeType: 1,
      className: '',
    } as unknown as HTMLButtonElement;

    (global.document.createElement as any).mockReturnValue(mockElement);
  });

  describe('Constructor', () => {
    it('should create a ToggleButton with minimal options', () => {
      const button = new ToggleButton({ text: 'Toggle' });

      expect(global.document.createElement).toHaveBeenCalledWith('button');
      expect(mockElement.textContent).toBe('Toggle');
      expect(mockElement.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
    });

    it('should create a ToggleButton with active state', () => {
      const button = new ToggleButton({ 
        text: 'Toggle', 
        active: true 
      });

      expect(button.isActive()).toBe(true);
      expect(mockElement.style.backgroundColor).toBe('var(--interactive-accent)');
      expect(mockElement.style.color).toBe('var(--text-on-accent)');
    });

    it('should create a ToggleButton with inactive state by default', () => {
      const button = new ToggleButton({ text: 'Toggle' });

      expect(button.isActive()).toBe(false);
      expect(mockElement.style.backgroundColor).toBe('var(--background-modifier-form-field)');
      expect(mockElement.style.color).toBe('var(--text-normal)');
    });

    it('should create a ToggleButton with onClick callback', () => {
      const button = new ToggleButton({ 
        text: 'Toggle', 
        onClick: mockOnClick 
      });

      expect(button.isActive()).toBe(false);
      expect(mockElement.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
    });

    it('should handle all options together', () => {
      const button = new ToggleButton({ 
        text: 'Custom Toggle', 
        active: true,
        onClick: mockOnClick 
      });

      expect(button.isActive()).toBe(true);
      expect(mockElement.textContent).toBe('Custom Toggle');
      expect(mockElement.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
    });
  });

  describe('Click handling', () => {
    it('should toggle state when clicked', () => {
      const button = new ToggleButton({ text: 'Toggle' });
      
      // Initially inactive
      expect(button.isActive()).toBe(false);

      // Simulate click by calling the event handler
      const clickHandler = (mockElement.addEventListener as any).mock.calls[0][1];
      clickHandler();

      // Should now be active
      expect(button.isActive()).toBe(true);
    });

    it('should call onClick callback when clicked', () => {
      const button = new ToggleButton({ 
        text: 'Toggle', 
        onClick: mockOnClick 
      });

      // Simulate click
      const clickHandler = (mockElement.addEventListener as any).mock.calls[0][1];
      clickHandler();

      expect(mockOnClick).toHaveBeenCalledWith(true);
    });

    it('should toggle state multiple times', () => {
      const button = new ToggleButton({ 
        text: 'Toggle', 
        onClick: mockOnClick 
      });

      const clickHandler = (mockElement.addEventListener as any).mock.calls[0][1];

      // First click: false -> true
      clickHandler();
      expect(button.isActive()).toBe(true);
      expect(mockOnClick).toHaveBeenCalledWith(true);

      // Second click: true -> false
      clickHandler();
      expect(button.isActive()).toBe(false);
      expect(mockOnClick).toHaveBeenCalledWith(false);

      // Third click: false -> true
      clickHandler();
      expect(button.isActive()).toBe(true);
      expect(mockOnClick).toHaveBeenCalledWith(true);
    });

    it('should not call onClick callback if not provided', () => {
      const button = new ToggleButton({ text: 'Toggle' });

      const clickHandler = (mockElement.addEventListener as any).mock.calls[0][1];
      
      // Should not throw error when onClick is not provided
      expect(() => clickHandler()).not.toThrow();
      expect(button.isActive()).toBe(true); // Should still toggle state
    });
  });

  describe('setActive method', () => {
    it('should set active state to true', () => {
      const button = new ToggleButton({ text: 'Toggle' });
      
      button.setActive(true);
      
      expect(button.isActive()).toBe(true);
      expect(mockElement.style.backgroundColor).toBe('var(--interactive-accent)');
      expect(mockElement.style.color).toBe('var(--text-on-accent)');
    });

    it('should set active state to false', () => {
      const button = new ToggleButton({ text: 'Toggle', active: true });
      
      button.setActive(false);
      
      expect(button.isActive()).toBe(false);
      expect(mockElement.style.backgroundColor).toBe('var(--background-modifier-form-field)');
      expect(mockElement.style.color).toBe('var(--text-normal)');
    });

    it('should update styles when setting active state', () => {
      const button = new ToggleButton({ text: 'Toggle' });
      
      // Set to active
      button.setActive(true);
      expect(mockElement.style.backgroundColor).toBe('var(--interactive-accent)');
      expect(mockElement.style.color).toBe('var(--text-on-accent)');

      // Set to inactive
      button.setActive(false);
      expect(mockElement.style.backgroundColor).toBe('var(--background-modifier-form-field)');
      expect(mockElement.style.color).toBe('var(--text-normal)');
    });

    it('should not trigger onClick callback when using setActive', () => {
      const button = new ToggleButton({ 
        text: 'Toggle', 
        onClick: mockOnClick 
      });
      
      button.setActive(true);
      button.setActive(false);
      
      // onClick should not be called
      expect(mockOnClick).not.toHaveBeenCalled();
    });
  });

  describe('isActive method', () => {
    it('should return correct active state', () => {
      const inactiveButton = new ToggleButton({ text: 'Toggle' });
      const activeButton = new ToggleButton({ text: 'Toggle', active: true });

      expect(inactiveButton.isActive()).toBe(false);
      expect(activeButton.isActive()).toBe(true);
    });

    it('should reflect state changes', () => {
      const button = new ToggleButton({ text: 'Toggle' });

      expect(button.isActive()).toBe(false);
      
      button.setActive(true);
      expect(button.isActive()).toBe(true);
      
      button.setActive(false);
      expect(button.isActive()).toBe(false);
    });
  });

  describe('getElement method', () => {
    it('should return the button element', () => {
      const button = new ToggleButton({ text: 'Toggle' });
      
      expect(button.getElement()).toBe(mockElement);
    });

    it('should maintain same element reference', () => {
      const button = new ToggleButton({ text: 'Toggle' });
      const element1 = button.getElement();
      
      button.setActive(true);
      const element2 = button.getElement();
      
      button.setActive(false);
      const element3 = button.getElement();

      expect(element1).toBe(element2);
      expect(element2).toBe(element3);
      expect(element1).toBe(mockElement);
    });
  });

  describe('Style updates', () => {
    it('should apply correct styles for active state', () => {
      const button = new ToggleButton({ text: 'Toggle', active: true });

      expect(mockElement.style.backgroundColor).toBe('var(--interactive-accent)');
      expect(mockElement.style.color).toBe('var(--text-on-accent)');
    });

    it('should apply correct styles for inactive state', () => {
      const button = new ToggleButton({ text: 'Toggle', active: false });

      expect(mockElement.style.backgroundColor).toBe('var(--background-modifier-form-field)');
      expect(mockElement.style.color).toBe('var(--text-normal)');
    });

    it('should update styles when toggled via click', () => {
      const button = new ToggleButton({ text: 'Toggle' });
      const clickHandler = (mockElement.addEventListener as any).mock.calls[0][1];

      // Initially inactive styles
      expect(mockElement.style.backgroundColor).toBe('var(--background-modifier-form-field)');
      expect(mockElement.style.color).toBe('var(--text-normal)');

      // Click to activate
      clickHandler();
      expect(mockElement.style.backgroundColor).toBe('var(--interactive-accent)');
      expect(mockElement.style.color).toBe('var(--text-on-accent)');

      // Click to deactivate
      clickHandler();
      expect(mockElement.style.backgroundColor).toBe('var(--background-modifier-form-field)');
      expect(mockElement.style.color).toBe('var(--text-normal)');
    });
  });

  describe('Integration scenarios', () => {
    it('should work correctly with complex interactions', () => {
      const button = new ToggleButton({ 
        text: 'Complex Toggle', 
        active: false,
        onClick: mockOnClick 
      });

      const clickHandler = (mockElement.addEventListener as any).mock.calls[0][1];

      // Manual activation
      button.setActive(true);
      expect(button.isActive()).toBe(true);
      expect(mockOnClick).not.toHaveBeenCalled();

      // Click to deactivate
      clickHandler();
      expect(button.isActive()).toBe(false);
      expect(mockOnClick).toHaveBeenCalledWith(false);

      // Click to activate
      clickHandler();
      expect(button.isActive()).toBe(true);
      expect(mockOnClick).toHaveBeenCalledWith(true);

      // Manual deactivation
      button.setActive(false);
      expect(button.isActive()).toBe(false);
      expect(mockOnClick).toHaveBeenCalledTimes(2); // Should still be 2
    });
  });

  describe('Metronome Button Specific Tests', () => {
    it('should create metronome button with correct text', () => {
      const metronomeButton = new ToggleButton({
        text: '节拍器',
        active: false,
        onClick: mockOnClick
      });

      expect(metronomeButton.getElement().textContent).toBe('节拍器');
      expect(metronomeButton.isActive()).toBe(false);
    });

    it('should handle metronome toggle functionality', () => {
      const metronomeCallback = vi.fn();
      const metronomeButton = new ToggleButton({
        text: '节拍器',
        active: false,
        onClick: (active: boolean) => {
          // Simulate metronome volume change
          metronomeCallback(active ? 1 : 0);
        }
      });

      // Get the click handler that was registered
      const element = metronomeButton.getElement();
      const addEventListenerSpy = element.addEventListener as any;
      const clickHandler = addEventListenerSpy.mock.calls.find(
        (call: any) => call[0] === 'click'
      )?.[1];

      expect(clickHandler).toBeDefined();

      if (clickHandler) {
        // First click - should activate
        clickHandler();
        expect(metronomeCallback).toHaveBeenCalledWith(1); // Volume on
        
        // Second click - should deactivate
        clickHandler();
        expect(metronomeCallback).toHaveBeenCalledWith(0); // Volume off
      }
    });
  });

  describe('Count-In Button Specific Tests', () => {
    it('should create count-in button with correct text', () => {
      const countInButton = new ToggleButton({
        text: '前置四拍',
        active: false,
        onClick: mockOnClick
      });

      expect(countInButton.getElement().textContent).toBe('前置四拍');
      expect(countInButton.isActive()).toBe(false);
    });

    it('should handle count-in toggle functionality', () => {
      const countInCallback = vi.fn();
      const countInButton = new ToggleButton({
        text: '前置四拍',
        active: false,
        onClick: (active: boolean) => {
          // Simulate count-in volume change
          countInCallback(active ? 1 : 0);
        }
      });

      // Get the click handler that was registered
      const element = countInButton.getElement();
      const addEventListenerSpy = element.addEventListener as any;
      const clickHandler = addEventListenerSpy.mock.calls.find(
        (call: any) => call[0] === 'click'
      )?.[1];

      expect(clickHandler).toBeDefined();

      if (clickHandler) {
        // First click - should activate
        clickHandler();
        expect(countInCallback).toHaveBeenCalledWith(1); // Volume on
        
        // Second click - should deactivate
        clickHandler();
        expect(countInCallback).toHaveBeenCalledWith(0); // Volume off
      }
    });
  });
});
