// Recording Web Worker - handles canvas compositing at full FPS even when tab is hidden

const CANVAS_WIDTH = 1280;
const CANVAS_HEIGHT = 720;
const MARGIN = 16;
const INNER_WIDTH = CANVAS_WIDTH - MARGIN * 2;
const INNER_HEIGHT = CANVAS_HEIGHT - MARGIN * 2;
const FPS = 30;
const FRAME_INTERVAL = Math.floor(1000 / FPS);

let offscreenCanvas = null;
let offscreenCtx = null;
let drawIntervalId = null;
let lastVideos = [];
let layoutMode = 'presenter'; // 'presenter' or 'grid'
let featuredId = null;

function initCanvas() {
  if (!offscreenCanvas) {
    offscreenCanvas = new OffscreenCanvas(CANVAS_WIDTH, CANVAS_HEIGHT);
    offscreenCtx = offscreenCanvas.getContext('2d');
  }
  return offscreenCanvas;
}

function drawFrame(videos) {
  if (!offscreenCtx) return;

  const activeVideos = videos.filter(v => v && v.bitmap);

  offscreenCtx.fillStyle = '#111827';
  offscreenCtx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  if (activeVideos.length === 0) return;

  // Draw with margin
  offscreenCtx.save();
  offscreenCtx.translate(MARGIN, MARGIN);

  if (layoutMode === 'grid') {
    drawGridLayout(activeVideos);
  } else {
    drawPresenterLayout(activeVideos);
  }

  offscreenCtx.restore();
}

function drawGridLayout(videos) {
  const count = videos.length;
  
  // Calculate grid layout to match live view
  let cols = 1;
  let rows = 1;
  if (count <= 1) { cols = 1; rows = 1; }
  else if (count <= 2) { cols = 2; rows = 1; }
  else if (count <= 4) { cols = 2; rows = 2; }
  else if (count <= 6) { cols = 3; rows = 2; }
  else if (count <= 9) { cols = 3; rows = 3; }
  else if (count <= 12) { cols = 4; rows = 3; }
  else if (count <= 16) { cols = 4; rows = 4; }
  else { cols = 4; rows = 4; }
  
  const cellW = INNER_WIDTH / cols;
  const cellH = INNER_HEIGHT / rows;

  videos.forEach((v, i) => {
    if (!v || !v.bitmap) return;
    const bitmap = v.bitmap;
    const c = i % cols;
    const r = Math.floor(i / cols);
    const aspect = bitmap.width / bitmap.height;
    let dw = cellW;
    let dh = cellH;
    if (aspect > cellW / cellH) {
      dh = cellW / aspect;
    } else {
      dw = cellH * aspect;
    }
    const dx = Math.floor(c * cellW + (cellW - dw) / 2);
    const dy = Math.floor(r * cellH + (cellH - dh) / 2);
    const dwFloor = Math.ceil(dw);
    const dhCeil = Math.ceil(dh);
    offscreenCtx.drawImage(bitmap, dx, dy, dwFloor, dhCeil);
  });
}

