import React from 'react';
import { GenericCRUD } from './GenericCRUD';

export default function SolutionsSection() {
  return <div className="adm-card" style={{ padding: '1.25rem' }}>
    <div className="adm-card-title">Solutions</div>
    <div className="adm-card-sub">Solutions are currently sourced from the legacy Firebase dataset for the public site. Neon-based CRUD is on the roadmap — the schema is in place and this editor will be enabled once migration is complete.</div>
  </div>;
}
