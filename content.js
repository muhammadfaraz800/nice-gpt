// Live Page Minimap Content Script - Enhanced Version
class LiveMinimap {
  constructor() {
    this.minimap = null;
    this.minimapCanvas = null;
    this.minimapCtx = null;
    this.viewport = null;
    this.isEnabled = true;
    this.scale = 0.08; // Smaller scale for better detail
    this.updateInterval = null;
    this.isDragging = false;
    this.dragOffset = { x: 0, y: 0 };
    this.position = this.loadPosition();
    
    this.init();
  }

  init() {
    this.createMinimap();
    this.setupEventListeners();
    this.startLiveUpdates();
    this.observeSearchHighlights();
  }

  loadPosition() {
    // Try to get saved position, default to right side
    const saved = localStorage.getItem('minimap-position');
    if (saved) {
      return JSON.parse(saved);
    }
    return { x: window.innerWidth - 220, y: 20 };
  }

  savePosition() {
    localStorage.setItem('minimap-position', JSON.stringify(this.position));
  }

  createMinimap() {
    // Create minimap container
    this.minimap = document.createElement('div');
    this.minimap.id = 'live-minimap';
    this.minimap.className = 'live-minimap-container';
    
    // Create canvas for rendering
    this.minimapCanvas = document.createElement('canvas');
    this.minimapCanvas.className = 'minimap-canvas';
    this.minimapCtx = this.minimapCanvas.getContext('2d');
    
    // Create viewport indicator
    this.viewport = document.createElement('div');
    this.viewport.className = 'minimap-viewport';
    
    // Create header with drag handle and controls
    const header = document.createElement('div');
    header.className = 'minimap-header';
    
    const dragHandle = document.createElement('div');
    dragHandle.className = 'minimap-drag-handle';
    dragHandle.innerHTML = '⋮⋮';
    
    const toggleBtn = document.createElement('button');
    toggleBtn.className = 'minimap-toggle';
    toggleBtn.innerHTML = '×';
    toggleBtn.onclick = () => this.toggle();
    
    header.appendChild(dragHandle);
    header.appendChild(toggleBtn);
    
    this.minimap.appendChild(header);
    this.minimap.appendChild(this.minimapCanvas);
    this.minimap.appendChild(this.viewport);
    
    document.body.appendChild(this.minimap);
    
    this.updatePosition();
    this.updateCanvasSize();
    this.renderMinimap();
    this.setupDragging();
  }

  updatePosition() {
    this.minimap.style.left = this.position.x + 'px';
    this.minimap.style.top = this.position.y + 'px';
  }

  setupDragging() {
    const header = this.minimap.querySelector('.minimap-header');
    
    header.addEventListener('mousedown', (e) => {
      this.isDragging = true;
      this.dragOffset.x = e.clientX - this.position.x;
      this.dragOffset.y = e.clientY - this.position.y;
      document.body.style.userSelect = 'none';
    });

    document.addEventListener('mousemove', (e) => {
      if (this.isDragging) {
        this.position.x = e.clientX - this.dragOffset.x;
        this.position.y = e.clientY - this.dragOffset.y;
        
        // Keep within bounds
        this.position.x = Math.max(0, Math.min(window.innerWidth - 200, this.position.x));
        this.position.y = Math.max(0, Math.min(window.innerHeight - 300, this.position.y));
        
        this.updatePosition();
      }
    });

    document.addEventListener('mouseup', () => {
      if (this.isDragging) {
        this.isDragging = false;
        document.body.style.userSelect = '';
        this.savePosition();
      }
    });
  }

  updateCanvasSize() {
    const minimapWidth = 180;
    const documentHeight = Math.max(
      document.body.scrollHeight,
      document.body.offsetHeight,
      document.documentElement.clientHeight,
      document.documentElement.scrollHeight,
      document.documentElement.offsetHeight
    );
    
    // Make minimap take up more vertical space like VS Code
    const maxHeight = window.innerHeight - 100;
    const scaledHeight = documentHeight * this.scale;
    
    this.minimapCanvas.width = minimapWidth;
    this.minimapCanvas.height = Math.min(scaledHeight, maxHeight);
    
    this.minimapCanvas.style.width = minimapWidth + 'px';
    this.minimapCanvas.style.height = this.minimapCanvas.height + 'px';
  }

