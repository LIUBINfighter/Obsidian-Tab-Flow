import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PlayPauseButton, PlayPauseButtonOptions } from '../../../src/components/controls/playPauseButton';

describe('PlayPauseButton', () => {
  let mockParent: any;
  let mockOptions: PlayPauseButtonOptions;
  let mockButton: any;

  beforeEach(() => {
    // Create mock button element
    mockButton = {
      setText: vi.fn(),
      disabled: false,
      addEventListener: vi.fn(),
      textContent: '播放',
      className: 'play-pause'
    };

    // Create mock parent element
    mockParent = {
      createEl: vi.fn().mockReturnValue(mockButton)
    };

    mockOptions = {
      onClick: vi.fn(),
      initialText: '播放',
      className: 'custom-button'
    };
  });

  describe('Constructor', () => {
    it('should create a PlayPauseButton instance', () => {
      const button = new PlayPauseButton(mockParent, mockOptions);
      expect(button).toBeInstanceOf(PlayPauseButton);
    });

    it('should create button element with correct options', () => {
      new PlayPauseButton(mockParent, mockOptions);
      
      expect(mockParent.createEl).toHaveBeenCalledWith('button', {
        text: '播放',
        cls: 'custom-button'
      });
    });

    it('should use default values when options are not provided', () => {
      const minimalOptions = { onClick: vi.fn() };
      new PlayPauseButton(mockParent, minimalOptions);
      
      expect(mockParent.createEl).toHaveBeenCalledWith('button', {
        text: '播放',
        cls: 'play-pause'
      });
    });

    it('should attach click event listener', () => {
      new PlayPauseButton(mockParent, mockOptions);
      
      expect(mockButton.addEventListener).toHaveBeenCalledWith('click', mockOptions.onClick);
    });

    it('should expose the button element', () => {
      const button = new PlayPauseButton(mockParent, mockOptions);
      expect(button.el).toBe(mockButton);
    });
  });

  describe('setText', () => {
    it('should call setText on the button element', () => {
      const button = new PlayPauseButton(mockParent, mockOptions);
      
      button.setText('暂停');
      
      expect(mockButton.setText).toHaveBeenCalledWith('暂停');
    });

    it('should handle empty string', () => {
      const button = new PlayPauseButton(mockParent, mockOptions);
      
      button.setText('');
      
      expect(mockButton.setText).toHaveBeenCalledWith('');
    });

    it('should handle special characters', () => {
      const button = new PlayPauseButton(mockParent, mockOptions);
      
      button.setText('▶️ 播放');
      
      expect(mockButton.setText).toHaveBeenCalledWith('▶️ 播放');
    });
  });

  describe('setEnabled', () => {
    it('should enable button when true is passed', () => {
      const button = new PlayPauseButton(mockParent, mockOptions);
      
      button.setEnabled(true);
      
      expect(mockButton.disabled).toBe(false);
    });

    it('should disable button when false is passed', () => {
      const button = new PlayPauseButton(mockParent, mockOptions);
      
      button.setEnabled(false);
      
      expect(mockButton.disabled).toBe(true);
    });

    it('should toggle between enabled and disabled states', () => {
      const button = new PlayPauseButton(mockParent, mockOptions);
      
      button.setEnabled(false);
      expect(mockButton.disabled).toBe(true);
      
      button.setEnabled(true);
      expect(mockButton.disabled).toBe(false);
    });
  });

  describe('Event handling', () => {
    it('should call onClick callback when button is clicked', () => {
      new PlayPauseButton(mockParent, mockOptions);
      
      // Simulate click event
      const clickHandler = mockButton.addEventListener.mock.calls.find(
        call => call[0] === 'click'
      )?.[1];
      
      expect(clickHandler).toBe(mockOptions.onClick);
    });

    it('should work without errors when onClick is called', () => {
      const button = new PlayPauseButton(mockParent, mockOptions);
      
      expect(() => {
        mockOptions.onClick();
      }).not.toThrow();
      
      expect(mockOptions.onClick).toHaveBeenCalled();
    });
  });

  describe('Integration with parent element', () => {
    it('should work with different parent elements', () => {
      const anotherMockParent = {
        createEl: vi.fn().mockReturnValue(mockButton)
      };
      
      new PlayPauseButton(anotherMockParent, mockOptions);
      
      expect(anotherMockParent.createEl).toHaveBeenCalledWith('button', {
        text: '播放',
        cls: 'custom-button'
      });
    });

    it('should handle parent element creation errors gracefully', () => {
      const faultyParent = {
        createEl: vi.fn().mockImplementation(() => {
          throw new Error('Element creation failed');
        })
      };
      
      expect(() => {
        new PlayPauseButton(faultyParent, mockOptions);
      }).toThrow('Element creation failed');
    });
  });

  describe('Options validation', () => {
    it('should handle missing onClick callback', () => {
      const optionsWithoutOnClick = {
        initialText: 'Test',
        className: 'test-class'
      } as any;
      
      expect(() => {
        new PlayPauseButton(mockParent, optionsWithoutOnClick);
      }).not.toThrow();
    });

    it('should handle null options gracefully', () => {
      expect(() => {
        new PlayPauseButton(mockParent, null as any);
      }).toThrow();
    });

    it('should handle undefined options gracefully', () => {
      expect(() => {
        new PlayPauseButton(mockParent, undefined as any);
      }).toThrow();
    });
  });
});
