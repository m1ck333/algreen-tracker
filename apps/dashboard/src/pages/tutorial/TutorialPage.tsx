import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Typography, theme, Grid } from 'antd';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSlug from 'rehype-slug';
import { useTranslation } from '@alblue/i18n';
import tutorialSr from './TUTORIAL.sr.md?raw';
import tutorialEn from './TUTORIAL.en.md?raw';

const { Title, Paragraph, Text } = Typography;
const { useBreakpoint } = Grid;

// One TOC entry — H2 (top-level) carries an optional list of H3 children.
type TocEntry = { id: string; text: string; level: 2 | 3 };
type TocTree = Array<TocEntry & { children: TocEntry[] }>;

export function TutorialPage() {
  const { t, i18n } = useTranslation('dashboard');
  const { token } = theme.useToken();
  const screens = useBreakpoint();
  const showSideToc = !!screens.lg;

  const content = i18n.language === 'en' ? tutorialEn : tutorialSr;

  // TOC tree derived from rendered H2/H3s after the markdown mounts.
  const [tocTree, setTocTree] = useState<TocTree>([]);
  // Track which section is currently in view and highlight it in the side TOC.
  // rootMargin keeps the "active band" near the top of the viewport — a section
  // becomes active when its heading scrolls past the top quarter, deactivates
  // when it scrolls past the bottom half.
  const [activeId, setActiveId] = useState<string>('');
  // While a click-driven smooth scroll is in flight, ignore intersection events
  // so the highlight doesn't flicker through every intermediate section.
  const suppressObserverUntil = useRef(0);

  // The dashboard renders inside a nested overflow:auto container, so plain
  // hash navigation (browser default) won't scroll the right element into view.
  // Find the heading by id and call scrollIntoView on it.
  const scrollToId = useCallback((id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    setActiveId(id);
    // Long-distance smooth scrolls can take 1.5–2s — keep the observer quiet
    // until either `scrollend` fires (modern browsers) or this ceiling lapses.
    suppressObserverUntil.current = Date.now() + 3000;
    // scrollend doesn't bubble, so listen in capture phase.
    const onScrollEnd = () => {
      suppressObserverUntil.current = 0;
      document.removeEventListener('scrollend', onScrollEnd, true);
    };
    document.addEventListener('scrollend', onScrollEnd, true);
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  // Build the TOC by scanning the rendered headings. Our component overrides
  // visually offset levels by 1 (markdown # renders as antd Title level={2} → DOM
  // <h2>, ## → <h3>, ### → <h4>) for visual hierarchy. So DOM <h3> = markdown
  // section (##), DOM <h4> = markdown subsection (###). Filter accordingly so
  // the page H1 ("Korisničko uputstvo") doesn't pollute the TOC.
  useEffect(() => {
    const body = document.querySelector('.md-body');
    if (!body) return;
    const all = Array.from(body.querySelectorAll<HTMLElement>('[id]'))
      .filter((el) => el.tagName === 'H3' || el.tagName === 'H4');
    const tree: TocTree = [];
    for (const el of all) {
      const text = el.textContent || el.id;
      if (el.tagName === 'H3') {
        tree.push({ id: el.id, text, level: 2, children: [] });
      } else if (el.tagName === 'H4' && tree.length > 0) {
        tree[tree.length - 1].children.push({ id: el.id, text, level: 3 });
      }
    }
    setTocTree(tree);
    if (tree.length > 0 && !activeId) setActiveId(tree[0].id);
  }, [content]); // content is static, runs once

  useEffect(() => {
    if (!showSideToc || tocTree.length === 0) return;
    const ids: string[] = [];
    for (const top of tocTree) {
      ids.push(top.id);
      for (const child of top.children) ids.push(child.id);
    }
    const elements = ids
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);
    if (elements.length === 0) return;

    const obs = new IntersectionObserver(
      (entries) => {
        if (Date.now() < suppressObserverUntil.current) return;
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible.length > 0) {
          setActiveId(visible[0].target.id);
        }
      },
      { rootMargin: '-80px 0px -50% 0px', threshold: 0 },
    );
    elements.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, [showSideToc, tocTree]);

  const components = useMemo(
    () => ({
      h1: (p: React.ComponentProps<'h1'>) => <Title level={2} {...p} />,
      h2: (p: React.ComponentProps<'h2'>) => <Title level={3} style={{ marginTop: 32 }} {...p} />,
      h3: (p: React.ComponentProps<'h3'>) => <Title level={4} style={{ marginTop: 24 }} {...p} />,
      h4: (p: React.ComponentProps<'h4'>) => <Title level={5} style={{ marginTop: 16 }} {...p} />,
      p: (p: React.ComponentProps<'p'>) => <Paragraph {...p} />,
      ul: (p: React.ComponentProps<'ul'>) => <ul style={{ paddingLeft: 24 }} {...p} />,
      ol: (p: React.ComponentProps<'ol'>) => <ol style={{ paddingLeft: 24 }} {...p} />,
      li: (p: React.ComponentProps<'li'>) => <li style={{ marginBottom: 4 }} {...p} />,
      code: (p: React.ComponentProps<'code'>) => (
        <Text code style={{ background: token.colorFillTertiary, padding: '0 4px' }} {...p} />
      ),
      blockquote: (p: React.ComponentProps<'blockquote'>) => (
        <blockquote
          style={{
            borderLeft: `4px solid ${token.colorPrimary}`,
            background: token.colorFillTertiary,
            margin: '12px 0',
            padding: '8px 16px',
            color: token.colorTextSecondary,
          }}
          {...p}
        />
      ),
      table: (p: React.ComponentProps<'table'>) => (
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            margin: '12px 0',
            border: `1px solid ${token.colorBorderSecondary}`,
          }}
          {...p}
        />
      ),
      th: (p: React.ComponentProps<'th'>) => (
        <th
          style={{
            border: `1px solid ${token.colorBorderSecondary}`,
            padding: '8px 12px',
            textAlign: 'left',
            background: token.colorFillTertiary,
          }}
          {...p}
        />
      ),
      td: (p: React.ComponentProps<'td'>) => (
        <td
          style={{
            border: `1px solid ${token.colorBorderSecondary}`,
            padding: '8px 12px',
            verticalAlign: 'top',
          }}
          {...p}
        />
      ),
      hr: () => <div style={{ height: 1, background: token.colorBorderSecondary, margin: '24px 0' }} />,
      a: ({ href, children, ...rest }: React.ComponentProps<'a'>) => {
        // Intercept in-page anchor links — the dashboard's nested scroll
        // container means browser hash navigation does nothing.
        if (href && href.startsWith('#')) {
          return (
            <a
              href={href}
              style={{ color: token.colorLink }}
              onClick={(e) => {
                e.preventDefault();
                scrollToId(href.slice(1));
              }}
              {...rest}
            >
              {children}
            </a>
          );
        }
        return <a href={href} style={{ color: token.colorLink }} {...rest}>{children}</a>;
      },
    }),
    [token, scrollToId],
  );

  return (
    <div
      style={{
        // Fill the dashboard's content area exactly. Both panels are bounded
        // and each scrolls internally — the outer area never scrolls, so the
        // cards' top AND bottom edges are always visible.
        height: '100%',
        maxWidth: 1200,
        margin: '0 auto',
        padding: 24,
        display: 'flex',
        gap: 24,
        overflow: 'hidden',
      }}
    >
      {/* Side TOC on lg+ screens — bounded height, internal scroll */}
      {showSideToc && (
        <aside style={{ width: 220, flexShrink: 0, display: 'flex', flexDirection: 'column' }}>
          <div
            style={{
              flex: 1,
              padding: 12,
              overflowY: 'auto',
              border: `1px solid ${token.colorBorderSecondary}`,
              borderRadius: 8,
              background: token.colorBgContainer,
            }}
          >
            <Text strong style={{ display: 'block', marginBottom: 8 }}>{t('tutorial.title')}</Text>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {tocTree.map((top) => {
                const topActive = activeId === top.id;
                return (
                  <li key={top.id} style={{ margin: '2px 0' }}>
                    <a
                      href={`#${top.id}`}
                      onClick={(e) => { e.preventDefault(); scrollToId(top.id); }}
                      style={{
                        color: topActive ? token.colorPrimary : token.colorText,
                        fontWeight: topActive ? 600 : 500,
                        fontSize: 13,
                        textDecoration: 'none',
                        display: 'block',
                        padding: '4px 8px',
                        borderRadius: 4,
                        borderLeft: `3px solid ${topActive ? token.colorPrimary : 'transparent'}`,
                        background: topActive ? token.colorPrimaryBg : 'transparent',
                        transition: 'background 0.15s, color 0.15s',
                      }}
                    >
                      {top.text}
                    </a>
                    {top.children.length > 0 && (
                      <ul style={{ listStyle: 'none', padding: 0, margin: '2px 0 4px 0' }}>
                        {top.children.map((child) => {
                          const childActive = activeId === child.id;
                          return (
                            <li key={child.id} style={{ margin: '1px 0' }}>
                              <a
                                href={`#${child.id}`}
                                onClick={(e) => { e.preventDefault(); scrollToId(child.id); }}
                                style={{
                                  color: childActive ? token.colorPrimary : token.colorTextSecondary,
                                  fontWeight: childActive ? 600 : 400,
                                  fontSize: 12,
                                  textDecoration: 'none',
                                  display: 'block',
                                  padding: '3px 8px 3px 20px',
                                  borderRadius: 4,
                                  borderLeft: `3px solid ${childActive ? token.colorPrimary : 'transparent'}`,
                                  background: childActive ? token.colorPrimaryBg : 'transparent',
                                  transition: 'background 0.15s, color 0.15s',
                                }}
                              >
                                {child.text}
                              </a>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        </aside>
      )}

      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        {/* Plain styled container instead of antd Card so we can put overflow
            directly on the body and have a clean fixed-height panel. */}
        <div
          style={{
            flex: 1,
            minHeight: 0,
            padding: 24,
            border: `1px solid ${token.colorBorderSecondary}`,
            borderRadius: 8,
            background: token.colorBgContainer,
            overflowY: 'auto',
          }}
        >
          <div style={{ color: token.colorText }} className="md-body">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeSlug]}
              components={components}
            >
              {content}
            </ReactMarkdown>
          </div>
        </div>
      </div>
    </div>
  );
}