  async renderMinimap() {
    if (!this.minimapCtx) return;
    
    this.minimapCtx.clearRect(0, 0, this.minimapCanvas.width, this.minimapCanvas.height);
    
    try {
      // Create a screenshot-like representation
      await this.renderPageContent();
      
      // Render search highlights on top
      this.renderHighlights();
      
      // Update viewport position
      this.updateViewport();
    } catch (error) {
      console.warn('Minimap render error:', error);
      // Fallback to simple block rendering
      this.renderPageElements();
      this.renderHighlights();
      this.updateViewport();
    }
  }

  async renderPageContent() {
    // Get all visible elements and render them with their actual styles
    const elements = document.querySelectorAll('*');
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    
    // Set background
    this.minimapCtx.fillStyle = window.getComputedStyle(document.body).backgroundColor || '#ffffff';
    this.minimapCtx.fillRect(0, 0, this.minimapCanvas.width, this.minimapCanvas.height);
    
    for (let el of elements) {
      if (el === this.minimap || this.minimap.contains(el)) continue;
      
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      
      const styles = window.getComputedStyle(el);
      if (styles.display === 'none' || styles.visibility === 'hidden') continue;
      
      const x = rect.left * this.scale;
      const y = (rect.top + scrollTop) * this.scale;
      const width = rect.width * this.scale;
      const height = rect.height * this.scale;
      
      // Skip if outside canvas bounds
      if (y > this.minimapCanvas.height || y + height < 0) continue;
      
      // Render background
      const bgColor = styles.backgroundColor;
      if (bgColor && bgColor !== 'rgba(0, 0, 0, 0)' && bgColor !== 'transparent') {
        this.minimapCtx.fillStyle = bgColor;
        this.minimapCtx.fillRect(x, y, width, height);
      }
      
      // Render borders
      const borderColor = styles.borderColor;
      const borderWidth = parseFloat(styles.borderWidth) || 0;
      if (borderWidth > 0 && borderColor && borderColor !== 'rgba(0, 0, 0, 0)') {
        this.minimapCtx.strokeStyle = borderColor;
        this.minimapCtx.lineWidth = Math.max(borderWidth * this.scale, 0.5);
        this.minimapCtx.strokeRect(x, y, width, height);
      }
      
      // Render text content as blocks
      if (el.textContent && el.textContent.trim()) {
        const textColor = styles.color;
        if (textColor && textColor !== 'rgba(0, 0, 0, 0)') {
          // Create text representation as colored blocks
          this.renderTextContent(el, x, y, width, height, textColor, styles);
        }
      }
      
      // Special handling for images
      if (el.tagName === 'IMG') {
        this.minimapCtx.fillStyle = '#e0e0e0';
        this.minimapCtx.fillRect(x, y, width, height);
        this.minimapCtx.strokeStyle = '#ccc';
        this.minimapCtx.lineWidth = 1;
        this.minimapCtx.strokeRect(x, y, width, height);
      }
    }
  }

  renderTextContent(element, x, y, width, height, textColor, styles) {
    const fontSize = parseFloat(styles.fontSize) || 16;
    const scaledFontSize = fontSize * this.scale;
    
    // Only render text blocks for readable sizes
    if (scaledFontSize < 1) return;
    
    // Create text-like patterns
    const lineHeight = scaledFontSize * 1.2;
    const lines = Math.floor(height / lineHeight);
    
    this.minimapCtx.fillStyle = textColor;
    
    for (let i = 0; i < Math.min(lines, 10); i++) {
      const lineY = y + (i * lineHeight);
      const lineWidth = width * (0.7 + Math.random() * 0.3); // Vary line width
      
      if (scaledFontSize >= 2) {
        // Render as small rectangles for larger text
        this.minimapCtx.fillRect(x + 2, lineY, lineWidth - 4, Math.max(scaledFontSize * 0.8, 1));
      } else {
        // Render as lines for smaller text
        this.minimapCtx.fillRect(x + 1, lineY, lineWidth - 2, 1);
      }
    }
  }

