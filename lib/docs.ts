import fs from 'fs';
import path from 'path';

export interface DocMeta {
  id: string;
  title: string;
  updated: string;
  order: number;
  slug: string;
  file: string;
}

const docsDir = path.join(process.cwd(), 'content', 'docs');

export function getAllDocs(): DocMeta[] {
  const docsDir = path.join(process.cwd(), 'content', 'docs');
  
  if (!fs.existsSync(docsDir)) {
    return [];
  }
  
  const files = fs.readdirSync(docsDir).filter(f => f.endsWith('.mdx'));
  const metas: DocMeta[] = [];
  for (const file of files) {
    const full = fs.readFileSync(path.join(docsDir, file), 'utf8');
    const fm = /^---\r?\n([\s\S]*?)\r?\n---/.exec(full);
    if (!fm) continue;
    const block = fm[1];
    const meta: any = {};
    for (const line of block.split(/\n/)) {
      const m = /^([a-zA-Z0-9_]+):\s*(.*)$/.exec(line.trim());
      if (m) meta[m[1]] = m[2];
    }
    if (!meta.id) meta.id = file.replace(/\.mdx$/, '');
    metas.push({
      id: meta.id,
      title: meta.title || meta.id,
      updated: meta.updated || new Date().toISOString(),
      order: Number(meta.order || 999),
      slug: meta.id,
      file: path.join(docsDir, file)
    });
  }
  return metas.sort((a,b)=>a.order-b.order);
}

export function getDocBySlug(slug: string): { meta: DocMeta; content: string } | null {
  const all = getAllDocs();
  const target = all.find(d => d.slug === slug);
  if (!target) return null;
  const raw = fs.readFileSync(target.file, 'utf8');
  const body = raw.replace(/^---[\s\S]*?---/,'').trim();
  return { meta: target, content: body };
}
