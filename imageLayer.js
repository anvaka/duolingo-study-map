const cache = new Map();

function getImage(url) {
  const cached = cache.get(url);
  if (cached) return Promise.resolve(cached);

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    
    img.onload = () => {
      const result = { img, width: img.width, height: img.height };
      cache.set(url, result);
      resolve(result);
    };
    img.onerror = reject;
    img.src = url;
  });
}

// Synchronous getter - only works if image is already cached
export function getImageSync(url) {
  return cache.get(url) || null;
}

// Preload multiple images in parallel
export function preloadImages(urls) {
  return Promise.all(urls.map(url => getImage(url)));
}
