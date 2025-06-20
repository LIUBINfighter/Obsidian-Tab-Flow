import { describe, it, expect, vi } from 'vitest';
import { FontManager } from '@/alphatab/FontManager';

describe('FontManager', () => {
  beforeEach(() => {
    // Clear any existing font styles
    FontManager.removeInjectedFontFaces();
    
    // Mock document.head
    document.head.innerHTML = '';
    
    // Clear element registries - access global linkElements from setup.ts
    if (global.linkElements) {
      global.linkElements.clear();
    }
    
    // Clear removed elements tracking
    if ((global as any).removedElements) {
      (global as any).removedElements.clear();
    }
  });

  describe('injectFontFaces', () => {
    it('should inject font faces for given font data', () => {
      const fontData = {
        'font1.woff2': 'data:font/woff2;base64,mockdata1',
        'font1.woff': 'data:font/woff;base64,mockdata2'
      };
      const fontFamilies = ['TestFont'];

      const result = FontManager.injectFontFaces(fontData, fontFamilies);

      expect(result).toBe(true);
      
      const styleElement = document.getElementById(FontManager.FONT_STYLE_ELEMENT_ID);
      expect(styleElement).toBeTruthy();
      expect(styleElement?.tagName).toBe('STYLE');
    });    it('should create proper CSS font-face rules', () => {
      const fontData = {
        'Bravura.woff2': 'data:font/woff2;base64,mockdata'
      };
      const fontFamilies = ['Bravura'];

      FontManager.injectFontFaces(fontData, fontFamilies);

      const styleElement = document.getElementById(FontManager.FONT_STYLE_ELEMENT_ID);
      const cssText = styleElement?.textContent || '';
      
      expect(cssText).toContain('@font-face');
      expect(cssText).toContain('font-family: Bravura'); // No quotes for simple font names
      expect(cssText).toContain('src: url(\'data:font/woff2;base64,mockdata\')');
      expect(cssText).toContain('format(\'woff2\')'); // Single quotes as per actual implementation
    });    it('should handle multiple font formats', () => {
      const fontData = {
        'Bravura.woff2': 'data:font/woff2;base64,mockdata1',
        'Bravura.woff': 'data:font/woff;base64,mockdata2',
        'Bravura.otf': 'data:font/opentype;base64,mockdata3'
      };
      const fontFamilies = ['Bravura'];

      FontManager.injectFontFaces(fontData, fontFamilies);

      const styleElement = document.getElementById(FontManager.FONT_STYLE_ELEMENT_ID);
      const cssText = styleElement?.textContent || '';

      expect(cssText).toContain('format(\'woff2\')');
      expect(cssText).toContain('format(\'woff\')');
      expect(cssText).toContain('format(\'opentype\')');
    });    it('should handle multiple font families', () => {
      const fontData = {
        'font1.woff2': 'data:font/woff2;base64,mockdata1',
        'font2.woff2': 'data:font/woff2;base64,mockdata2'
      };
      const fontFamilies = ['Font1', 'Font2'];

      FontManager.injectFontFaces(fontData, fontFamilies);

      const styleElement = document.getElementById(FontManager.FONT_STYLE_ELEMENT_ID);
      const cssText = styleElement?.textContent || '';

      expect(cssText).toContain('font-family: Font1'); // No quotes for simple names
      expect(cssText).toContain('font-family: Font2');
    });

    it('should replace existing font faces', () => {
      const fontData1 = {
        'font1.woff2': 'data:font/woff2;base64,mockdata1'
      };
      const fontData2 = {
        'font2.woff2': 'data:font/woff2;base64,mockdata2'
      };

      FontManager.injectFontFaces(fontData1, ['Font1']);
      FontManager.injectFontFaces(fontData2, ['Font2']);

      const styleElements = document.querySelectorAll(`#${FontManager.FONT_STYLE_ELEMENT_ID}`);
      expect(styleElements.length).toBe(1);
      
      const cssText = styleElements[0].textContent || '';
      expect(cssText).toContain('Font2');
      expect(cssText).not.toContain('Font1');
    });

    it('should return false when no font data provided', () => {
      const result = FontManager.injectFontFaces({}, ['TestFont']);
      expect(result).toBe(false);
    });

    it('should return false when no font families provided', () => {
      const fontData = {
        'font1.woff2': 'data:font/woff2;base64,mockdata1'
      };
      const result = FontManager.injectFontFaces(fontData, []);
      expect(result).toBe(false);
    });
  });

  describe('removeInjectedFontFaces', () => {
    it('should remove injected font style element', () => {
      const fontData = {
        'font1.woff2': 'data:font/woff2;base64,mockdata1'
      };
      FontManager.injectFontFaces(fontData, ['TestFont']);
      
      const styleElement = document.getElementById(FontManager.FONT_STYLE_ELEMENT_ID);
      expect(styleElement).toBeTruthy();
      
      // Spy on the remove method
      const removeSpy = vi.spyOn(styleElement!, 'remove');
      
      FontManager.removeInjectedFontFaces();
      
      // Verify remove was called
      expect(removeSpy).toHaveBeenCalled();
    });

    it('should handle case when no font styles exist', () => {
      expect(() => {
        FontManager.removeInjectedFontFaces();
      }).not.toThrow();
    });
  });

  describe('triggerFontPreload', () => {
    it('should create link elements for font preloading', () => {
      const fontFamilies = ['Bravura', 'Arial'];
      const fontUrl = '/assets/font/Bravura.woff2';

      FontManager.triggerFontPreload(fontFamilies, fontUrl);

      const linkElements = document.querySelectorAll('link[rel="preload"][as="font"]');
      expect(linkElements.length).toBeGreaterThan(0);
    });

    it('should set correct attributes on preload links', () => {
      const fontFamilies = ['Bravura'];
      const fontUrl = '/assets/font/Bravura.woff2';

      FontManager.triggerFontPreload(fontFamilies, fontUrl);

      const linkElement = document.querySelector('link[rel="preload"][as="font"]');
      expect(linkElement).toBeTruthy();
      expect(linkElement?.getAttribute('href')).toBe(fontUrl);
      expect(linkElement?.getAttribute('crossorigin')).toBe('anonymous');
    });

    it('should handle empty font families gracefully', () => {
      expect(() => {
        FontManager.triggerFontPreload([], '/some/font.woff2');
      }).not.toThrow();
    });

    it('should handle missing font URL gracefully', () => {
      expect(() => {
        FontManager.triggerFontPreload(['Bravura'], '');
      }).not.toThrow();
    });
  });

  describe('Font Format Detection', () => {
    it('should detect woff2 format correctly', () => {
      const fontData = {
        'font.woff2': 'data:font/woff2;base64,mockdata'
      };
      
      FontManager.injectFontFaces(fontData, ['TestFont']);
      
      const styleElement = document.getElementById(FontManager.FONT_STYLE_ELEMENT_ID);
      const cssText = styleElement?.textContent || '';
      expect(cssText).toContain('format(\'woff2\')');
    });

    it('should detect woff format correctly', () => {
      const fontData = {
        'font.woff': 'data:font/woff;base64,mockdata'
      };
      
      FontManager.injectFontFaces(fontData, ['TestFont']);
      
      const styleElement = document.getElementById(FontManager.FONT_STYLE_ELEMENT_ID);
      const cssText = styleElement?.textContent || '';
      expect(cssText).toContain('format(\'woff\')');
    });

    it('should detect otf format correctly', () => {
      const fontData = {
        'font.otf': 'data:font/opentype;base64,mockdata'
      };
      
      FontManager.injectFontFaces(fontData, ['TestFont']);
      
      const styleElement = document.getElementById(FontManager.FONT_STYLE_ELEMENT_ID);
      const cssText = styleElement?.textContent || '';
      expect(cssText).toContain('format(\'opentype\')');
    });

    it('should detect ttf format correctly', () => {
      const fontData = {
        'font.ttf': 'data:font/truetype;base64,mockdata'
      };
      
      FontManager.injectFontFaces(fontData, ['TestFont']);
      
      const styleElement = document.getElementById(FontManager.FONT_STYLE_ELEMENT_ID);
      const cssText = styleElement?.textContent || '';
      expect(cssText).toContain('format(\'truetype\')');
    });

    it('should detect eot format correctly', () => {
      const fontData = {
        'font.eot': 'data:application/vnd.ms-fontobject;base64,mockdata'
      };
      
      FontManager.injectFontFaces(fontData, ['TestFont']);
      
      const styleElement = document.getElementById(FontManager.FONT_STYLE_ELEMENT_ID);
      const cssText = styleElement?.textContent || '';
      expect(cssText).toContain('format(\'embedded-opentype\')');
    });

    it('should detect svg format correctly', () => {
      const fontData = {
        'font.svg': 'data:image/svg+xml;base64,mockdata'
      };
      
      FontManager.injectFontFaces(fontData, ['TestFont']);
      
      const styleElement = document.getElementById(FontManager.FONT_STYLE_ELEMENT_ID);
      const cssText = styleElement?.textContent || '';
      expect(cssText).toContain('format(\'svg\')');
    });

    it('should fallback to truetype for unknown extensions', () => {
      const fontData = {
        'font.unknown': 'data:font/unknown;base64,mockdata'
      };
      
      FontManager.injectFontFaces(fontData, ['TestFont']);
      
      const styleElement = document.getElementById(FontManager.FONT_STYLE_ELEMENT_ID);
      const cssText = styleElement?.textContent || '';
      expect(cssText).toContain('format(\'truetype\')');
    });
  });

  describe('CSS Generation', () => {
    it('should escape font family names with spaces', () => {
      const fontData = {
        'font.woff2': 'data:font/woff2;base64,mockdata'
      };
      
      FontManager.injectFontFaces(fontData, ['Font Family With Spaces']);
      
      const styleElement = document.getElementById(FontManager.FONT_STYLE_ELEMENT_ID);
      const cssText = styleElement?.textContent || '';
      expect(cssText).toContain('font-family: "Font Family With Spaces"');
    });

    it('should handle special characters in font names', () => {
      const fontData = {
        'font.woff2': 'data:font/woff2;base64,mockdata'
      };
      
      FontManager.injectFontFaces(fontData, ['Font-Name_123']);
      
      const styleElement = document.getElementById(FontManager.FONT_STYLE_ELEMENT_ID);
      const cssText = styleElement?.textContent || '';
      expect(cssText).toContain('font-family: Font-Name_123'); // No quotes needed for these chars
    });

    it('should generate valid CSS syntax', () => {
      const fontData = {
        'Bravura.woff2': 'data:font/woff2;base64,mockdata'
      };
      
      FontManager.injectFontFaces(fontData, ['Bravura']);
      
      const styleElement = document.getElementById(FontManager.FONT_STYLE_ELEMENT_ID);
      const cssText = styleElement?.textContent || '';
      
      // Basic CSS syntax checks
      expect(cssText).toContain('@font-face {');
      expect(cssText).toContain('}');
      expect(cssText).toContain('font-family:');
      expect(cssText).toContain('src:');
    });
  });
});
