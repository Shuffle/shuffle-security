/**
 * Hook for fetching and caching MITRE ATT&CK data from official sources
 */

import { useState, useEffect, useCallback } from 'react';
import { useDatastore } from './useDatastore';

const MITRE_CTI_URL = 'https://raw.githubusercontent.com/mitre/cti/master/enterprise-attack/enterprise-attack.json';
const DATASTORE_CATEGORY = 'mitre-attack';
const CACHE_KEY = 'enterprise-attack-v1';

export interface MitreTactic {
  id: string;
  name: string;
  description: string;
  shortName: string;
  externalId: string;
}

export interface MitreTechnique {
  id: string;
  name: string;
  description: string;
  externalId: string;
  tacticRefs: string[];
  isSubtechnique: boolean;
  parentId?: string;
  platforms: string[];
  url: string;
}

interface MitreData {
  tactics: MitreTactic[];
  techniques: MitreTechnique[];
  lastUpdated: number;
}

interface StixObject {
  type: string;
  id: string;
  name?: string;
  description?: string;
  external_references?: Array<{
    source_name: string;
    external_id?: string;
    url?: string;
  }>;
  kill_chain_phases?: Array<{
    kill_chain_name: string;
    phase_name: string;
  }>;
  x_mitre_shortname?: string;
  x_mitre_is_subtechnique?: boolean;
  x_mitre_platforms?: string[];
  revoked?: boolean;
  x_mitre_deprecated?: boolean;
}

interface StixBundle {
  objects: StixObject[];
}

export const useMitreAttack = () => {
  const [tactics, setTactics] = useState<MitreTactic[]>([]);
  const [techniques, setTechniques] = useState<MitreTechnique[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);

  const { getItem, addItem } = useDatastore({ category: DATASTORE_CATEGORY });

  const parseStixBundle = (bundle: StixBundle): MitreData => {
    const tacticsMap = new Map<string, MitreTactic>();
    const techniquesArr: MitreTechnique[] = [];

    // First pass: extract tactics
    for (const obj of bundle.objects) {
      if (obj.type === 'x-mitre-tactic' && !obj.revoked && !obj.x_mitre_deprecated) {
        const externalRef = obj.external_references?.find(
          (ref) => ref.source_name === 'mitre-attack'
        );
        if (externalRef?.external_id) {
          tacticsMap.set(obj.x_mitre_shortname || '', {
            id: obj.id,
            name: obj.name || '',
            description: obj.description || '',
            shortName: obj.x_mitre_shortname || '',
            externalId: externalRef.external_id,
          });
        }
      }
    }

    // Second pass: extract techniques
    for (const obj of bundle.objects) {
      if (obj.type === 'attack-pattern' && !obj.revoked && !obj.x_mitre_deprecated) {
        const externalRef = obj.external_references?.find(
          (ref) => ref.source_name === 'mitre-attack'
        );
        if (externalRef?.external_id) {
          const tacticRefs = obj.kill_chain_phases
            ?.filter((phase) => phase.kill_chain_name === 'mitre-attack')
            .map((phase) => phase.phase_name) || [];

          // Check if it's a sub-technique (ID contains a dot like T1234.001)
          const isSubtechnique = obj.x_mitre_is_subtechnique || externalRef.external_id.includes('.');
          const parentId = isSubtechnique
            ? externalRef.external_id.split('.')[0]
            : undefined;

          techniquesArr.push({
            id: obj.id,
            name: obj.name || '',
            description: obj.description || '',
            externalId: externalRef.external_id,
            tacticRefs,
            isSubtechnique,
            parentId,
            platforms: obj.x_mitre_platforms || [],
            url: externalRef.url || `https://attack.mitre.org/techniques/${externalRef.external_id.replace('.', '/')}/`,
          });
        }
      }
    }

    // Sort tactics by their external ID
    const sortedTactics = Array.from(tacticsMap.values()).sort((a, b) => {
      const aNum = parseInt(a.externalId.replace('TA', ''));
      const bNum = parseInt(b.externalId.replace('TA', ''));
      return aNum - bNum;
    });

    // Sort techniques by external ID
    techniquesArr.sort((a, b) => a.externalId.localeCompare(b.externalId));

    return {
      tactics: sortedTactics,
      techniques: techniquesArr,
      lastUpdated: Date.now(),
    };
  };

  const fetchFromSource = useCallback(async (): Promise<MitreData> => {
    const response = await fetch(MITRE_CTI_URL);
    if (!response.ok) {
      throw new Error(`Failed to fetch MITRE data: ${response.statusText}`);
    }
    const bundle: StixBundle = await response.json();
    return parseStixBundle(bundle);
  }, []);

  const syncFromSource = useCallback(async () => {
    setIsSyncing(true);
    setError(null);
    try {
      const data = await fetchFromSource();
      
      // Cache in datastore
      await addItem(CACHE_KEY, data);
      
      setTactics(data.tactics);
      setTechniques(data.techniques);
      setLastUpdated(data.lastUpdated);
      
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to sync MITRE data';
      setError(message);
      return false;
    } finally {
      setIsSyncing(false);
    }
  }, [fetchFromSource, addItem]);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Try to load from cache first
      const cached = await getItem(CACHE_KEY);
      if (cached?.value) {
        const data = typeof cached.value === 'string' ? JSON.parse(cached.value) : cached.value;
        if (data.tactics && data.techniques) {
          setTactics(data.tactics);
          setTechniques(data.techniques);
          setLastUpdated(data.lastUpdated || null);
          setIsLoading(false);
          return;
        }
      }

      // No cache, fetch from source
      await syncFromSource();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load MITRE data';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [getItem, syncFromSource]);

  // Get techniques for a specific tactic
  const getTechniquesByTactic = useCallback(
    (tacticShortName: string): MitreTechnique[] => {
      return techniques.filter(
        (t) => !t.isSubtechnique && t.tacticRefs.includes(tacticShortName)
      );
    },
    [techniques]
  );

  // Get sub-techniques for a parent technique
  const getSubTechniques = useCallback(
    (parentExternalId: string): MitreTechnique[] => {
      return techniques.filter((t) => t.parentId === parentExternalId);
    },
    [techniques]
  );

  useEffect(() => {
    loadData();
  }, [loadData]);

  return {
    tactics,
    techniques,
    isLoading,
    isSyncing,
    error,
    lastUpdated,
    syncFromSource,
    getTechniquesByTactic,
    getSubTechniques,
  };
};
