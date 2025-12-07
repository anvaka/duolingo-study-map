import { getImageSync, preloadImages } from './imageLayer.js';
import { getFlagUrl } from './languageToFlag.js';

// Map GeoJSON country names to CSV country names
const geoJsonToCsvName = {
  'United States of America': 'USA',
  'United Kingdom': 'Great-Britain',
  'Czech Republic': 'Czechia',
  'Republic of Congo': 'Congo',
  'Democratic Republic of the Congo': 'Democratic-Rep-Congo',
  'Dominican Republic': 'Dominican-Rep',
  'Bosnia and Herzegovina': 'Bosnia-Herzegovina',
  'Ivory Coast': 'Cote-dIvoire',
  'The Bahamas': 'Bahamas',
  'United Republic of Tanzania': 'Tanzania',
  'Republic of Serbia': 'Serbia',
  'Turkey': 'Türkiye',
  'Laos': 'Lao',
  'Swaziland': 'eSwatini',
  'Burkina Faso': 'Burkina-Faso',
  'Guinea Bissau': 'Guinea Bissau',
  'Saudi Arabia': 'Saudi-Arabia',
  'Costa Rica': 'Costa-Rica',
  'El Salvador': 'El-Salvador',
  'South Korea': 'South Korea',
  'North Korea': 'North Korea',
  'South Sudan': 'South Sudan',
  'Sri Lanka': 'Sri Lanka',
  'East Timor': 'East Timor',
  'Papua New Guinea': 'Papua New Guinea',
  'New Zealand': 'New Zealand',
  'Solomon Islands': 'Solomon Islands',
  'Marshall Islands': 'Marshall Islands',
  'Trinidad and Tobago': 'Trinidad and Tobago',
  'Equatorial Guinea': 'Equatorial Guinea',
  'Central African Republic': 'Central African Republic',
  'United Arab Emirates': 'United Arab Emirates',
  'Sierra Leone': 'Sierra Leone',
  'Cabo Verde': 'Cabo-Verde',
  'Greenland': 'Denmark',
};

let duoData = new Map();
let countryLayers = new Map();
let bordersCache = null;
let currentYear = getInitialYear();
let currentRank = getInitialRank();
let renderGeneration = 0;

function getInitialYear() {
  const params = new URLSearchParams(window.location.search);
  const year = parseInt(params.get('year'));
  return (year >= 2020 && year <= 2025) ? year : 2025;
}

function getInitialRank() {
  const params = new URLSearchParams(window.location.search);
  const rank = parseInt(params.get('rank'));
  return (rank === 1 || rank === 2) ? rank : 1;
}

function updateQueryString() {
  const params = new URLSearchParams();
  if (currentYear !== 2025) params.set('year', currentYear);
  if (currentRank !== 1) params.set('rank', currentRank);
  
  const query = params.toString();
  const url = query ? `${window.location.pathname}?${query}` : window.location.pathname;
  window.history.replaceState(null, '', url);
}

const map = new maplibregl.Map({
  container: 'map',
  zoom: 1.5,
  center: [0, 20],
  minZoom: 1,
  maxZoom: 8,
  pitchWithRotate: false,
});
map.dragRotate.disable();
map.touchZoomRotate.disableRotation();

// Load data and initialize
Promise.all([loadDuoData(), loadBorders()]).then(([data, borders]) => {
  duoData = data;
  bordersCache = borders;
  initMap(borders);
  setupControls();
});

function loadDuoData() {
  return fetch('./duo-data.csv')
    .then(res => res.text())
    .then(parseCsv);
}

function parseCsv(text) {
  const lines = text.trim().split('\n');
  const header = lines[0].split(',');
  const data = new Map();

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',');
    const country = values[0];
    const record = {};

    for (let j = 1; j < header.length; j++) {
      const col = header[j];
      const match = col.match(/pop(\d)_(\d{4})/);
      if (match) {
        const rank = parseInt(match[1]);
        const year = parseInt(match[2]);
        if (!record[year]) record[year] = {};
        record[year][rank] = values[j];
      }
    }
    data.set(country, record);
  }
  return data;
}

