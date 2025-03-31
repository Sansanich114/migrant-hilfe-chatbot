export function loadPropertiesData() {
  if (!propertiesCache) {
    const dataPath = path.resolve('scripts/properties/propertiesWithEmbeddings.json'); // Correct already
    try {
      propertiesCache = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    } catch (err) {
      console.error('Error reading properties data:', err);
      propertiesCache = [];
    }
  }
  return propertiesCache;
}

export function loadAgencyData() {
  if (!agencyCache) {
    const dataPath = path.resolve('scripts/agency/agencyWithEmbeddings.json'); // FIXED here
    try {
      agencyCache = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    } catch (err) {
      console.error('Error reading agency data:', err);
      agencyCache = {};
    }
  }
  return agencyCache;
}
