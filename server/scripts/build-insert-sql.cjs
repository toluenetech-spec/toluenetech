// Build INSERT SQL from the Firestore JSON dump the user pasted.
// Input: JSON on stdin (the dump output). Output: SQL file on stdout.
const fs = require('fs');
const crypto = require('crypto');

const data = JSON.parse(fs.readFileSync('/dev/stdin', 'utf8'));

function slugify(s) { return String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,120); }
function esc(s) {
  if (s === null || s === undefined) return 'NULL';
  if (typeof s === 'boolean') return s ? 'true' : 'false';
  if (typeof s === 'number') return String(s);
  return "'" + String(s).replace(/'/g,"''").replace(/\\/g,'\\\\') + "'";
}
function ts(v, def='now()') { if (!v) return def; return esc(v); }
function j(v) { return esc(JSON.stringify(v===undefined?null:v)) + '::jsonb'; }

function insert(table, pkey, row) {
  const cols = Object.keys(row);
  const vals = cols.map(c => row[c]);
  const sets = cols.filter(c => c !== pkey).map(c => `"${c}"=EXCLUDED."${c}"`).join(', ');
  return `INSERT INTO "${table}" (${cols.map(c=>'"'+c+'"').join(',')}) VALUES (${vals.map(v=>{
    if (v === null || v === undefined) return 'NULL';
    if (v === '$$NOW$$') return 'now()';
    return v;
  }).join(',')}) ON CONFLICT ("${pkey}") DO UPDATE SET ${sets};`;
}

const sql = [];
sql.push('-- Firestore → Neon migration (15 docs total)');
sql.push('BEGIN;');

// ---- projects ----
// Schema: id, slug, title, client_name, client_logo, role, platform, framework,
// completion_date, status, cover_image, gallery, video_url, challenge, objective,
// solution, features, process, results, metrics, live_url, github_url, app_store_url,
// play_store_url, service_ids, is_published, is_featured, has_client_permission,
// order, seo_title, seo_description, seo_og_image, created_at, updated_at
const pMap = {
  '1767425713302': { order: 1 },
  '1767427372431': { order: 2 },
  '1768735590761': { order: 3 },
  '1769439477057': { order: 4 },
  '1769444335674': { order: 5 },
  '1769519668103': { order: 6 },
  '1770164118435': { order: 7 },
};
for (const [fid, d] of Object.entries(data.projects || {})) {
  const id = 'prj_' + fid;
  const slug = d.slug || slugify(d.title) || 'project-'+fid;
  const tools = Array.isArray(d.tools) ? d.tools : [];
  const framework = tools.find(t=>/React|Next|Vue|Angular|Svelte/i.test(t)) || null;
  const platform = d.category || null;
  const cover = d.imageUrl || null;
  const isVideo = cover && /\.(mp4|mov|webm)(\?|$)/i.test(cover);
  const coverImage = isVideo ? null : cover;
  const videoUrl = d.videoUrl || (isVideo ? cover : null);
  sql.push(insert('projects','id',{
    id: esc(id), slug: esc(slug), title: esc(d.title),
    client_name: null, client_logo: null, role: null,
    platform: esc(platform), framework: esc(framework),
    completion_date: 'NULL', status: "'COMPLETED'::project_status",
    cover_image: esc(coverImage), gallery: '[]::jsonb', video_url: esc(videoUrl),
    challenge: esc(d.clientProblem), objective: esc(d.shortDescription),
    solution: esc(d.solution), features: j(tools), process: '[]::jsonb',
    results: esc(d.outcome), metrics: '[]::jsonb',
    live_url: esc(d.liveUrl), github_url: 'NULL', app_store_url: 'NULL', play_store_url: 'NULL',
    service_ids: '[]::jsonb',
    is_published: d.isPublished === false ? 'false' : 'true',
    is_featured: d.isFeatured ? 'true' : 'false',
    has_client_permission: 'true',
    order: String(pMap[fid]?.order || 0),
    seo_title: esc(d.title), seo_description: esc(d.shortDescription), seo_og_image: esc(coverImage),
    created_at: '$$NOW$$', updated_at: '$$NOW$$',
  }));
}

// ---- leads ----
// Schema: id, ref, name, email, phone, company, services, requirements, budget,
// timeline, source, notes, status, follow_up_date, converted_client_id, created_at, updated_at
for (const [fid, d] of Object.entries(data.leads || {})) {
  const id = 'lead_' + fid;
  const ref = d.reference || 'MIG-'+fid.slice(-6).toUpperCase();
  sql.push(insert('leads','id',{
    id: esc(id), ref: esc(ref), name: esc(d.name), email: esc(d.email),
    phone: 'NULL', company: 'NULL',
    services: j(d.services||[]),
    requirements: esc(d.requirements), budget: esc(d.budget), timeline: esc(d.timeline),
    source: esc(d.source), notes: 'NULL',
    status: esc(String(d.status||'NEW').toUpperCase()) + '::lead_status',
    follow_up_date: 'NULL', converted_client_id: 'NULL',
    created_at: ts(d.createdAt), updated_at: ts(d.updatedAt||d.createdAt),
  }));
}

// ---- messages ----
// Note: message.context_id references client_projects (FK). The single existing
// message references "cp-demo-1" which doesn't exist in client_projects. To satisfy
// the FK we'll set context_id = NULL (it's nullable) and keep context_type='GENERAL'.
// After migrating we add the new columns (already added by 0004 migration).
for (const [fid, d] of Object.entries(data.messages || {})) {
  const id = d.id || 'msg_' + fid;
  const isFromClient = d.author === 'client';
  sql.push(insert('messages','id',{
    id: esc(id), context_type: "'GENERAL'::message_context", context_id: 'NULL',
    from_uid: isFromClient ? 'NULL' : esc(d.authorId||d.author),
    from_name: esc(d.authorName||(isFromClient?'Client':'Team')),
    body: esc(d.text||d.body||''),
    attachments: '[]::jsonb', is_read: 'false',
    to_uid: 'NULL', to_client_id: 'NULL', to_name: 'NULL', thread_id: 'NULL', read_at: 'NULL',
    is_from_client: isFromClient ? 'true' : 'false',
    created_at: ts(d.createdAt),
  }));
}

// ---- media ----
// Schema requires r2_key (unique), public_url, filename. The base64 one is too big
// to inline into SQL (>1MB); skip it (it's just an "External Image" blob without a
// meaningful filename). The 4 URL-based items are migrated as EXTERNAL media rows
// with a sentinel r2_key "external:<id>". Skip items where data starts with data: (base64).
let order = 0;
for (const [fid, d] of Object.entries(data.media || {})) {
  order++;
  const url = typeof d.data === 'string' && d.data.startsWith('http') ? d.data : null;
  if (!url) continue;
  const isVideo = /\.(mp4|mov|webm)(\?|$)/i.test(url);
  const mime = isVideo ? 'video/mp4' : (d.type || 'image/jpeg');
  sql.push(insert('media','id',{
    id: esc('med_'+fid),
    filename: esc(d.name||('media-'+fid)),
    r2_key: esc('external:'+fid),
    public_url: esc(url),
    mime_type: esc(mime),
    size_bytes: 'NULL', width: 'NULL', height: 'NULL',
    alt: esc(d.name), uploaded_by: 'NULL',
    created_at: '$$NOW$$',
    visibility: "'PUBLIC'::file_visibility", role: 'NULL', project_id: 'NULL', client_id: 'NULL',
  }));
}

// ---- settings → site_settings ----
// Schema: key (pk), value (jsonb), updated_at.
const g = (data.settings||{}).global || {};
const siteValue = {
  company: {
    name: 'Toluene Tech',
    email: (g.socialLinks||{}).email || 'toluenetech@gmail.com',
    whatsapp: (g.socialLinks||{}).whatsapp || null,
  },
  social: {
    email: (g.socialLinks||{}).email || null,
    whatsapp: (g.socialLinks||{}).whatsapp || null,
    twitter: (g.socialLinks||{}).twitter || null,
    facebook: (g.socialLinks||{}).facebook || null,
    instagram: (g.socialLinks||{}).instagram || null,
    linkedin: (g.socialLinks||{}).linkedin || null,
  },
  founderImage: g.founderImageData || null,
  brandProfile: g.brandProfileData || null,
  notification: g.siteNotification || null,
  migratedFrom: 'firestore/settings/global',
  migratedAt: new Date().toISOString(),
};
sql.push(insert('site_settings','key',{
  key: esc('site'),
  value: j(siteValue),
  updated_at: '$$NOW$$',
}));

sql.push('COMMIT;');
sql.push('');
console.log(sql.join('\n'));
