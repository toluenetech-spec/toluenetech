import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useProjects } from '../context/ProjectContext';
import { Project, ProjectCategory } from '../types';
import { Trash2, Edit2, Plus, LogOut, Save, X, Upload, Image as ImageIcon, FileText, Briefcase, User, MessageCircle, AlertCircle, CheckCircle, Bell, Link as LinkIcon, AlertTriangle, Share2, Cloud, ExternalLink } from 'lucide-react';

const Admin: React.FC = () => {
  const { isAuthenticated, login, logout } = useAuth();
  const { 
    projects, addProject, updateProject, deleteProject, 
    mediaLibrary, addToLibrary, deleteFromLibrary, 
    updateBrandProfile, updatePortfolioHighlight, updatePricingGuide,
    updateFounderImage, founderNote, updateFounderNote,
    siteNotification, updateSiteNotification,
    socialLinks, updateSocialLinks,
    isLoading
  } = useProjects();
  
  const [password, setPassword] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [showMediaLibrary, setShowMediaLibrary] = useState(false);
  
  // New State for Media Library URL input
  const [mediaLibUrlInput, setMediaLibUrlInput] = useState('');
  
  // Loading state for specific buttons
  const [isSaving, setIsSaving] = useState(false);

  // Login UI States
  const [loginStatus, setLoginStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [uploadSuccess, setUploadSuccess] = useState<{ show: boolean, message: string }>({ show: false, message: '' });

  const [urlInputs, setUrlInputs] = useState({
    profile: '',
    portfolio: '',
    pricing: '',
    founder: ''
  });

  const [noteForm, setNoteForm] = useState(founderNote);
  const [notifForm, setNotifForm] = useState(siteNotification);
  const [socialForm, setSocialForm] = useState(socialLinks);

  // Sync forms with context data when it loads from Firebase
  useEffect(() => {
    setNoteForm(founderNote);
  }, [founderNote]);
  
  useEffect(() => {
      setNotifForm(siteNotification);
  }, [siteNotification]);

  useEffect(() => {
      setSocialForm(socialLinks);
  }, [socialLinks]);

  const initialFormState: Omit<Project, 'id'> = {
    title: '',
    category: 'Web Design',
    shortDescription: '',
    fullDescription: '',
    tools: [],
    imageUrl: 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?ixlib=rb-1.2.1&auto=format&fit=crop&w=1350&q=80',
    isFeatured: false,
    isPublished: false,
    clientProblem: '',
    solution: '',
    outcome: ''
  };
  const [formData, setFormData] = useState<Omit<Project, 'id'>>(initialFormState);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (login(password)) {
      setLoginStatus('success');
    } else {
      setLoginStatus('error');
    }
  };

  const handleSaveProject = async () => {
    setIsSaving(true);
    try {
        if (editingId) {
            await updateProject(editingId, formData);
            setEditingId(null);
            setUploadSuccess({ show: true, message: "Project Updated!" });
        } else {
            await addProject({ ...formData, id: Date.now().toString() });
            setIsAdding(false);
            setUploadSuccess({ show: true, message: "Project Created!" });
        }
        setFormData(initialFormState);
        setTimeout(() => setUploadSuccess({ show: false, message: '' }), 2000);
    } catch (e) {
        alert("Error saving project");
    } finally {
        setIsSaving(false);
    }
  };

  const handleSaveNote = async () => {
    setIsSaving(true);
    await updateFounderNote(noteForm);
    setIsSaving(false);
    setUploadSuccess({ show: true, message: "Founder's Note Saved!" });
    setTimeout(() => setUploadSuccess({ show: false, message: '' }), 2000);
  };

  const handleSaveNotification = async () => {
      setIsSaving(true);
      await updateSiteNotification(notifForm);
      setIsSaving(false);
      setUploadSuccess({ show: true, message: "Notification Settings Saved!" });
      setTimeout(() => setUploadSuccess({ show: false, message: '' }), 2000);
  };

  const handleSaveSocials = async () => {
      setIsSaving(true);
      await updateSocialLinks(socialForm);
      setIsSaving(false);
      setUploadSuccess({ show: true, message: "Social Links Saved!" });
      setTimeout(() => setUploadSuccess({ show: false, message: '' }), 2000);
  };

  const startEdit = (project: Project) => {
    setFormData(project);
    setEditingId(project.id);
    setIsAdding(true);
  };

  const handleToolChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const tools = e.target.value.split(',').map(t => t.trim());
      setFormData({...formData, tools});
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      try {
        await addToLibrary(file);
      } catch (error) {
        alert('File upload failed (Check Storage Rules).');
      }
    }
  };

  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      try {
        setUploadSuccess({ show: true, message: "Uploading video..." });
        const url = await addToLibrary(file);
        setFormData(prev => ({ ...prev, videoUrl: url }));
        setUploadSuccess({ show: true, message: "Video uploaded!" });
        setTimeout(() => setUploadSuccess({ show: false, message: '' }), 2000);
      } catch (error) {
        setUploadSuccess({ show: false, message: '' });
        alert('Video upload failed (Check Storage Rules).');
      }
    }
  };

  const handleMediaUrlUpload = async () => {
      if (!mediaLibUrlInput) return;
      try {
          await addToLibrary(mediaLibUrlInput);
          setMediaLibUrlInput('');
      } catch (error) {
          alert('Failed to add URL to library');
      }
  };

  const handleAssetUpdate = async (type: 'profile' | 'portfolio' | 'pricing', file?: File) => {
     try {
        setUploadSuccess({ show: true, message: "Uploading..." });
        if (file) {
            if (type === 'profile') await updateBrandProfile(file);
            if (type === 'portfolio') await updatePortfolioHighlight(file);
            if (type === 'pricing') await updatePricingGuide(file);
        } else if (urlInputs[type]) {
            if (type === 'profile') await updateBrandProfile(urlInputs[type]);
            if (type === 'portfolio') await updatePortfolioHighlight(urlInputs[type]);
            if (type === 'pricing') await updatePricingGuide(urlInputs[type]);
            setUrlInputs({...urlInputs, [type]: ''});
        }
        setUploadSuccess({ show: true, message: "Asset Updated!" });
        setTimeout(() => setUploadSuccess({ show: false, message: '' }), 2000);
     } catch (e) {
        setUploadSuccess({ show: false, message: '' });
        alert("Update failed. If uploading a file, check Firebase Storage Rules.");
     }
  };

  const handleFounderImageUpdate = async (file?: File) => {
      try {
        setUploadSuccess({ show: true, message: "Updating..." });
        if (file) {
             await updateFounderImage(file);
        } else if (urlInputs.founder) {
             await updateFounderImage(urlInputs.founder);
             setUrlInputs({...urlInputs, founder: ''});
        }
        setUploadSuccess({ show: true, message: "Founder Image Updated!" });
        setTimeout(() => setUploadSuccess({ show: false, message: '' }), 2000);
      } catch (error) {
        setUploadSuccess({ show: false, message: '' });
        alert('Update failed.');
      }
  };

  const selectImage = (url: string) => {
    setFormData({ ...formData, imageUrl: url });
    setShowMediaLibrary(false);
  };

  // Auth Checks
  if (isAuthenticated && loginStatus === 'idle') {
      // Just render dashboard
  } else if (isAuthenticated && loginStatus === 'success') {
      return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in">
              <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-2xl text-center transform scale-110">
                  <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
                  <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Welcome Admin</h2>
                  <p className="text-slate-500 dark:text-slate-400 mt-2">Connecting to Firebase...</p>
                  {setTimeout(() => setLoginStatus('idle'), 1500) && ""} 
              </div>
          </div>
      );
  } else if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 dark:bg-slate-900 transition-colors p-4">
        {loginStatus === 'error' && (
             <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
                <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-2xl max-w-sm w-full text-center border-t-4 border-red-500">
                    <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-3" />
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Incorrect Password</h3>
                    <button onClick={() => setLoginStatus('idle')} className="w-full bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 py-2 rounded-lg font-bold hover:bg-slate-300 dark:hover:bg-slate-600">
                        Retry
                    </button>
                </div>
             </div>
        )}
        <form onSubmit={handleLogin} className="bg-white dark:bg-slate-800 p-8 rounded-lg shadow-md w-full max-w-sm">
          <h2 className="text-2xl font-bold mb-6 text-center text-slate-900 dark:text-white">Admin Login</h2>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border p-3 rounded mb-4 bg-white dark:bg-slate-700 text-slate-900 dark:text-white border-slate-300 dark:border-slate-600"
            placeholder="Password"
          />
          <button type="submit" className="w-full bg-brand-600 text-white py-2 rounded font-bold hover:bg-brand-700">Login</button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-6 transition-colors">
      <div className="max-w-6xl mx-auto">
        
        {uploadSuccess.show && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-[2px] animate-fade-in">
                <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-2xl flex flex-col items-center animate-fade-in-up border border-green-200 dark:border-green-900">
                    <div className="w-12 h-12 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mb-3">
                        <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
                    </div>
                    <span className="text-lg font-bold text-slate-800 dark:text-white">{uploadSuccess.message}</span>
                </div>
            </div>
        )}

        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-3">
             <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Cloud Dashboard</h1>
             <span className="bg-green-100 text-green-800 text-xs font-bold px-2 py-1 rounded border border-green-200 flex items-center gap-1">
                 <Cloud className="h-3 w-3" /> Online
             </span>
          </div>
          <button onClick={logout} className="flex items-center gap-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 px-4 py-2 rounded">
            <LogOut className="h-4 w-4" /> Logout
          </button>
        </div>

        {/* Social Media & Contact Links */}
        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-6 mb-8">
            <div className="flex items-center gap-2 mb-4">
                <Share2 className="h-6 w-6 text-brand-600 dark:text-brand-400" />
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">Social Media & Contact Info</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div>
                    <label className="block text-sm font-medium mb-1">Company Email</label>
                    <input 
                        type="text" 
                        className="w-full border p-2 rounded bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700"
                        value={socialForm.email} 
                        onChange={e => setSocialForm({...socialForm, email: e.target.value})} 
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium mb-1">WhatsApp Number</label>
                    <input 
                        type="text" 
                        className="w-full border p-2 rounded bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700"
                        value={socialForm.whatsapp} 
                        onChange={e => setSocialForm({...socialForm, whatsapp: e.target.value})} 
                    />
                </div>
                 <div>
                    <label className="block text-sm font-medium mb-1">LinkedIn URL</label>
                    <input 
                        type="text" 
                        className="w-full border p-2 rounded bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700"
                        value={socialForm.linkedin} 
                        onChange={e => setSocialForm({...socialForm, linkedin: e.target.value})} 
                        placeholder="https://linkedin.com/..."
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium mb-1">Facebook URL</label>
                    <input 
                        type="text" 
                        className="w-full border p-2 rounded bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700"
                        value={socialForm.facebook} 
                        onChange={e => setSocialForm({...socialForm, facebook: e.target.value})} 
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium mb-1">Twitter (X) URL</label>
                    <input 
                        type="text" 
                        className="w-full border p-2 rounded bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700"
                        value={socialForm.twitter} 
                        onChange={e => setSocialForm({...socialForm, twitter: e.target.value})} 
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium mb-1">Instagram URL</label>
                    <input 
                        type="text" 
                        className="w-full border p-2 rounded bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700"
                        value={socialForm.instagram} 
                        onChange={e => setSocialForm({...socialForm, instagram: e.target.value})} 
                    />
                </div>
            </div>
            <div className="mt-4 flex justify-end">
                <button onClick={handleSaveSocials} disabled={isSaving} className="bg-brand-600 text-white px-4 py-2 rounded font-bold hover:bg-brand-700 flex items-center gap-2 disabled:opacity-50">
                    <Save className="h-4 w-4" /> {isSaving ? 'Saving...' : 'Save Links'}
                </button>
            </div>
        </div>
        
        {/* Notification Manager */}
        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-6 mb-8 border-l-4 border-l-brand-500">
            <div className="flex items-center gap-2 mb-4">
                <Bell className="h-6 w-6 text-brand-600 dark:text-brand-400" />
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">Website Notification Ad</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                    <label className="block text-sm font-medium mb-1">Notification Message</label>
                    <input 
                        type="text" 
                        className="w-full border p-2 rounded bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700"
                        value={notifForm.message} 
                        onChange={e => setNotifForm({...notifForm, message: e.target.value})} 
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium mb-1">Link URL</label>
                    <input 
                        type="text" 
                        className="w-full border p-2 rounded bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700"
                        value={notifForm.link || ''} 
                        onChange={e => setNotifForm({...notifForm, link: e.target.value})} 
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium mb-1">Link Text</label>
                    <input 
                        type="text" 
                        className="w-full border p-2 rounded bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700"
                        value={notifForm.linkText || ''} 
                        onChange={e => setNotifForm({...notifForm, linkText: e.target.value})} 
                    />
                </div>
            </div>
            
            <div className="flex justify-between items-center mt-6 pt-4 border-t border-slate-100 dark:border-slate-800">
                <label className="flex items-center gap-3 cursor-pointer">
                    <div className={`w-12 h-6 rounded-full p-1 transition-colors ${notifForm.isActive ? 'bg-brand-600' : 'bg-slate-300 dark:bg-slate-700'}`}>
                        <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${notifForm.isActive ? 'translate-x-6' : 'translate-x-0'}`}></div>
                    </div>
                    <input 
                        type="checkbox" 
                        className="hidden" 
                        checked={notifForm.isActive}
                        onChange={e => setNotifForm({...notifForm, isActive: e.target.checked})}
                    />
                    <span className={`font-bold ${notifForm.isActive ? 'text-brand-600' : 'text-slate-500'}`}>
                        {notifForm.isActive ? 'Ad is Active' : 'Ad is Disabled'}
                    </span>
                </label>
                <button onClick={handleSaveNotification} disabled={isSaving} className="bg-brand-600 text-white px-6 py-2 rounded font-bold hover:bg-brand-700 disabled:opacity-50">
                    {isSaving ? 'Saving...' : 'Save Ad Settings'}
                </button>
            </div>
        </div>

        {/* Brand Assets */}
        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-6 mb-8">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Brand Assets & Downloads</h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
               {/* Brand Profile */}
               <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg border border-slate-100 dark:border-slate-800">
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-2">
                     <Briefcase className="h-4 w-4" /> Brand CV (PDF)
                  </label>
                  <div className="space-y-3">
                     <label className="cursor-pointer bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 px-3 py-2 rounded border border-slate-300 dark:border-slate-600 flex items-center justify-center gap-2 transition-colors text-sm shadow-sm">
                        <Upload className="h-3 w-3" /> Upload File
                        <input type="file" className="hidden" accept="application/pdf" onChange={(e) => handleAssetUpdate('profile', e.target.files?.[0])} />
                     </label>
                     <div className="text-center text-xs text-slate-400">- OR -</div>
                     <div className="flex gap-1">
                        <input 
                            type="text" 
                            placeholder="Paste Link..." 
                            className="w-full text-xs p-2 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900"
                            value={urlInputs.profile}
                            onChange={(e) => setUrlInputs({...urlInputs, profile: e.target.value})}
                        />
                        <button onClick={() => handleAssetUpdate('profile')} className="bg-slate-200 dark:bg-slate-700 p-2 rounded hover:bg-slate-300">
                            <Save className="h-3 w-3" />
                        </button>
                     </div>
                  </div>
               </div>
               
               {/* Portfolio */}
               <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg border border-slate-100 dark:border-slate-800">
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-2">
                     <ImageIcon className="h-4 w-4" /> Portfolio Highlight
                  </label>
                  <div className="space-y-3">
                     <label className="cursor-pointer bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 px-3 py-2 rounded border border-slate-300 dark:border-slate-600 flex items-center justify-center gap-2 transition-colors text-sm shadow-sm">
                        <Upload className="h-3 w-3" /> Upload File
                        <input type="file" className="hidden" accept="application/pdf" onChange={(e) => handleAssetUpdate('portfolio', e.target.files?.[0])} />
                     </label>
                     <div className="text-center text-xs text-slate-400">- OR -</div>
                     <div className="flex gap-1">
                        <input 
                            type="text" 
                            placeholder="Paste Link..." 
                            className="w-full text-xs p-2 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900"
                            value={urlInputs.portfolio}
                            onChange={(e) => setUrlInputs({...urlInputs, portfolio: e.target.value})}
                        />
                        <button onClick={() => handleAssetUpdate('portfolio')} className="bg-slate-200 dark:bg-slate-700 p-2 rounded hover:bg-slate-300">
                            <Save className="h-3 w-3" />
                        </button>
                     </div>
                  </div>
               </div>

               {/* Pricing */}
               <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg border border-slate-100 dark:border-slate-800">
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-2">
                     <FileText className="h-4 w-4" /> Pricing Guide
                  </label>
                  <div className="space-y-3">
                     <label className="cursor-pointer bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 px-3 py-2 rounded border border-slate-300 dark:border-slate-600 flex items-center justify-center gap-2 transition-colors text-sm shadow-sm">
                        <Upload className="h-3 w-3" /> Upload File
                        <input type="file" className="hidden" accept="application/pdf" onChange={(e) => handleAssetUpdate('pricing', e.target.files?.[0])} />
                     </label>
                     <div className="text-center text-xs text-slate-400">- OR -</div>
                     <div className="flex gap-1">
                        <input 
                            type="text" 
                            placeholder="Paste Link..." 
                            className="w-full text-xs p-2 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900"
                            value={urlInputs.pricing}
                            onChange={(e) => setUrlInputs({...urlInputs, pricing: e.target.value})}
                        />
                        <button onClick={() => handleAssetUpdate('pricing')} className="bg-slate-200 dark:bg-slate-700 p-2 rounded hover:bg-slate-300">
                            <Save className="h-3 w-3" />
                        </button>
                     </div>
                  </div>
               </div>

                {/* Founder Image */}
               <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg border border-slate-100 dark:border-slate-800">
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-2">
                     <User className="h-4 w-4" /> Founder Image
                  </label>
                  <div className="space-y-3">
                    <label className="cursor-pointer bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 px-3 py-6 rounded border border-dashed border-slate-300 dark:border-slate-600 flex flex-col items-center justify-center gap-2 transition-colors text-sm">
                        <Upload className="h-5 w-5 text-brand-500" /> 
                        <span>Upload Photo</span>
                        <input type="file" className="hidden" accept="image/*" onChange={(e) => handleFounderImageUpdate(e.target.files?.[0])} />
                    </label>
                    <div className="text-center text-xs text-slate-400">- OR -</div>
                     <div className="flex gap-1">
                        <input 
                            type="text" 
                            placeholder="Paste Image URL..." 
                            className="w-full text-xs p-2 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900"
                            value={urlInputs.founder}
                            onChange={(e) => setUrlInputs({...urlInputs, founder: e.target.value})}
                        />
                        <button onClick={() => handleFounderImageUpdate()} className="bg-slate-200 dark:bg-slate-700 p-2 rounded hover:bg-slate-300">
                            <Save className="h-3 w-3" />
                        </button>
                     </div>
                  </div>
               </div>
            </div>
        </div>

        {/* Founder Note */}
        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-6 mb-8">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Edit "A Note From The Founder"</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <label className="block text-sm font-medium mb-1">Section Heading</label>
                    <input 
                        type="text" 
                        className="w-full border p-2 rounded bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700"
                        value={noteForm.heading} 
                        onChange={e => setNoteForm({...noteForm, heading: e.target.value})} 
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium mb-1">Founder Name</label>
                    <input 
                        type="text" 
                        className="w-full border p-2 rounded bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700"
                        value={noteForm.name} 
                        onChange={e => setNoteForm({...noteForm, name: e.target.value})} 
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium mb-1">Role/Title</label>
                    <input 
                        type="text" 
                        className="w-full border p-2 rounded bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700"
                        value={noteForm.role} 
                        onChange={e => setNoteForm({...noteForm, role: e.target.value})} 
                    />
                </div>
                <div className="md:col-span-2">
                    <label className="block text-sm font-medium mb-1">Message Body</label>
                    <textarea 
                        className="w-full border p-2 rounded h-24 bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700"
                        value={noteForm.message} 
                        onChange={e => setNoteForm({...noteForm, message: e.target.value})} 
                    />
                </div>
            </div>
            <div className="mt-4 flex justify-end">
                <button onClick={handleSaveNote} disabled={isSaving} className="bg-brand-600 text-white px-4 py-2 rounded font-bold hover:bg-brand-700 flex items-center gap-2 disabled:opacity-50">
                    <Save className="h-4 w-4" /> {isSaving ? 'Saving...' : 'Save Note'}
                </button>
            </div>
        </div>

        {/* Project List */}
        {!isAdding && (
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
             <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
                <h2 className="font-bold text-lg text-slate-900 dark:text-white">All Projects</h2>
                <button 
                  onClick={() => { setIsAdding(true); setFormData(initialFormState); setEditingId(null); }}
                  className="bg-brand-600 text-white px-4 py-2 rounded flex items-center gap-2 text-sm font-bold hover:bg-brand-700"
                >
                  <Plus className="h-4 w-4" /> Add New
                </button>
             </div>
             <div className="overflow-x-auto">
              {isLoading ? (
                  <div className="p-8 text-center text-slate-500">Loading projects from cloud...</div>
              ) : (
                <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 uppercase">
                    <tr>
                        <th className="p-4">Title</th>
                        <th className="p-4">Category</th>
                        <th className="p-4">Status</th>
                        <th className="p-4">Featured</th>
                        <th className="p-4 text-right">Actions</th>
                    </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {projects.map(p => (
                        <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-700 dark:text-slate-300">
                        <td className="p-4 font-medium text-slate-900 dark:text-white">{p.title}</td>
                        <td className="p-4">{p.category}</td>
                        <td className="p-4">
                            <span className={`px-2 py-1 rounded-full text-xs font-bold ${p.isPublished ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400'}`}>
                            {p.isPublished ? 'Published' : 'Draft'}
                            </span>
                        </td>
                        <td className="p-4">{p.isFeatured ? '⭐ Yes' : '-'}</td>
                        <td className="p-4 text-right space-x-2">
                            <button onClick={() => startEdit(p)} className="text-blue-600 dark:text-blue-400 hover:text-blue-800"><Edit2 className="h-4 w-4" /></button>
                            <button onClick={() => deleteProject(p.id)} className="text-red-600 dark:text-red-400 hover:text-red-800"><Trash2 className="h-4 w-4" /></button>
                        </td>
                        </tr>
                    ))}
                    </tbody>
                </table>
              )}
             </div>
          </div>
        )}

        {/* Add/Edit Form */}
        {isAdding && (
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-lg border border-slate-200 dark:border-slate-800 p-6 text-slate-900 dark:text-white">
            <div className="flex justify-between items-center mb-6">
               <h2 className="text-xl font-bold">{editingId ? 'Edit Project' : 'New Project'}</h2>
               <button onClick={() => setIsAdding(false)} className="text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"><X /></button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
               <div>
                 <label className="block text-sm font-medium mb-1">Title</label>
                 <input 
                    type="text" 
                    className="w-full border p-2 rounded bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700"
                    value={formData.title} 
                    onChange={e => setFormData({...formData, title: e.target.value})} 
                 />
               </div>
               <div>
                 <label className="block text-sm font-medium mb-1">Category</label>
                 <select 
                    className="w-full border p-2 rounded bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700"
                    value={formData.category}
                    onChange={e => setFormData({...formData, category: e.target.value as ProjectCategory})}
                 >
                    <option value="Web Design">Web Design</option>
                    <option value="Frontend">Frontend</option>
                    <option value="UI/UX">UI/UX</option>
                    <option value="Product Design">Product Design</option>
                    <option value="Motion & Video">Motion & Video</option>
                 </select>
               </div>
               <div className="md:col-span-2">
                 <label className="block text-sm font-medium mb-1">Short Description</label>
                 <input 
                    type="text" 
                    className="w-full border p-2 rounded bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700"
                    value={formData.shortDescription} 
                    onChange={e => setFormData({...formData, shortDescription: e.target.value})} 
                 />
               </div>
               <div className="md:col-span-2">
                 <label className="block text-sm font-medium mb-1">Full Description</label>
                 <textarea 
                    className="w-full border p-2 rounded h-32 bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700"
                    value={formData.fullDescription} 
                    onChange={e => setFormData({...formData, fullDescription: e.target.value})} 
                 />
               </div>
               
               <div className="md:col-span-2 border-t dark:border-slate-700 pt-4 mt-2">
                 <h3 className="font-bold text-slate-700 dark:text-slate-300 mb-4">Case Study Details</h3>
               </div>
               
               <div className="md:col-span-2">
                 <label className="block text-sm font-medium mb-1">Client Problem</label>
                 <textarea 
                    className="w-full border p-2 rounded h-20 bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700"
                    value={formData.clientProblem} 
                    onChange={e => setFormData({...formData, clientProblem: e.target.value})} 
                 />
               </div>
               <div className="md:col-span-2">
                 <label className="block text-sm font-medium mb-1">Solution</label>
                 <textarea 
                    className="w-full border p-2 rounded h-20 bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700"
                    value={formData.solution} 
                    onChange={e => setFormData({...formData, solution: e.target.value})} 
                 />
               </div>
               <div className="md:col-span-2">
                 <label className="block text-sm font-medium mb-1">Outcome</label>
                 <textarea 
                    className="w-full border p-2 rounded h-20 bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700"
                    value={formData.outcome} 
                    onChange={e => setFormData({...formData, outcome: e.target.value})} 
                 />
               </div>
               <div className="md:col-span-2">
                    <label className="block text-sm font-medium mb-1">Live Project Link (Optional)</label>
                    <input
                        type="text"
                        className="w-full border p-2 rounded bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700"
                        placeholder="https://..."
                        value={formData.liveUrl || ''}
                        onChange={e => setFormData({...formData, liveUrl: e.target.value})}
                    />
               </div>

               <div className="md:col-span-2">
                    <label className="block text-sm font-medium mb-1">Project Video URL (Optional — autoplays on cards)</label>
                    <div className="flex gap-2 items-center">
                        <input
                            type="text"
                            className="w-full border p-2 rounded bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700"
                            placeholder="Paste a video URL (.mp4) or upload below"
                            value={formData.videoUrl || ''}
                            onChange={e => setFormData({...formData, videoUrl: e.target.value})}
                        />
                        <label className="cursor-pointer whitespace-nowrap bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 hover:bg-brand-700">
                            <Upload className="h-4 w-4" /> Upload
                            <input type="file" className="hidden" accept="video/*" onChange={handleVideoUpload} />
                        </label>
                        {formData.videoUrl && (
                            <button
                                type="button"
                                onClick={() => setFormData({...formData, videoUrl: ''})}
                                className="whitespace-nowrap bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-3 py-2 rounded-lg text-sm font-medium hover:bg-slate-300 dark:hover:bg-slate-600"
                            >
                                Clear
                            </button>
                        )}
                    </div>
                    {formData.videoUrl && (
                        <video
                            src={formData.videoUrl}
                            muted
                            loop
                            autoPlay
                            playsInline
                            className="mt-3 w-full max-w-xs rounded-lg border dark:border-slate-700"
                        />
                    )}
                    <p className="text-xs text-slate-400 mt-1">If a video is set, it plays automatically on the portfolio cards. The Project Image is used as the poster/fallback.</p>
               </div>

               <div>
                 <label className="block text-sm font-medium mb-1">Tools (comma separated)</label>
                 <input 
                    type="text" 
                    className="w-full border p-2 rounded bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700"
                    value={formData.tools.join(', ')} 
                    onChange={handleToolChange} 
                    placeholder="React, Figma, etc."
                 />
               </div>

               <div className="md:col-span-2">
                 <label className="block text-sm font-medium mb-1">Project Image</label>
                 <div className="flex gap-4 items-center">
                    <img src={formData.imageUrl} alt="Preview" className="w-24 h-24 object-cover rounded-lg border dark:border-slate-700" />
                    <div className="flex flex-col gap-2 w-full max-w-sm">
                         {/* Manual URL Input for Image (Backup for File Upload) */}
                         <div className="flex gap-1">
                            <input 
                                type="text" 
                                className="w-full text-xs p-2 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900"
                                placeholder="Paste Image URL here..."
                                value={formData.imageUrl} 
                                onChange={e => setFormData({...formData, imageUrl: e.target.value})} 
                            />
                         </div>

                         <button 
                            onClick={() => setShowMediaLibrary(!showMediaLibrary)} 
                            className="bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 hover:bg-brand-700 mt-2"
                         >
                            <ImageIcon className="h-4 w-4" /> Select from Library
                         </button>
                    </div>
                 </div>
                 
                 {/* Media Library Dropdown/Modal */}
                 {showMediaLibrary && (
                    <div className="mt-4 border dark:border-slate-700 rounded-lg p-4 bg-slate-50 dark:bg-slate-800">
                        <div className="flex flex-col gap-3 mb-4">
                            <h4 className="font-bold text-sm">Media Library (Cloud)</h4>
                            
                            {/* Upload New Section */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-slate-100 dark:bg-slate-700/50 p-3 rounded-lg">
                                <label className="cursor-pointer bg-white dark:bg-slate-800 text-brand-600 text-xs font-bold flex items-center justify-center gap-1 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded p-2 text-center h-full">
                                    <Upload className="h-3 w-3" /> Upload File
                                    <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload} />
                                </label>
                                
                                <div className="flex gap-1">
                                    <input 
                                        type="text" 
                                        placeholder="Add Image URL..."
                                        className="w-full text-xs p-2 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900"
                                        value={mediaLibUrlInput}
                                        onChange={(e) => setMediaLibUrlInput(e.target.value)}
                                    />
                                    <button 
                                        onClick={handleMediaUrlUpload}
                                        className="bg-brand-600 text-white p-2 rounded hover:bg-brand-700"
                                    >
                                        <Plus className="h-3 w-3" />
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-4 md:grid-cols-6 gap-2 max-h-48 overflow-y-auto">
                            {mediaLibrary.map(item => (
                                <div key={item.id} className="relative group aspect-square cursor-pointer border rounded overflow-hidden" onClick={() => selectImage(item.data)}>
                                    <img src={item.data} alt="lib" className="w-full h-full object-cover hover:scale-110 transition-transform" />
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); deleteFromLibrary(item.id); }}
                                        className="absolute top-0 right-0 bg-red-600 text-white p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                        <X className="h-3 w-3" />
                                    </button>
                                </div>
                            ))}
                            {mediaLibrary.length === 0 && <p className="col-span-full text-xs text-slate-500 italic">No images in library. Add one above.</p>}
                        </div>
                    </div>
                 )}
               </div>
               
               <div className="flex gap-6 items-center md:col-span-2 pt-4">
                 <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                        type="checkbox" 
                        checked={formData.isPublished} 
                        onChange={e => setFormData({...formData, isPublished: e.target.checked})}
                        className="w-4 h-4"
                    />
                    <span className="font-medium">Publish Project</span>
                 </label>
                 <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                        type="checkbox" 
                        checked={formData.isFeatured} 
                        onChange={e => setFormData({...formData, isFeatured: e.target.checked})}
                        className="w-4 h-4"
                    />
                    <span className="font-medium">Feature on Home</span>
                 </label>
               </div>
            </div>
            
            <div className="mt-8 flex justify-end gap-3">
                <button onClick={() => setIsAdding(false)} className="px-6 py-2 rounded text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">Cancel</button>
                <button onClick={handleSaveProject} disabled={isSaving} className="bg-brand-600 text-white px-6 py-2 rounded font-bold hover:bg-brand-700 flex items-center gap-2 disabled:opacity-50">
                    <Save className="h-4 w-4" /> {isSaving ? 'Saving...' : 'Save Project'}
                </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Admin;
