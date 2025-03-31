import fs from 'fs';
import path from 'path';

let propertiesCache = null;
let agencyCache = null;

export function loadPropertiesData() {
  if (!propertiesCache) {
    const dataPath = path.resolve('scripts/properties/propertiesWithEmbeddings.json');
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
    const dataPath = path.resolve('scripts/agency/agencyWithEmbedding.json');
    try {
      agencyCache = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    } catch (err) {
      console.error('Error reading agency data:', err);
      agencyCache = {};
    }
  }
  return agencyCache;
}
