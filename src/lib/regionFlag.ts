// Region flag mapping based on region_url
export const getRegionFlag = (regionUrl?: string): { flag: string; code: string } => {
  if (!regionUrl) return { flag: '🇬🇧', code: 'UK' };
  
  const url = regionUrl.toLowerCase();
  
  if (url.includes('california') || url.includes('us.') || url.includes('us-')) {
    return { flag: '🇺🇸', code: 'US' };
  }
  if (url.includes('frankfurt') || url.includes('de.') || url.includes('de-')) {
    return { flag: '🇩🇪', code: 'DE' };
  }
  if (url.includes('eu-2') || url.includes('eu2')) {
    return { flag: '🇪🇺', code: 'EU-2' };
  }
  if (url.includes('eu.') || url.includes('eu-')) {
    return { flag: '🇪🇺', code: 'EU' };
  }
  if (url.includes('ca.') || url.includes('canada')) {
    return { flag: '🇨🇦', code: 'CA' };
  }
  if (url.includes('au.') || url.includes('aus') || url.includes('australia')) {
    return { flag: '🇦🇺', code: 'AUS' };
  }
  if (url.includes('uk.') || url.includes('uk-') || url.includes('london')) {
    return { flag: '🇬🇧', code: 'UK' };
  }
  // Default to UK for base shuffler.io or any unrecognized region
  return { flag: '🇬🇧', code: 'UK' };
};
