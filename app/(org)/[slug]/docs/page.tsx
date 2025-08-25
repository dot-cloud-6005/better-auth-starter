import { getOrganizationBySlug } from '@/server/organizations';
import { getCurrentUser } from '@/server/users';
import { redirect } from 'next/navigation';
import { getAllDocs } from '@/lib/docs';
import ReactMarkdown from 'react-markdown';
import fs from 'fs';
import path from 'path';
import { Suspense } from 'react';
import { DocsSearch } from './search-input.client';
import { ScrollSpy } from './scroll-spy.client';

export const metadata = { title: 'User Guide' };

function formatDate(date: string) {
  try { return new Date(date).toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' }); } catch { return date; }
}

function DocSection({ file, meta }: { file: string; meta: { title: string; updated: string; slug: string } }) {
  const raw = fs.readFileSync(file, 'utf8');
  const body = raw.replace(/^---\r?\n[\s\S]*?\r?\n---/, '').trim();
  return (
    <section id={meta.slug} className="scroll-mt-24 space-y-6 pb-16 border-b border-border/30 last:border-b-0">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-2xl font-bold text-foreground">{meta.title}</h2>
        <span className="text-xs rounded-full bg-muted px-3 py-1 text-muted-foreground font-medium">
          Updated {formatDate(meta.updated)}
        </span>
      </div>
      <div className="max-w-none">
        <ReactMarkdown 
          components={{
            h2: ({ children }) => <h2 className="text-xl font-semibold text-foreground mt-8 mb-4 pb-2 border-b border-border/20">{children}</h2>,
            h3: ({ children }) => <h3 className="text-lg font-semibold text-foreground mt-6 mb-3">{children}</h3>,
            p: ({ children }) => <p className="text-foreground/90 leading-relaxed mb-4">{children}</p>,
            strong: ({ children }) => <strong className="text-foreground font-semibold">{children}</strong>,
            ul: ({ children }) => <ul className="space-y-2 ml-4 mb-4">{children}</ul>,
            ol: ({ children }) => <ol className="space-y-2 ml-4 mb-4 list-decimal list-inside">{children}</ol>,
            li: ({ children }) => <li className="text-foreground/90 relative pl-2 before:content-['•'] before:text-primary before:font-bold before:absolute before:-left-2 before:top-0">{children}</li>,
            code: ({ children }) => <code className="bg-muted/50 px-2 py-1 rounded text-sm font-mono text-foreground border">{children}</code>,
            blockquote: ({ children }) => <blockquote className="border-l-4 border-primary/20 bg-muted/30 pl-4 py-2 italic text-muted-foreground my-4">{children}</blockquote>,
            a: ({ children, href }) => <a href={href} className="text-primary hover:text-primary/80 underline underline-offset-2 transition-colors">{children}</a>
          }}
        >
          {body}
        </ReactMarkdown>
      </div>
    </section>
  );
}

export default async function DocsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const org = await getOrganizationBySlug(slug); if (!org) redirect('/landing');
  const { currentUser } = await getCurrentUser();
  const docs = getAllDocs();

  return (
    <div className="max-w-7xl mx-auto px-4 lg:px-8 py-10">
      <header className="mb-12 space-y-4">
        <nav className="text-xs text-muted-foreground flex gap-1 flex-wrap">
          <span>Home</span><span>/</span><span>{org.slug}</span><span>/</span><span className="text-foreground font-medium">Docs</span>
        </nav>
        <div className="space-y-3">
          <h1 className="text-4xl font-bold tracking-tight text-foreground">User Guide</h1>
          <p className="text-lg text-muted-foreground max-w-[70ch] leading-relaxed">
            Comprehensive, step‑by‑step help for using {org.name}. Written in Australian English for clarity and ease of use.
          </p>
        </div>
        <div className="pt-4">
          <DocsSearch />
        </div>
      </header>
      <div className="flex flex-col lg:flex-row gap-12">
        <aside className="lg:w-72 order-last lg:order-first space-y-6">
          <div className="sticky top-24">
            <div className="bg-muted/30 rounded-lg p-4 border border-border/50">
              <div className="uppercase tracking-wide text-xs text-muted-foreground font-semibold mb-4">Navigation</div>
              <ul className="space-y-1 text-sm" id="doc-toc">
                {docs.map((d, index) => (
                  <li key={d.slug}>
                    <a 
                      href={`#${d.slug}`} 
                      className="flex items-center gap-3 rounded-md px-3 py-2 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all duration-200 data-[active=true]:bg-primary/10 data-[active=true]:text-primary data-[active=true]:font-medium data-[active=true]:border-l-2 data-[active=true]:border-primary" 
                      data-slug={d.slug}
                      data-active={index === 0 ? "true" : "false"}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-60"></span>
                      <span className="truncate">{d.title}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </aside>
        <main className="flex-1 min-w-0" id="docs-content">
          <div className="space-y-0">
            {docs.map(d => (
              <DocSection key={d.slug} file={d.file} meta={d} />
            ))}
          </div>
          <footer className="pt-12 mt-12 border-t border-border/30 text-sm text-muted-foreground">
            <div className="flex items-center justify-between">
              <span>Signed in as <span className="font-medium text-foreground">{currentUser.email}</span></span>
              <span className="text-xs">Last updated: {formatDate(new Date().toISOString())}</span>
            </div>
          </footer>
        </main>
      </div>
      <ScrollSpy />
    </div>
  );
}
