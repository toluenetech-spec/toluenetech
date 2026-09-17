import React from 'react';
import * as LucideIcons from 'lucide-react';

/**
 * Resolve a Lucide icon by its string name. Used so that
 * admin-stored service/solution entries can reference icons by name
 * rather than importing a React component.
 */
export function resolveIcon(name?: string | React.ElementType): React.ElementType {
  if (typeof name !== 'string') return (name as React.ElementType) || LucideIcons.HelpCircle;
  const pascal = name
    .split('-')
    .map(p => p.charAt(0).toUpperCase() + p.slice(1))
    .join('');
  const icon = (LucideIcons as any)[pascal] || (LucideIcons as any)[name];
  return icon || LucideIcons.HelpCircle;
}

export const ICON_PICKER_OPTIONS = [
  'Globe', 'Code', 'Layout', 'PenTool', 'Smartphone', 'Layers', 'Video',
  'BrainCircuit', 'Bot', 'Sparkles', 'Workflow', 'ShoppingCart',
  'GraduationCap', 'Briefcase', 'BarChart3', 'Shield', 'MessageSquare',
  'Search', 'FileText', 'Rocket', 'Zap', 'Cpu', 'Database', 'Cloud',
];
