const cache = new Map();

export default function getImage(url) {
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