function loadBorders() {
  return fetch('./ne_110m_admin_0_countries.geojson').then(res => res.json());
}

function initMap(borders) {
  map.addSource('borders', { type: 'geojson', data: borders });

  // Invisible fill for click detection
  map.addLayer({
    id: 'country-fills',
    type: 'fill',
    source: 'borders',
    paint: { 'fill-opacity': 0 },
  });

  // Country borders
  map.addLayer({
    id: 'country-borders',
    type: 'line',
    source: 'borders',
    paint: { 'line-color': '#ffffff', 'line-width': 1 },
  });

  // Start progressive rendering of flags
  renderAllCountriesProgressive(borders);

  // Tooltip on hover
  const tooltip = document.getElementById('tooltip');
  map.on('mousemove', 'country-fills', (e) => {
    if (e.features.length) {
      const countryName = getCountryName(e.features[0]);
      const language = getLanguageForCountry(countryName);
      tooltip.innerHTML = `<strong>${countryName}</strong><br>#${currentRank}: ${language || 'N/A'}`;
      tooltip.style.left = e.point.x + 10 + 'px';
      tooltip.style.top = e.point.y + 10 + 'px';
      tooltip.style.display = 'block';
    }
  });
  map.on('mouseleave', 'country-fills', () => {
    tooltip.style.display = 'none';
  });
}

function getCountryName(feature) {
  return feature.properties.ADMIN || feature.properties.admin || feature.properties.NAME;
}

function getLanguageForCountry(countryName) {
  const csvName = geoJsonToCsvName[countryName] || countryName;
  const record = duoData.get(csvName) || 
                 duoData.get(csvName.replace(/ /g, '-')) ||
                 duoData.get(csvName.replace(/-/g, ' '));
  if (!record || !record[currentYear]) return null;
  return record[currentYear][currentRank];
}

// Progressive rendering: preload images, then swap layers atomically
async function renderAllCountriesProgressive(borders) {
  const generation = ++renderGeneration;
  const oldLayers = new Map(countryLayers);
  const newLayers = new Map();

  // Collect unique flag URLs
  const flagUrls = new Set();
  for (const feature of borders.features) {
    const countryName = getCountryName(feature);
    const language = getLanguageForCountry(countryName);
    if (language) {
      const url = getFlagUrl(language);
      if (url) flagUrls.add(url);
    }
  }
  
  // Preload all images in parallel while old layers remain visible
  await preloadImages([...flagUrls]);

  // Check if a newer render started while we were preloading
  if (generation !== renderGeneration) return;

  // Add all new layers (with generation-prefixed IDs to avoid conflicts)
  for (const feature of borders.features) {
    renderCountry(feature, generation, newLayers);
  }

  // Remove old layers after new ones are added
  for (const [key, canvas] of oldLayers) {
    if (map.getLayer(key)) map.removeLayer(key);
    if (map.getSource(key)) map.removeSource(key);
    if (canvas instanceof HTMLCanvasElement) canvas.remove();
  }

  countryLayers = newLayers;
}

function renderCountry(countryPolygon, generation, newLayers) {
  const countryName = getCountryName(countryPolygon);
  const language = getLanguageForCountry(countryName);
  if (!language) return;

  const flagUrl = getFlagUrl(language);
  if (!flagUrl) return;

  try {
    if (countryPolygon.geometry.type === 'MultiPolygon') {
      countryPolygon.geometry.coordinates.forEach((coords, i) => {
        addFlagLayer(flagUrl, coords, countryName, i, generation, newLayers);
      });
    } else if (countryPolygon.geometry.type === 'Polygon') {
      addFlagLayer(flagUrl, countryPolygon.geometry.coordinates, countryName, 0, generation, newLayers);
    }
  } catch (err) {
    console.warn(`Failed to render ${countryName}:`, err);
  }
}

