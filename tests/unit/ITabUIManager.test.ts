import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ITabUIManager, type ITabUIManagerOptions } from '@/ITabUIManager';

describe('ITabUIManager', () => {
  let uiManager: ITabUIManager;
  let mockContainer: HTMLElement;

  beforeEach(() => {
    // Create a mock container
    mockContainer = document.createElement('div');
    document.body.appendChild(mockContainer);

    const options: ITabUIManagerOptions = {
      container: mockContainer
    };

    uiManager = new ITabUIManager(options);
  });

  afterEach(() => {
    // Clean up
    if (mockContainer.parentNode) {
      mockContainer.parentNode.removeChild(mockContainer);
    }
  });

  describe('Constructor and UI Creation', () => {
    it('should create UI structure correctly', () => {
      expect(uiManager.atWrap).toBeDefined();
      expect(uiManager.atOverlayRef).toBeDefined();
      expect(uiManager.atOverlayContentRef).toBeDefined();
      expect(uiManager.atMainRef).toBeDefined();
      expect(uiManager.atViewportRef).toBeDefined();
      expect(uiManager.atControlsRef).toBeDefined();
    });

    it('should attach UI to container', () => {
      const wrapper = mockContainer.querySelector('.at-wrap');
      expect(wrapper).toBeTruthy();
    });

    it('should create overlay with hidden state', () => {
      expect(uiManager.atOverlayRef.style.display).toBe('none');
    });

    it('should have proper CSS classes', () => {
      expect(uiManager.atWrap.classList.contains('at-wrap')).toBe(true);
      expect(uiManager.atOverlayRef.classList.contains('at-overlay')).toBe(true);
      expect(uiManager.atMainRef.classList.contains('at-main')).toBe(true);
      expect(uiManager.atViewportRef.classList.contains('at-viewport')).toBe(true);
      expect(uiManager.atControlsRef.classList.contains('at-controls')).toBe(true);
    });
  });

  describe('Control Bar Rendering', () => {
    let onPlayPauseSpy: ReturnType<typeof vi.fn>;
    let onStopSpy: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      onPlayPauseSpy = vi.fn();
      onStopSpy = vi.fn();
      
      uiManager.renderControlBar(onPlayPauseSpy, onStopSpy);
    });

    it('should create play/pause button', () => {
      expect(uiManager.playPauseButton).toBeDefined();
    });

    it('should create stop button', () => {
      expect(uiManager.stopButton).toBeDefined();
    });

    it('should create time position display', () => {
      expect(uiManager.timePositionDisplay).toBeDefined();
    });

    it('should create layout control', () => {
      expect(uiManager.layoutControl).toBeDefined();
    });

    it('should create zoom control', () => {
      expect(uiManager.zoomControl).toBeDefined();
    });

    it('should create speed control', () => {
      expect(uiManager.speedControl).toBeDefined();
    });

    it('should create metronome button', () => {
      expect(uiManager.metronomeButton).toBeDefined();
    });

    it('should create count-in button', () => {
      expect(uiManager.countInButton).toBeDefined();
    });

    it('should disable stop button initially', () => {
      expect(uiManager.stopButton.getElement().disabled).toBe(true);
    });
  });

  describe('Loading Overlay', () => {
    it('should show loading overlay with message', () => {
      const message = 'Loading...';
      
      uiManager.showLoadingOverlay(message);
      
      expect(uiManager.atOverlayRef.style.display).toBe('flex');
      expect(uiManager.atOverlayContentRef.textContent).toBe(message);
      expect(uiManager.atOverlayRef.classList.contains('error')).toBe(false);
    });

    it('should hide loading overlay', () => {
      uiManager.showLoadingOverlay('Loading...');
      uiManager.hideLoadingOverlay();
      
      expect(uiManager.atOverlayRef.style.display).toBe('none');
      expect(uiManager.atOverlayRef.classList.contains('error')).toBe(false);
    });
  });

  describe('Error Overlay', () => {
    it('should show error overlay with message', () => {
      const errorMessage = 'An error occurred';
      
      uiManager.showErrorInOverlay(errorMessage);
      
      expect(uiManager.atOverlayRef.style.display).toBe('flex');
      expect(uiManager.atOverlayContentRef.textContent).toBe(errorMessage);
      expect(uiManager.atOverlayRef.classList.contains('error')).toBe(true);
    });

    it('should auto-hide error overlay after timeout', (done) => {
      const timeout = 100; // Short timeout for testing
      
      uiManager.showErrorInOverlay('Error', timeout);
      
      setTimeout(() => {
        expect(uiManager.atOverlayRef.style.display).toBe('none');
        expect(uiManager.atOverlayRef.classList.contains('error')).toBe(false);
        done();
      }, timeout + 50);
    });

    it('should not auto-hide when timeout is 0', () => {
      uiManager.showErrorInOverlay('Persistent error', 0);
      
      expect(uiManager.atOverlayRef.style.display).toBe('flex');
      expect(uiManager.atOverlayRef.classList.contains('error')).toBe(true);
    });

    it('should manually hide error overlay', () => {
      uiManager.showErrorInOverlay('Error');
      uiManager.hideErrorOverlay();
      
      expect(uiManager.atOverlayRef.style.display).toBe('none');
      expect(uiManager.atOverlayRef.classList.contains('error')).toBe(false);
    });
  });

  describe('Button State Management', () => {
    beforeEach(() => {
      uiManager.renderControlBar(vi.fn(), vi.fn());
    });

    it('should update play/pause button text', () => {
      const newText = 'Pause';
      
      uiManager.setPlayPauseButtonText(newText);
      
      expect(uiManager.playPauseButton.getText()).toBe(newText);
    });

    it('should enable/disable stop button', () => {
      uiManager.setStopButtonEnabled(true);
      expect(uiManager.stopButton.getElement().disabled).toBe(false);
      
      uiManager.setStopButtonEnabled(false);
      expect(uiManager.stopButton.getElement().disabled).toBe(true);
    });
  });

  describe('Time Position Display', () => {
    beforeEach(() => {
      uiManager.renderControlBar(vi.fn(), vi.fn());
    });

    it('should update time position display', () => {
      const currentTime = '02:30';
      const totalTime = '04:15';
      
      uiManager.updateTimePosition(currentTime, totalTime);
      
      const expectedText = `${currentTime} / ${totalTime}`;
      expect(uiManager.timePositionDisplay.getText()).toBe(expectedText);
    });
  });

  describe('Toggle Button States', () => {
    beforeEach(() => {
      uiManager.renderControlBar(vi.fn(), vi.fn());
    });

    it('should set metronome button active state', () => {
      uiManager.setMetronomeActive(true);
      expect(uiManager.metronomeButton.isActive()).toBe(true);
      
      uiManager.setMetronomeActive(false);
      expect(uiManager.metronomeButton.isActive()).toBe(false);
    });

    it('should set count-in button active state', () => {
      uiManager.setCountInActive(true);
      expect(uiManager.countInButton.isActive()).toBe(true);
      
      uiManager.setCountInActive(false);
      expect(uiManager.countInButton.isActive()).toBe(false);
    });
  });

  describe('Null Safety', () => {
    it('should handle null button references gracefully', () => {
      // Don't render control bar, so buttons are undefined
      
      expect(() => {
        uiManager.setPlayPauseButtonText('Test');
        uiManager.setStopButtonEnabled(true);
        uiManager.updateTimePosition('00:00', '00:00');
        uiManager.setMetronomeActive(true);
        uiManager.setCountInActive(true);
      }).not.toThrow();
    });
  });
});
