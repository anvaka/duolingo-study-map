// Maps language names to ISO 3166-1 alpha-2 country codes for flags
// All languages found in duo-data.csv are mapped here
const languageToCountryCode = {
  'Arabic': 'sa',
  'Chinese': 'cn',
  'Danish': 'dk',
  'English': 'gb',
  'Finnish': 'fi',
  'French': 'fr',
  'German': 'de',
  'Guarani': 'py',
  'Hebrew': 'il',
  'Hindi': 'in',
  'Irish': 'ie',
  'Italian': 'it',
  'Japanese': 'jp',
  'Korean': 'kr',
  'Norwegian': 'no',
  'Portuguese': 'pt',
  'Russian': 'ru',
  'Spanish': 'es',
  'Swahili': 'ke',
  'Swedish': 'se',
  'Turkish': 'tr',
};

// Use local flag images (downloaded via download-flags.sh)
export function getFlagUrl(language) {
  const countryCode = languageToCountryCode[language];
  if (!countryCode) {
    console.warn(`No flag mapping for language: ${language}`);
    return null;
  }
  return `./flags/${countryCode}.png`;
}

export function getCountryCode(language) {
  return languageToCountryCode[language] || null;
}
