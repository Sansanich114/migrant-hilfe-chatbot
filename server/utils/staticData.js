import fs from 'fs/promises';
import path from 'path';

let propertiesCache = null;
let agencyCache = null;

const isValidEmbedding = (emb) => 
  Array.isArray(emb) && emb.every(v => typeof v === 'number');

export async function loadPropertiesData() {
  if (propertiesCache) return propertiesCache;
  
  try {
    const data = await fs.readFile(
      path.join(process.cwd(), 'scripts/properties/propertiesWithEmbeddings.json'), 
      'utf8'
    );
    
    propertiesCache = JSON.parse(data)
      .filter(p => p?.embedding && isValidEmbedding(p.embedding));
      
    return propertiesCache;
  } catch (err) {
    console.error('Properties load failed:', err);
    return [];
  }
}

export async function loadAgencyData() {
  if (agencyCache) return agencyCache;
  
  try {
    const data = await fs.readFile(
      path.join(process.cwd(), 'scripts/agency/agencyWithEmbedding.json'),
      'utf8'
    );
    
    agencyCache = JSON.parse(data);
    return agencyCache?.embedding ? agencyCache : {};
  } catch (err) {
    console.error('Agency load failed:', err);
    return {};
  }
}
