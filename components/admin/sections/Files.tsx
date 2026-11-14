import React from 'react';
import { FileText } from 'lucide-react';
import { EmptyState } from '../UI';
import ProjectWorkspace from './ProjectWorkspace';
import { api } from '../../../lib/admin';

export default function FilesSection() {
  const [projectId, setProjectId] = React.useState<string | null>(null);
  const [projects, setProjects] = React.useState<any[] | null>(null);
  const [err, setErr] = React.useState<string | null>(null);

  React.useEffect(() => {
    api.clientProjects()
      .then(d => setProjects(d.items))
      .catch(e => setErr(e.message));
  }, []);
  React.useEffect(() => {
    if (projects && projects.length > 0 && !projectId) setProjectId(projects[0].id);
  }, [projects, projectId]);

  if (err) return <div style={{ padding: '1.5rem', color: '#dc2626' }}>Failed to load projects: {err}</div>;
  if (!projects || projectId === null) {
    return <div style={{ padding:'1.5rem' }}>
      <div className="adm-skel adm-skel-line"/><div className="adm-skel adm-skel-line w-2-3"/>
    </div>;
  }
  if (projects.length === 0) {
    return <EmptyState icon={FileText} title="No projects yet" body="Create a client project to manage files." />;
  }
  return <ProjectWorkspace projectId={projectId} onProjectChange={setProjectId} projects={projects} initialTab="files" />;
}
