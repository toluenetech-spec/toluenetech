import React, { createContext, useContext, useState, useEffect } from 'react';
import { Project, MediaItem, SocialLinks } from '../types';
import { INITIAL_PROJECTS, INITIAL_SOCIAL_LINKS } from '../constants';
import { db, storage } from '../firebase';
import { 
  collection, getDocs, doc, setDoc, deleteDoc, updateDoc, onSnapshot 
} from 'firebase/firestore';
import { 
  ref, uploadBytes, getDownloadURL, deleteObject 
} from 'firebase/storage';

// Define Founder Note Type
export interface FounderNote {
  heading: string;
  message: string;
  name: string;
  role: string;
}

// Define Notification Type
export interface SiteNotification {
  message: string;
  link?: string;
  linkText?: string;
  isActive: boolean;
}

interface ProjectContextType {
  projects: Project[];
  addProject: (project: Project) => Promise<void>;
  updateProject: (id: string, updatedProject: Partial<Project>) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  getProject: (id: string) => Project | undefined;
  
  // Media Library
  mediaLibrary: MediaItem[];
  addToLibrary: (fileOrUrl: File | string) => Promise<string>;
  deleteFromLibrary: (id: string) => Promise<void>;
  
  // Brand Assets
  brandProfileData: string | null;
  updateBrandProfile: (file: File | string) => Promise<void>;
  
  portfolioHighlightData: string | null;
  updatePortfolioHighlight: (file: File | string) => Promise<void>;
  
  pricingGuideData: string | null;
  updatePricingGuide: (file: File | string) => Promise<void>;

  founderImageData: string | null;
  updateFounderImage: (file: File | string) => Promise<void>;

  // Founder Note
  founderNote: FounderNote;
  updateFounderNote: (note: FounderNote) => Promise<void>;

  // Site Notification
  siteNotification: SiteNotification;
  updateSiteNotification: (notification: SiteNotification) => Promise<void>;

  // Social Links
  socialLinks: SocialLinks;
  updateSocialLinks: (links: SocialLinks) => Promise<void>;

  // Loading State
  isLoading: boolean;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

const INITIAL_NOTE: FounderNote = {
  heading: "A Note from the Founder",
  message: "We founded Toluene Tech because we saw a disconnect between design agencies and dev shops — and a growing gap between businesses and the AI tools transforming their industries. We are the synthesis: premium design, rigorous engineering, and practical AI integration.",
  name: "Toluwalase O. Samuel",
  role: "Lead Engineer & Founder"
};

const INITIAL_NOTIFICATION: SiteNotification = {
  message: "Welcome to Toluene Tech! We now offer AI Integration & Automation.",
  isActive: false,
  link: "/services",
  linkText: "Learn More"
};

export const ProjectProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [projects, setProjects] = useState<Project[]>([]);
  const [mediaLibrary, setMediaLibrary] = useState<MediaItem[]>([]);
  
  // Asset States
  const [brandProfileData, setBrandProfileData] = useState<string | null>(null);
  const [portfolioHighlightData, setPortfolioHighlightData] = useState<string | null>(null);
  const [pricingGuideData, setPricingGuideData] = useState<string | null>(null);
  const [founderImageData, setFounderImageData] = useState<string | null>(null);
  
  // Settings States
  const [founderNote, setFounderNote] = useState<FounderNote>(INITIAL_NOTE);
  const [siteNotification, setSiteNotification] = useState<SiteNotification>(INITIAL_NOTIFICATION);
  const [socialLinks, setSocialLinks] = useState<SocialLinks>(INITIAL_SOCIAL_LINKS);

  // 1. Fetch All Data from Firebase on Mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        // A. Fetch Projects
        const projectSnapshot = await getDocs(collection(db, 'projects'));
        if (!projectSnapshot.empty) {
            const projectList = projectSnapshot.docs.map(doc => doc.data() as Project);
            setProjects(projectList);
        } else {
             // If DB is empty, we start with empty state to allow user to add their own.
             setProjects([]);
        }

        // B. Fetch Media Library (Stored in a 'media' collection)
        const mediaSnapshot = await getDocs(collection(db, 'media'));
        if (!mediaSnapshot.empty) {
            setMediaLibrary(mediaSnapshot.docs.map(doc => doc.data() as MediaItem));
        }

        // C. Fetch Settings (Stored in 'settings' collection, doc 'global')
        // Listen to settings changes in real-time
        const unsubscribe = onSnapshot(doc(db, 'settings', 'global'), (doc) => {
             if (doc.exists()) {
                 const data = doc.data();
                 if (data.founderNote) setFounderNote(data.founderNote);
                 if (data.siteNotification) setSiteNotification(data.siteNotification);
                 if (data.socialLinks) setSocialLinks(data.socialLinks);
                 if (data.brandProfileData) setBrandProfileData(data.brandProfileData);
                 if (data.portfolioHighlightData) setPortfolioHighlightData(data.portfolioHighlightData);
                 if (data.pricingGuideData) setPricingGuideData(data.pricingGuideData);
                 if (data.founderImageData) setFounderImageData(data.founderImageData);
             }
        });

        return () => unsubscribe();
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  // --- Actions ---