  renderPageElements() {
    // Fallback method - simplified rendering
    const elements = document.querySelectorAll('h1, h2, h3, h4, h5, h6, p, div, article, section, aside, nav, header, footer, main, pre, code, blockquote, ul, ol, li');
    
    elements.forEach(el => {
      if (el === this.minimap || this.minimap.contains(el)) return;
      
      const rect = el.getBoundingClientRect();
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      
      const x = rect.left * this.scale;
      const y = (rect.top + scrollTop) * this.scale;
      const width = Math.max(rect.width * this.scale, 2);
      const height = Math.max(rect.height * this.scale, 1);
      
      // Different colors for different element types
      let color = '#e8e8e8';
      if (el.tagName.match(/^H[1-6]$/)) color = '#4a90e2';
      else if (el.tagName === 'P') color = '#d5d5d5';
      else if (el.tagName === 'PRE' || el.tagName === 'CODE') color = '#2d3748';
      else if (el.tagName === 'BLOCKQUOTE') color = '#6c757d';
      
      this.minimapCtx.fillStyle = color;
      this.minimapCtx.fillRect(x, y, width, height);
      
      // Add subtle borders
      this.minimapCtx.strokeStyle = '#ccc';
      this.minimapCtx.lineWidth = 0.5;
      this.minimapCtx.strokeRect(x, y, width, height);
    });
  }

  renderHighlights() {
    // Enhanced highlight detection
    const highlightSelectors = [
      'mark',
      '.highlight',
      '[style*="background-color: yellow"]',
      '[style*="background: yellow"]',
      '[style*="background-color:#ffff00"]',
      '[style*="background:#ffff00"]',
      '.search-highlight',
      '::selection'
    ];
    
    const highlighted = document.querySelectorAll(highlightSelectors.join(', '));
    
    highlighted.forEach(el => {
      if (el === this.minimap || this.minimap.contains(el)) return;
      
      const rect = el.getBoundingClientRect();
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      
      const x = rect.left * this.scale;
      const y = (rect.top + scrollTop) * this.scale;
      const width = Math.max(rect.width * this.scale, 3);
      const height = Math.max(rect.height * this.scale, 2);
      
      // Bright yellow for search highlights
      this.minimapCtx.fillStyle = '#ffff00';
      this.minimapCtx.fillRect(x, y, width, height);
      
      // Add border for better visibility
      this.minimapCtx.strokeStyle = '#ff8800';
      this.minimapCtx.lineWidth = 1;
      this.minimapCtx.strokeRect(x, y, width, height);
    });
    
    // Also check for browser's native search highlights
    this.detectNativeSearchHighlights();
  }

  detectNativeSearchHighlights() {
    // Try to detect browser's native search highlights
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_ELEMENT,
      {
        acceptNode: (node) => {
          const style = window.getComputedStyle(node);
          return (style.backgroundColor === 'rgb(255, 255, 0)' || 
                  style.backgroundColor === 'yellow' ||
                  node.matches && node.matches('[style*="background"]')) 
                 ? NodeFilter.FILTER_ACCEPT 
                 : NodeFilter.FILTER_SKIP;
        }
      }
    );
    
