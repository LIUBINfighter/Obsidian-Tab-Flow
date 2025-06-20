import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SelectControl } from '../../src/components/controls/SelectControl';

describe('SelectControl', () => {
  let mockOptions: {
    label: string;
    options: Array<{ value: string; text: string }>;
    defaultValue?: string;
    onChange?: (value: string) => void;
  };

  beforeEach(() => {
    mockOptions = {
      label: 'Test Select',
      options: [
        { value: 'option1', text: 'Option 1' },
        { value: 'option2', text: 'Option 2' },
        { value: 'option3', text: 'Option 3' }
      ],
      defaultValue: 'option1',
      onChange: vi.fn()
    };
  });

  describe('Constructor', () => {
    it('should create a SelectControl instance', () => {
      const control = new SelectControl(mockOptions);
      expect(control).toBeInstanceOf(SelectControl);
    });

    it('should set default value correctly', () => {
      const control = new SelectControl(mockOptions);
      expect(control.getValue()).toBe('option1');
    });

    it('should handle missing default value', () => {
      delete mockOptions.defaultValue;
      const control = new SelectControl(mockOptions);
      expect(control.getValue()).toBe('');
    });

    it('should create proper DOM structure', () => {
      const control = new SelectControl(mockOptions);
      const element = control.render();
      
      expect(element.tagName.toLowerCase()).toBe('div');
      expect(element.className).toBe('select-control');
      
      const label = element.querySelector('label');
      expect(label).toBeTruthy();
      expect(label?.textContent).toBe('Test Select');
      
      const select = element.querySelector('select');
      expect(select).toBeTruthy();
      expect(select?.value).toBe('option1');
    });

    it('should create options correctly', () => {
      const control = new SelectControl(mockOptions);
      const element = control.render();
      const select = element.querySelector('select');
      const options = select?.querySelectorAll('option');
      
      expect(options?.length).toBe(3);
      expect(options?.[0].value).toBe('option1');
      expect(options?.[0].textContent).toBe('Option 1');
      expect(options?.[1].value).toBe('option2');
      expect(options?.[1].textContent).toBe('Option 2');
      expect(options?.[2].value).toBe('option3');
      expect(options?.[2].textContent).toBe('Option 3');
    });
  });

  describe('getValue', () => {
    it('should return current value', () => {
      const control = new SelectControl(mockOptions);
      expect(control.getValue()).toBe('option1');
    });

    it('should return empty string when no default value', () => {
      delete mockOptions.defaultValue;
      const control = new SelectControl(mockOptions);
      expect(control.getValue()).toBe('');
    });
  });

  describe('render', () => {
    it('should return HTMLElement', () => {
      const control = new SelectControl(mockOptions);
      const element = control.render();
      // 检查元素是否具有HTMLElement的基本特征
      expect(element).toBeTruthy();
      expect(element.tagName).toBe('DIV');
      expect(typeof element.appendChild).toBe('function');
      expect(typeof element.querySelector).toBe('function');
    });

    it('should return the same element on multiple calls', () => {
      const control = new SelectControl(mockOptions);
      const element1 = control.render();
      const element2 = control.render();
      expect(element1).toBe(element2);
    });
  });

  describe('onChange callback', () => {
    it('should call onChange when value changes', () => {
      const control = new SelectControl(mockOptions);
      const element = control.render();
      const select = element.querySelector('select') as HTMLSelectElement;
      
      // Simulate change event
      select.value = 'option2';
      const changeEvent = new Event('change');
      select.dispatchEvent(changeEvent);
      
      expect(mockOptions.onChange).toHaveBeenCalledWith('option2');
      expect(control.getValue()).toBe('option2');
    });

    it('should update internal value when select changes', () => {
      const control = new SelectControl(mockOptions);
      const element = control.render();
      const select = element.querySelector('select') as HTMLSelectElement;
      
      select.value = 'option3';
      const changeEvent = new Event('change');
      select.dispatchEvent(changeEvent);
      
      expect(control.getValue()).toBe('option3');
    });

    it('should handle missing onChange callback gracefully', () => {
      delete mockOptions.onChange;
      const control = new SelectControl(mockOptions);
      const element = control.render();
      const select = element.querySelector('select') as HTMLSelectElement;
      
      expect(() => {
        select.value = 'option2';
        const changeEvent = new Event('change');
        select.dispatchEvent(changeEvent);
      }).not.toThrow();
      
      expect(control.getValue()).toBe('option2');
    });
  });

  describe('Edge cases', () => {
    it('should handle empty options array', () => {
      mockOptions.options = [];
      const control = new SelectControl(mockOptions);
      const element = control.render();
      const select = element.querySelector('select');
      const options = select?.querySelectorAll('option');
      
      expect(options?.length).toBe(0);
    });

    it('should handle options with empty values', () => {
      mockOptions.options = [
        { value: '', text: 'Empty Option' },
        { value: 'valid', text: 'Valid Option' }
      ];
      const control = new SelectControl(mockOptions);
      const element = control.render();
      const select = element.querySelector('select');
      const options = select?.querySelectorAll('option');
      
      expect(options?.[0].value).toBe('');
      expect(options?.[0].textContent).toBe('Empty Option');
    });

    it('should handle special characters in options', () => {
      mockOptions.options = [
        { value: 'special&chars', text: 'Option with & chars' },
        { value: 'unicode🎵', text: 'Unicode 🎵 Option' }
      ];
      const control = new SelectControl(mockOptions);
      const element = control.render();
      const select = element.querySelector('select');
      const options = select?.querySelectorAll('option');
      
      expect(options?.[0].value).toBe('special&chars');
      expect(options?.[1].value).toBe('unicode🎵');
    });
  });
});