  // Projects
  const addProject = async (project: Project) => {
    // Optimistic update
    setProjects(prev => [project, ...prev]);
    // Firebase update
    await setDoc(doc(db, 'projects', project.id), project);
  };

  const updateProject = async (id: string, updated: Partial<Project>) => {
    setProjects(prev => prev.map(p => p.id === id ? { ...p, ...updated } : p));
    await updateDoc(doc(db, 'projects', id), updated);
  };

  const deleteProject = async (id: string) => {
    setProjects(prev => prev.filter(p => p.id !== id));
    await deleteDoc(doc(db, 'projects', id));
  };

  const getProject = (id: string) => {
    return projects.find(p => p.id === id);
  };

  // Helper: Upload file to Firebase Storage
  const uploadToStorage = async (file: File, path: string): Promise<string> => {
    const storageRef = ref(storage, path);
    const snapshot = await uploadBytes(storageRef, file);
    const url = await getDownloadURL(snapshot.ref);
    return url;
  };

  // Media Library
  const addToLibrary = async (fileOrUrl: File | string): Promise<string> => {
    try {
      let url = '';
      let name = '';
      let type = 'image/jpeg'; // Default assumption for URLs

      if (typeof fileOrUrl === 'string') {
          // It's a URL
          url = fileOrUrl;
          name = 'External Image';
      } else {
          // It's a File
          const fileName = `${Date.now()}_${fileOrUrl.name}`;
          url = await uploadToStorage(fileOrUrl, `media/${fileName}`);
          name = fileOrUrl.name;
          type = fileOrUrl.type;
      }
      
      const newItem: MediaItem = {
        id: Date.now().toString(),
        data: url, 
        name: name,
        type: type
      };

      setMediaLibrary(prev => [newItem, ...prev]);
      // Save metadata to Firestore
      await setDoc(doc(db, 'media', newItem.id), newItem);
      return url;
    } catch (e) {
      console.error("Upload failed", e);
      throw e;
    }
  };

  const deleteFromLibrary = async (id: string) => {
    const item = mediaLibrary.find(m => m.id === id);
    setMediaLibrary(prev => prev.filter(m => m.id !== id));
    
    // Delete from Firestore
    await deleteDoc(doc(db, 'media', id));
  };

  // Update Settings in Firestore
  const updateSettingsField = async (field: string, value: any) => {
      await setDoc(doc(db, 'settings', 'global'), { [field]: value }, { merge: true });
  };

  // Asset Actions
  const updateBrandProfile = async (fileOrUrl: File | string) => {
    let url = typeof fileOrUrl === 'string' ? fileOrUrl : '';
    if (typeof fileOrUrl !== 'string') {
        url = await uploadToStorage(fileOrUrl, `docs/brand_cv_${Date.now()}.pdf`);
    }
    setBrandProfileData(url);
    await updateSettingsField('brandProfileData', url);
  };

  const updatePortfolioHighlight = async (fileOrUrl: File | string) => {
    let url = typeof fileOrUrl === 'string' ? fileOrUrl : '';
    if (typeof fileOrUrl !== 'string') {
        url = await uploadToStorage(fileOrUrl, `docs/portfolio_${Date.now()}.pdf`);
    }
    setPortfolioHighlightData(url);
    await updateSettingsField('portfolioHighlightData', url);
  };

  const updatePricingGuide = async (fileOrUrl: File | string) => {
    let url = typeof fileOrUrl === 'string' ? fileOrUrl : '';
    if (typeof fileOrUrl !== 'string') {
        url = await uploadToStorage(fileOrUrl, `docs/pricing_${Date.now()}.pdf`);
    }
    setPricingGuideData(url);
    await updateSettingsField('pricingGuideData', url);
  };

  const updateFounderImage = async (fileOrUrl: File | string) => {
    let url = typeof fileOrUrl === 'string' ? fileOrUrl : '';
    if (typeof fileOrUrl !== 'string') {
        url = await uploadToStorage(fileOrUrl, `images/founder_${Date.now()}`);
    }
    setFounderImageData(url);
    await updateSettingsField('founderImageData', url);
  };

  const updateFounderNote = async (note: FounderNote) => {
    setFounderNote(note);
    await updateSettingsField('founderNote', note);
  };

  const updateSiteNotification = async (notification: SiteNotification) => {
    setSiteNotification(notification);
    await updateSettingsField('siteNotification', notification);
  };

  const updateSocialLinks = async (links: SocialLinks) => {
    setSocialLinks(links);
    await updateSettingsField('socialLinks', links);
  };

  return (
    <ProjectContext.Provider value={{ 
      projects, addProject, updateProject, deleteProject, getProject,
      mediaLibrary, addToLibrary, deleteFromLibrary,
      brandProfileData, updateBrandProfile,
      portfolioHighlightData, updatePortfolioHighlight,
      pricingGuideData, updatePricingGuide,
      founderImageData, updateFounderImage,
      founderNote, updateFounderNote,
      siteNotification, updateSiteNotification,
      socialLinks, updateSocialLinks,
      isLoading
    }}>
      {children}
    </ProjectContext.Provider>
  );
};

export const useProjects = () => {
  const context = useContext(ProjectContext);
  if (!context) {
    throw new Error('useProjects must be used within a ProjectProvider');
  }
  return context;
};