function addFlagLayer(flagUrl, coordinates, countryName, polyIndex, generation, newLayers) {
  const outerRing = coordinates[0];
  const clipped = clipImageToPolygon(flagUrl, outerRing);
  const layerId = `flag-${generation}-${countryName}-${polyIndex}`;

  // Add canvas to DOM (required for CanvasSource)
  clipped.canvas.id = `canvas-${layerId}`;
  clipped.canvas.style.display = 'none';
  document.body.appendChild(clipped.canvas);
  
  map.addSource(layerId, {
    type: 'canvas',
    canvas: clipped.canvas.id,
    coordinates: clipped.coordinates,
    animate: false,
  });

  map.addLayer({
    id: layerId,
    type: 'raster',
    source: layerId,
    paint: { 'raster-opacity': 0.85 },
  }, 'country-borders');

  newLayers.set(layerId, clipped.canvas);
}

function clipImageToPolygon(url, coordinates) {
  const imgData = getImageSync(url);
  if (!imgData) throw new Error(`Image not preloaded: ${url}`);

  // Calculate bounding box
  let minLon = Infinity, minLat = Infinity, maxLon = -Infinity, maxLat = -Infinity;
  for (const [lon, lat] of coordinates) {
    if (lon < minLon) minLon = lon;
    if (lat < minLat) minLat = lat;
    if (lon > maxLon) maxLon = lon;
    if (lat > maxLat) maxLat = lat;
  }

  const MAX_LAT = 85.0511;
  minLat = Math.max(minLat, -MAX_LAT);
  maxLat = Math.min(maxLat, MAX_LAT);

  const topLeft = mercator(minLon, maxLat);
  const bottomRight = mercator(maxLon, minLat);

  const canvas = document.createElement('canvas');
  const width = canvas.width = imgData.width;
  const height = canvas.height = imgData.height;
  const ctx = canvas.getContext('2d');

  // Clip to polygon shape
  ctx.beginPath();
  let first = true;
  for (const [lon, lat] of coordinates) {
    const proj = mercator(lon, Math.max(-MAX_LAT, Math.min(MAX_LAT, lat)));
    const x = (proj.x - topLeft.x) / (bottomRight.x - topLeft.x) * width;
    const y = (proj.y - topLeft.y) / (bottomRight.y - topLeft.y) * height;
    if (first) {
      ctx.moveTo(x, y);
      first = false;
    } else {
      ctx.lineTo(x, y);
    }
  }
  ctx.closePath();
  ctx.clip();
  ctx.drawImage(imgData.img, 0, 0, width, height);

  return {
    canvas,
    coordinates: [
      [minLon, maxLat],
      [maxLon, maxLat],
      [maxLon, minLat],
      [minLon, minLat],
    ],
  };
}

function mercator(lon, lat) {
  const R = 6378137;
  const DEG = Math.PI / 180;
  const sin = Math.sin(lat * DEG);
  return {
    x: R * lon * DEG,
    y: R * Math.log((1 + sin) / (1 - sin)) / 2,
  };
}

function setupControls() {
  const yearButtons = document.querySelectorAll('.year-btn');
  const rankInputs = document.querySelectorAll('input[name="rank"]');

  yearButtons.forEach(btn => {
    if (parseInt(btn.dataset.year) === currentYear) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
  rankInputs.forEach(input => {
    input.checked = parseInt(input.value) === currentRank;
  });

  yearButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      currentYear = parseInt(btn.dataset.year);
      yearButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      updateQueryString();
      rerender();
    });
  });

  rankInputs.forEach(input => {
    input.addEventListener('change', (e) => {
      currentRank = parseInt(e.target.value);
      updateQueryString();
      rerender();
    });
  });
}

function rerender() {
  if (bordersCache) {
    renderAllCountriesProgressive(bordersCache);
  }
}
