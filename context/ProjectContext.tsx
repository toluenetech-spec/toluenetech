// ProjectContext is kept as a thin re-export wrapper around DataContext for backward
// compatibility. New code should import directly from ./DataContext.
import React from 'react';
import { DataContext, DataProvider, useData } from './DataContext';

export { DataProvider, useData };
export const ProjectContext = DataContext;

// Compatibility hooks (named exports used by legacy imports)
export const useProjects = useData;
export const useMediaLibrary = useData;
export const useSocialLinks = useData;

export default DataContext;

// Re-export types that old imports reference
export type {
  Project, MediaItem, SocialLinks, FounderNote, SiteNotification,
} from '../types';