    let node;
    while (node = walker.nextNode()) {
      if (node === this.minimap || this.minimap.contains(node)) continue;
      
      const rect = node.getBoundingClientRect();
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      
      const x = rect.left * this.scale;
      const y = (rect.top + scrollTop) * this.scale;
      const width = Math.max(rect.width * this.scale, 3);
      const height = Math.max(rect.height * this.scale, 2);
      
      this.minimapCtx.fillStyle = '#ffff00';
      this.minimapCtx.fillRect(x, y, width, height);
    }
  }

  updateViewport() {
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const windowHeight = window.innerHeight;
    const documentHeight = Math.max(
      document.body.scrollHeight,
      document.documentElement.scrollHeight
    );
    
    const viewportTop = (scrollTop / documentHeight) * this.minimapCanvas.height;
    const viewportHeight = (windowHeight / documentHeight) * this.minimapCanvas.height;
    
    this.viewport.style.top = viewportTop + 'px';
    this.viewport.style.height = Math.max(viewportHeight, 8) + 'px';
  }

  setupEventListeners() {
    // Scroll event for live updates
    let scrollTimeout;
    window.addEventListener('scroll', () => {
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        this.updateViewport();
      }, 16); // ~60fps for smooth viewport updates
    });

    // Click on minimap to navigate
    this.minimapCanvas.addEventListener('click', (e) => {
      const rect = this.minimapCanvas.getBoundingClientRect();
      const clickY = e.clientY - rect.top;
      const scrollPercentage = clickY / this.minimapCanvas.height;
      
      const documentHeight = Math.max(
        document.body.scrollHeight,
        document.documentElement.scrollHeight
      );
      
      const targetScroll = scrollPercentage * documentHeight;
      window.scrollTo({
        top: targetScroll,
        behavior: 'smooth'
      });
    });

    // Resize observer for responsive updates
    if (window.ResizeObserver) {
      const resizeObserver = new ResizeObserver(() => {
        this.updateCanvasSize();
        this.renderMinimap();
      });
      resizeObserver.observe(document.body);
      resizeObserver.observe(document.documentElement);
    }

    // Window resize
    window.addEventListener('resize', () => {
      // Keep minimap within bounds
      this.position.x = Math.max(0, Math.min(window.innerWidth - 200, this.position.x));
      this.position.y = Math.max(0, Math.min(window.innerHeight - 300, this.position.y));
      this.updatePosition();
      this.updateCanvasSize();
      this.renderMinimap();
    });

    // Mutation observer for dynamic content
    const observer = new MutationObserver(() => {
      clearTimeout(this.mutationTimeout);
      this.mutationTimeout = setTimeout(() => {
        this.renderMinimap();
      }, 200);
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style', 'class']
    });
  }

  observeSearchHighlights() {
    // Enhanced search highlight observation
    const highlightObserver = new MutationObserver((mutations) => {
      let hasHighlightChanges = false;
      
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              if (this.isHighlightElement(node)) {
                hasHighlightChanges = true;
              }
            }
          });
        }
        
        if (mutation.type === 'attributes' && 
            (mutation.attributeName === 'style' || mutation.attributeName === 'class')) {
          if (this.isHighlightElement(mutation.target)) {
            hasHighlightChanges = true;
          }
        }
      });
      
      if (hasHighlightChanges) {
        setTimeout(() => this.renderMinimap(), 100);
      }
    });

    highlightObserver.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style', 'class']
    });
  }

  isHighlightElement(element) {
    if (!element || !element.style) return false;
    
    const style = window.getComputedStyle(element);
    return element.tagName === 'MARK' || 
           element.classList?.contains('highlight') ||
           style.backgroundColor === 'yellow' ||
           style.backgroundColor === 'rgb(255, 255, 0)' ||
           element.style.backgroundColor === 'yellow';
  }

  startLiveUpdates() {
    // Less frequent full updates to avoid performance issues
    this.updateInterval = setInterval(() => {
      if (this.isEnabled) {
        this.renderMinimap();
      }
    }, 2000); // Update every 2 seconds
  }

  toggle() {
    this.isEnabled = !this.isEnabled;
    this.minimap.style.display = this.isEnabled ? 'block' : 'none';
    
    if (this.isEnabled) {
      this.renderMinimap();
    }
  }

  destroy() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }
    if (this.minimap && this.minimap.parentNode) {
      this.minimap.parentNode.removeChild(this.minimap);
    }
  }
}

// Initialize minimap when page loads
let liveMinimap = null;

function initMinimap() {
  if (!liveMinimap) {
    liveMinimap = new LiveMinimap();
    // Make it globally accessible for popup controls
    window.liveMinimap = liveMinimap;
  }
}

// Wait for page to be ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initMinimap);
} else {
  initMinimap();
}

// Clean up on page unload
window.addEventListener('beforeunload', () => {
  if (liveMinimap) {
    liveMinimap.destroy();
  }
});