function drawPresenterLayout(videos) {
  // Screen shares first
  const screenShares = videos.filter(v => v.isScreen);
  const cameras = videos.filter(v => !v.isScreen);
  
  let presenter = null;
  let presenterCamera = null;
  
  if (featuredId) {
    presenter = videos.find(v => v.id === featuredId);
  }
  
  if (!presenter) {
    // Screen share has priority
    if (screenShares.length > 0) {
      presenter = screenShares[0];
    } else if (cameras.length > 0) {
      // Then most recently speaking
      const speakers = cameras.filter(v => v.speaking && v.id !== 'local');
      presenter = speakers[0] || cameras.find(v => v.id === 'local') || cameras[0];
    }
  }
  
  if (!presenter && videos.length > 0) {
    presenter = videos[0];
  }
  
  if (!presenter) return;
  
  const isScreen = presenter.isScreen;
  
  // Get presenter camera if screen sharing
  if (isScreen) {
    const peerId = presenter.id.replace('-screen', '');
    if (presenter.id === 'local-screen') {
      presenterCamera = videos.find(v => v.id === 'local');
    } else {
      presenterCamera = videos.find(v => v.id === peerId);
    }
  }
  
  // Get remaining videos (excluding presenter and their camera)
  const remaining = videos.filter(v => {
    if (v.id === presenter.id) return false;
    if (presenterCamera && v.id === presenterCamera.id) return false;
    return true;
  });
  
  // Build thumbnails list - only presenter camera if screen sharing
  const allThumbs = presenterCamera 
    ? [presenterCamera, ...remaining] 
    : remaining;
  
  const hasThumbnails = allThumbs.length > 0;
  
  // Main presenter area - takes 85% width on left, or full width if no thumbnails
  const mainWidth = hasThumbnails ? INNER_WIDTH * 0.85 : INNER_WIDTH;
  const mainHeight = INNER_HEIGHT;
  
  // Draw main presenter
  drawVideoInRect(presenter.bitmap, 0, 0, Math.floor(mainWidth), Math.floor(mainHeight), isScreen);
  
  // Early return if no thumbnails
  if (!hasThumbnails) return;
  
  // Determine thumbnail grid: 1 col if <= 4, 2 cols if > 4
  const thumbCols = allThumbs.length <= 4 ? 1 : 2;
  const thumbWidth = INNER_WIDTH * 0.15;
  const thumbX = mainWidth;
  const thumbRows = Math.ceil(allThumbs.length / thumbCols);
  const thumbH = Math.floor(mainHeight / thumbRows);
  const thumbW = Math.floor(thumbWidth / thumbCols);
  
  // Draw thumbnails
  allThumbs.forEach((v, i) => {
    if (!v || !v.bitmap) return;
    const col = i % thumbCols;
    const row = Math.floor(i / thumbCols);
    const dx = Math.floor(thumbX + col * thumbW);
    const dy = Math.floor(row * thumbH);
    drawVideoInRect(v.bitmap, dx, dy, thumbW, thumbH, false);
  });
}

function drawVideoInRect(bitmap, x, y, w, h, contain = false) {
  if (!bitmap) return;
  
  const aspect = bitmap.width / bitmap.height;
  const rectAspect = w / h;
  
  let dw = w;
  let dh = h;
  
  if (contain) {
    // Letterboxing - show entire image
    if (aspect > rectAspect) {
      dh = w / aspect;
    } else {
      dw = h * aspect;
    }
  } else {
    // Cover - fill entire area
    if (aspect > rectAspect) {
      dw = h * aspect;
    } else {
      dh = w / aspect;
    }
  }
  
  const dx = x + (w - dw) / 2;
  const dy = y + (h - dh) / 2;
  
  offscreenCtx.drawImage(bitmap, dx, dy, dw, dh);
}

function compositeAndSend(videos) {
  if (!offscreenCanvas || !offscreenCtx) return;
  drawFrame(videos);
  lastVideos = videos;
  try {
    const bitmap = offscreenCanvas.transferToImageBitmap();
    self.postMessage({ type: 'frame', bitmap }, [bitmap]);
  } catch (err) {
    // Canvas not ready yet, skip frame
  }
}

self.onmessage = function(e) {
  const { type, videos, layout, featured } = e.data;

  switch (type) {
    case 'init':
      initCanvas();
      self.postMessage({ type: 'ready' });
      break;

    case 'start':
      if (drawIntervalId) clearInterval(drawIntervalId);
      drawIntervalId = setInterval(() => {
        compositeAndSend(lastVideos);
      }, FRAME_INTERVAL);
      break;

    case 'tick':
      lastVideos = videos || [];
      if (layout !== undefined) layoutMode = layout;
      if (featured !== undefined) featuredId = featured;
      compositeAndSend(lastVideos);
      break;

    case 'stop':
      if (drawIntervalId) {
        clearInterval(drawIntervalId);
        drawIntervalId = null;
      }
      lastVideos = [];
      layoutMode = 'presenter';
      featuredId = null;
      break;
  }
};
