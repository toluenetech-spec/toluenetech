import React, { useState } from 'react';
import { useData } from '../../../../context/DataContext';
import { Button, useToast } from '../../UI';
import { Save } from 'lucide-react';

/** Reusable "save" bar for settings forms. */
export function SaveBar({ onSave, saving, dirty }: { onSave: () => void; saving?: boolean; dirty?: boolean }) {
  return (
    <div style={{ display:'flex', justifyContent:'flex-end', gap:'0.5rem', marginTop:'0.5rem' }}>
      <Button variant="primary" icon={<Save size={14}/>} onClick={onSave} disabled={saving || !dirty}>{saving?'Saving…':'Save changes'}</Button>
    </div>
  );
}

export function useSettingsGuard() {
  // Re-export useData for typed access.
  return useData();
}

export function TextField({ label, value, onChange, placeholder, type='text', help }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string; help?: string }) {
  return (
    <div className="adm-field">
      <label className="adm-label">{label}</label>
      <input className="adm-input" type={type} value={value || ''} placeholder={placeholder} onChange={e => onChange(e.target.value)}/>
      {help && <span className="adm-label-hint">{help}</span>}
    </div>
  );
}
export function TextArea({ label, value, onChange, rows = 4, placeholder }: { label: string; value: string; onChange: (v: string) => void; rows?: number; placeholder?: string }) {
  return (
    <div className="adm-field">
      <label className="adm-label">{label}</label>
      <textarea className="adm-textarea" rows={rows} value={value || ''} placeholder={placeholder} onChange={e => onChange(e.target.value)}/>
    </div>
  );
}
export function ToggleField({ label, checked, onChange, help }: { label: string; checked: boolean; onChange: (v: boolean) => void; help?: string }) {
  return (
    <div className="adm-flex-center" style={{ gap:'0.75rem' }}>
      <label className="adm-switch"><input type="checkbox" checked={!!checked} onChange={e => onChange(e.target.checked)}/><span className="adm-switch-slider"/></label>
      <div>
        <div style={{ fontSize:'0.88rem', fontWeight:500 }}>{label}</div>
        {help && <div className="adm-label-hint">{help}</div>}
      </div>
    </div>
  );
}
