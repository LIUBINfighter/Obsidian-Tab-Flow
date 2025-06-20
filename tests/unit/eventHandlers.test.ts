import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { handleAlphaTabError } from '@/events/handleAlphaTabError';
import { handleAlphaTabRenderStarted } from '@/events/handleAlphaTabRenderStarted';
import { handleAlphaTabRenderFinished } from '@/events/handleAlphaTabRenderFinished';
import { handleAlphaTabScoreLoaded } from '@/events/handleAlphaTabScoreLoaded';
import { handlePlayerStateChanged } from '@/events/handlePlayerStateChanged';
import { handlePlayerPositionChanged } from '@/events/handlePlayerPositionChanged';

describe('Event Handlers', () => {
  let mockUIManager: any;
  let mockAPI: any;
  let mockLeaf: any;
  let consoleSpy: any;

  beforeEach(() => {
    mockUIManager = {
      showLoadingOverlay: vi.fn(),
      hideLoadingOverlay: vi.fn(),
      showErrorInOverlay: vi.fn(),
      setPlayPauseButtonText: vi.fn(),
      setStopButtonEnabled: vi.fn(),
      updateTimePosition: vi.fn()
    };

    mockAPI = {
      render: vi.fn(),
      score: { title: 'Test Score' }
    };

    mockLeaf = {
      updateHeader: vi.fn()
    };

    consoleSpy = {
      error: vi.spyOn(console, 'error').mockImplementation(() => {}),
      debug: vi.spyOn(console, 'debug').mockImplementation(() => {}),
      log: vi.spyOn(console, 'log').mockImplementation(() => {})
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('handleAlphaTabError', () => {
    it('should log error to console', () => {
      const error = { 
        message: 'Test error message',
        stack: 'Error stack trace'
      };

      handleAlphaTabError(error, mockUIManager);

      expect(consoleSpy.error).toHaveBeenCalledWith('[AlphaTab Internal Error]', error);
      expect(consoleSpy.debug).toHaveBeenCalledWith('Error stack:', error.stack);
    });

    it('should handle error without stack trace', () => {
      const error = { message: 'Test error without stack' };

      handleAlphaTabError(error, mockUIManager);

      expect(consoleSpy.error).toHaveBeenCalledWith('[AlphaTab Internal Error]', error);
      expect(consoleSpy.debug).not.toHaveBeenCalled();
    });

    it('should handle error without message', () => {
      const error = {};

      handleAlphaTabError(error, mockUIManager);

      expect(consoleSpy.error).toHaveBeenCalledWith('[AlphaTab Internal Error]', error);
    });
  });

  describe('handleAlphaTabRenderStarted', () => {
    it('should show loading overlay with render message', () => {
      handleAlphaTabRenderStarted(mockUIManager);

      expect(mockUIManager.showLoadingOverlay).toHaveBeenCalledWith('Rendering sheet...');
    });
  });

  describe('handleAlphaTabRenderFinished', () => {
    it('should hide loading overlay', () => {
      handleAlphaTabRenderFinished(mockUIManager, mockLeaf);

      expect(mockUIManager.hideLoadingOverlay).toHaveBeenCalled();
    });

    it('should update leaf header if available', () => {
      handleAlphaTabRenderFinished(mockUIManager, mockLeaf);

      expect(mockLeaf.updateHeader).toHaveBeenCalled();
    });

    it('should handle missing leaf gracefully', () => {
      expect(() => {
        handleAlphaTabRenderFinished(mockUIManager, null);
      }).not.toThrow();

      expect(mockUIManager.hideLoadingOverlay).toHaveBeenCalled();
    });

    it('should handle leaf without updateHeader method', () => {
      const leafWithoutUpdate = {};

      expect(() => {
        handleAlphaTabRenderFinished(mockUIManager, leafWithoutUpdate);
      }).not.toThrow();
    });
  });

  describe('handleAlphaTabScoreLoaded', () => {
    const mockScore = {
      tracks: [
        { name: 'Track 1', index: 0 },
        { name: 'Track 2', index: 1 }
      ]
    };

    it('should hide loading overlay', () => {
      handleAlphaTabScoreLoaded(mockScore, mockUIManager, null, mockAPI, mockLeaf);

      expect(mockUIManager.hideLoadingOverlay).toHaveBeenCalled();
    });

    it('should update tracks modal when provided', () => {
      const mockTracksModal = {
        setTracks: vi.fn(),
        setRenderTracks: vi.fn()
      };

      handleAlphaTabScoreLoaded(mockScore, mockUIManager, mockTracksModal, mockAPI, mockLeaf);

      expect(mockTracksModal.setTracks).toHaveBeenCalledWith(mockScore.tracks);
      expect(mockTracksModal.setRenderTracks).toHaveBeenCalledWith([mockScore.tracks[0]]);
      expect(mockAPI.render).toHaveBeenCalled();
    });

    it('should handle score without tracks', () => {
      const scoreWithoutTracks = { tracks: [] };
      const mockTracksModal = {
        setTracks: vi.fn(),
        setRenderTracks: vi.fn()
      };

      handleAlphaTabScoreLoaded(scoreWithoutTracks, mockUIManager, mockTracksModal, mockAPI, mockLeaf);

      expect(mockTracksModal.setRenderTracks).toHaveBeenCalledWith([]);
    });

    it('should update leaf header if available', () => {
      handleAlphaTabScoreLoaded(mockScore, mockUIManager, null, mockAPI, mockLeaf);

      expect(mockLeaf.updateHeader).toHaveBeenCalled();
    });

    it('should handle null tracks modal gracefully', () => {
      expect(() => {
        handleAlphaTabScoreLoaded(mockScore, mockUIManager, null, mockAPI, mockLeaf);
      }).not.toThrow();
    });
  });

  describe('handlePlayerStateChanged', () => {
    it('should update play button text to "播放" when stopped', () => {
      const args = { state: 0 }; // Stopped state

      handlePlayerStateChanged(args, mockUIManager);

      expect(mockUIManager.setPlayPauseButtonText).toHaveBeenCalledWith('播放');
      expect(mockUIManager.setStopButtonEnabled).toHaveBeenCalledWith(false);
    });

    it('should update play button text to "暂停" when playing', () => {
      const args = { state: 1 }; // Playing state

      handlePlayerStateChanged(args, mockUIManager);

      expect(mockUIManager.setPlayPauseButtonText).toHaveBeenCalledWith('暂停');
      expect(mockUIManager.setStopButtonEnabled).toHaveBeenCalledWith(true);
    });

    it('should update play button text to "播放" when paused', () => {
      const args = { state: 2 }; // Paused state

      handlePlayerStateChanged(args, mockUIManager);

      expect(mockUIManager.setPlayPauseButtonText).toHaveBeenCalledWith('播放');
      expect(mockUIManager.setStopButtonEnabled).toHaveBeenCalledWith(true);
    });

    it('should handle unknown state gracefully', () => {
      const args = { state: 99 }; // Unknown state

      expect(() => {
        handlePlayerStateChanged(args, mockUIManager);
      }).not.toThrow();
    });
  });

  describe('handlePlayerPositionChanged', () => {
    it('should update time position display', () => {
      const args = {
        currentTime: 65000, // 65 seconds = 01:05
        endTime: 240000 // 240 seconds = 04:00
      };

      handlePlayerPositionChanged(args, mockUIManager, mockAPI);

      expect(mockUIManager.updateTimePosition).toHaveBeenCalledWith('01:05', '04:00');
    });

    it('should handle zero times correctly', () => {
      const args = {
        currentTime: 0,
        endTime: 0
      };

      handlePlayerPositionChanged(args, mockUIManager, mockAPI);

      expect(mockUIManager.updateTimePosition).toHaveBeenCalledWith('00:00', '00:00');
    });

    it('should handle large times correctly', () => {
      const args = {
        currentTime: 3661000, // 61 minutes 1 second = 61:01
        endTime: 7200000 // 120 minutes = 120:00
      };

      handlePlayerPositionChanged(args, mockUIManager, mockAPI);

      expect(mockUIManager.updateTimePosition).toHaveBeenCalledWith('61:01', '120:00');
    });

    it('should handle missing arguments gracefully', () => {
      expect(() => {
        handlePlayerPositionChanged({} as any, mockUIManager, mockAPI);
      }).not.toThrow();
    });
  });
});
