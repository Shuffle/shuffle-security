import { useState, useEffect, useCallback } from 'react';
import { useDatastore } from './useDatastore';
import { DATASTORE_CATEGORIES } from '@/services/datastore';

export interface TemplateTask {
  title: string;
  description?: string;
  category?: string;
  assignee?: string;
  dependsOn?: string;
  dueOffsetHours?: number; // Hours from incident creation
}

export interface CaseTemplate {
  id: string;
  name: string;
  description?: string;
  severity?: string;
  tasks: TemplateTask[];
  usageCount?: number;
  createdAt?: number;
  createdBy?: string;
}

// Default case templates
export const DEFAULT_CASE_TEMPLATES: CaseTemplate[] = [
  {
    id: 'standard-triage',
    name: 'Standard Triage',
    description: 'Basic incident triage workflow',
    severity: 'medium',
    tasks: [
      { title: 'Initial assessment', category: 'triage' },
      { title: 'Collect evidence', category: 'investigation', dependsOn: 'Initial assessment' },
      { title: 'Determine scope', category: 'investigation', dependsOn: 'Collect evidence' },
      { title: 'Document findings', category: 'documentation' },
    ],
  },
  {
    id: 'malware-investigation',
    name: 'Malware Investigation',
    description: 'Comprehensive malware analysis workflow',
    severity: 'high',
    tasks: [
      { title: 'Isolate affected systems', category: 'containment' },
      { title: 'Capture memory dump', category: 'investigation', dependsOn: 'Isolate affected systems' },
      { title: 'Analyze malware sample', category: 'investigation' },
      { title: 'Identify IOCs', category: 'investigation', dependsOn: 'Analyze malware sample' },
      { title: 'Check lateral movement', category: 'investigation', dependsOn: 'Identify IOCs' },
      { title: 'Remediation plan', category: 'recovery' },
    ],
  },
  {
    id: 'phishing-response',
    name: 'Phishing Response',
    description: 'Response procedure for phishing incidents',
    severity: 'medium',
    tasks: [
      { title: 'Identify recipients', category: 'triage' },
      { title: 'Block sender domain', category: 'containment' },
      { title: 'Check for clicks/downloads', category: 'investigation', dependsOn: 'Identify recipients' },
      { title: 'Reset compromised credentials', category: 'containment', dependsOn: 'Check for clicks/downloads' },
      { title: 'User awareness notification', category: 'communication' },
    ],
  },
  {
    id: 'ransomware-response',
    name: 'Ransomware Response',
    description: 'Critical ransomware incident response',
    severity: 'critical',
    tasks: [
      { title: 'Isolate infected systems from network', category: 'containment' },
      { title: 'Preserve evidence and logs', category: 'investigation' },
      { title: 'Identify ransomware variant', category: 'investigation', dependsOn: 'Preserve evidence and logs' },
      { title: 'Determine attack vector', category: 'investigation' },
      { title: 'Check for data exfiltration', category: 'investigation' },
      { title: 'Notify legal/compliance team', category: 'communication' },
      { title: 'Assess backup availability', category: 'recovery' },
      { title: 'Develop recovery plan', category: 'recovery', dependsOn: 'Assess backup availability' },
      { title: 'Restore systems from backup', category: 'recovery', dependsOn: 'Develop recovery plan' },
      { title: 'Post-incident review', category: 'documentation' },
    ],
  },
  {
    id: 'data-breach-response',
    name: 'Data Breach Response',
    description: 'Response procedure for potential data breaches',
    severity: 'critical',
    tasks: [
      { title: 'Confirm breach and scope', category: 'triage' },
      { title: 'Contain the breach', category: 'containment', dependsOn: 'Confirm breach and scope' },
      { title: 'Identify affected data', category: 'investigation' },
      { title: 'Determine legal notification requirements', category: 'communication' },
      { title: 'Notify affected parties', category: 'communication', dependsOn: 'Determine legal notification requirements' },
      { title: 'Remediate vulnerabilities', category: 'recovery' },
      { title: 'Document incident timeline', category: 'documentation' },
    ],
  },
  {
    id: 'unauthorized-access',
    name: 'Unauthorized Access',
    description: 'Investigation for unauthorized access attempts',
    severity: 'high',
    tasks: [
      { title: 'Review access logs', category: 'investigation' },
      { title: 'Identify compromised accounts', category: 'investigation' },
      { title: 'Revoke compromised credentials', category: 'containment', dependsOn: 'Identify compromised accounts' },
      { title: 'Check for persistence mechanisms', category: 'investigation' },
      { title: 'Review privilege escalation', category: 'investigation' },
      { title: 'Implement additional controls', category: 'recovery' },
    ],
  },
];

const CATEGORY = DATASTORE_CATEGORIES.TEMPLATES || 'shuffle-case_templates';

export const useCaseTemplates = () => {
  const { items, isLoading, fetchItems, addItem, removeItem } = useDatastore({ 
    category: CATEGORY 
  });
  const [templates, setTemplates] = useState<CaseTemplate[]>([]);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  // Parse templates from datastore
  useEffect(() => {
    if (isLoading) return;
    
    if (items.length > 0) {
      const parsed: CaseTemplate[] = items.map(item => {
        try {
          return JSON.parse(item.value) as CaseTemplate;
        } catch {
          return null;
        }
      }).filter(Boolean) as CaseTemplate[];
      setTemplates(parsed);
      setInitialized(true);
    } else if (!initialized) {
      // If no items and not yet initialized, use defaults
      setTemplates(DEFAULT_CASE_TEMPLATES);
      setInitialized(true);
    }
  }, [items, isLoading, initialized]);

  // Get template by ID
  const getTemplate = useCallback((id: string): CaseTemplate | undefined => {
    return templates.find(t => t.id === id);
  }, [templates]);

  // Add a new template
  const createTemplate = useCallback(async (template: Omit<CaseTemplate, 'id' | 'createdAt'>) => {
    const newTemplate: CaseTemplate = {
      ...template,
      id: `template-${Date.now()}`,
      createdAt: Date.now(),
    };
    await addItem(newTemplate.id, newTemplate);
    await fetchItems();
    return newTemplate;
  }, [addItem, fetchItems]);

  // Update an existing template
  const updateTemplate = useCallback(async (id: string, updates: Partial<CaseTemplate>) => {
    const existing = templates.find(t => t.id === id);
    if (!existing) return;
    const updated = { ...existing, ...updates };
    await addItem(id, updated);
    await fetchItems();
  }, [templates, addItem, fetchItems]);

  // Delete a template
  const deleteTemplate = useCallback(async (id: string) => {
    await removeItem(id);
    await fetchItems();
  }, [removeItem, fetchItems]);

  // Initialize defaults in datastore
  const initializeDefaults = useCallback(async () => {
    for (const template of DEFAULT_CASE_TEMPLATES) {
      await addItem(template.id, template);
    }
    await fetchItems();
  }, [addItem, fetchItems]);

  // Track template usage
  const trackUsage = useCallback(async (id: string) => {
    const template = templates.find(t => t.id === id);
    if (template) {
      await addItem(id, { 
        ...template, 
        usageCount: (template.usageCount || 0) + 1 
      });
    }
  }, [templates, addItem]);

  return {
    templates,
    isLoading,
    getTemplate,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    initializeDefaults,
    trackUsage,
  };
};

export default useCaseTemplates;
