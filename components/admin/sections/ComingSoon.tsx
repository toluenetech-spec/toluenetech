import React from 'react';
import { Wrench, FlaskConical, MessageSquare, Receipt, Sparkles, PackageOpen, Construction } from 'lucide-react';
import { EmptyState } from '../UI';

const ICONS: Record<string, React.ElementType> = {
  FlaskConical, MessageSquare, Receipt, Wrench, Sparkles, PackageOpen,
};
interface Props { title: string; subtitle?: string; icon?: string | React.ElementType; }
export default function ComingSoon({ title, subtitle, icon }: Props) {
  const Icon = (typeof icon === 'string' ? ICONS[icon] : icon) || Construction;
  return (
    <div className="adm-card" style={{ padding: '3rem 1.5rem' }}>
      <EmptyState
        icon={Icon}
        title={title}
        body={subtitle || 'This section is planned and coming soon.'}
      />
    </div>
  );
}
