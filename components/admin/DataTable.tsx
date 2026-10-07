import React from 'react';
import { Pencil, Trash2, Plus, Search, PackageOpen } from 'lucide-react';
import { Button, EmptyState, SkeletonLine, StatusBadge } from './UI';

export interface Column<T> {
  key: string;
  label: string;
  className?: string;
  render: (row: T) => React.ReactNode;
  hideOnMobile?: boolean;
}
interface Props<T extends { id: string }> {
  title: string;
  description?: string;
  items: T[] | null;
  columns: Column<T>[];
  searchable?: boolean;
  searchPlaceholder?: string;
  searchValue?: string;
  onSearchChange?: (v: string) => void;
  actions?: React.ReactNode;
  onAdd?: () => void;
  addLabel?: string;
  onEdit?: (row: T) => void;
  onDelete?: (row: T) => void;
  emptyTitle?: string;
  emptyBody?: string;
  emptyIcon?: React.ElementType;
  filter?: React.ReactNode;
}
export default function DataTable<T extends { id: string }>(props: Props<T>) {
  const { title, description, items, columns, searchable, searchPlaceholder, searchValue, onSearchChange,
    actions, onAdd, addLabel = 'Add new', onEdit, onDelete, emptyTitle, emptyBody, emptyIcon, filter } = props;
  const loading = items === null;
  return (
    <div className="adm-card" style={{ padding: 0 }}>
      <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--line)' }}>
        <div className="adm-flex-between" style={{ flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <div className="adm-card-title" style={{ marginBottom: 0 }}>{title}</div>
            {description && <div className="adm-card-sub" style={{ marginBottom: 0 }}>{description}</div>}
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {actions}
            {onAdd && <Button variant="primary" size="sm" icon={<Plus size={14}/>} onClick={onAdd}>{addLabel}</Button>}
          </div>
        </div>
        {(searchable || filter) && (
          <div className="adm-toolbar" style={{ marginTop: '0.85rem', marginBottom: 0 }}>
            {searchable && (
              <div className="adm-input-wrap">
                <Search className="adm-input-icon" size={16}/>
                <input className="adm-input" placeholder={searchPlaceholder || 'Search…'}
                  value={searchValue || ''} onChange={e => onSearchChange?.(e.target.value)}/>
              </div>
            )}
            {filter}
          </div>
        )}
      </div>
      {loading ? (
        <div style={{ padding: '1.25rem' }}>
          <SkeletonLine width="30%"/><SkeletonLine/>
          <SkeletonLine width="70%"/><SkeletonLine/>
          <SkeletonLine width="50%"/>
        </div>
      ) : items && items.length === 0 ? (
        <div style={{ padding: '2rem 1.25rem' }}>
          <EmptyState
            icon={emptyIcon || PackageOpen}
            title={emptyTitle || `No items yet`}
            body={emptyBody || `Add your first entry to get started.`}
            action={onAdd ? <Button variant="primary" icon={<Plus size={14}/>} onClick={onAdd}>{addLabel}</Button> : null}
          />
        </div>
      ) : (
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead>
              <tr>
                {columns.map(c => <th key={c.key} className={c.className}>{c.label}</th>)}
                {(onEdit || onDelete) && <th style={{ textAlign: 'right' }}>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {items!.map(row => (
                <tr key={row.id}>
                  {columns.map(c => (
                    <td key={c.key} className={c.className}>
                      <span className="adm-table-mobile-label">{c.label}</span>
                      {c.render(row)}
                    </td>
                  ))}
                  {(onEdit || onDelete) && (
                    <td className="adm-row-actions">
                      <span className="adm-table-mobile-label">Actions</span>
                      {onEdit && <button className="adm-btn adm-btn-ghost adm-btn-icon adm-btn-sm" onClick={() => onEdit(row)} title="Edit"><Pencil size={14}/></button>}
                      {onDelete && <button className="adm-btn adm-btn-ghost adm-btn-icon adm-btn-sm" onClick={() => onDelete(row)} title="Delete"><Trash2 size={14}/></button>}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// Reusable column renderer helpers
export function TitleCell({ title, sub }: { title: string; sub?: React.ReactNode }) {
  return (
    <div>
      <div className="adm-table-title">{title}</div>
      {sub && <div className="adm-table-sub">{sub}</div>}
    </div>
  );
}
export function BadgeCell({ children }: { children: React.ReactNode }) {
  return <span className="adm-badge">{children}</span>;
}
export function StatusCell({ status }: { status: string }) {
  return <StatusBadge status={status}/>;
}
