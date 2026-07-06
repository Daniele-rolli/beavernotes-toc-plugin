import type { BeaverNotes } from '@beaver-notes/plugin-sdk';

export function setup(beaverNotes: BeaverNotes) {
  const { editor, ui } = beaverNotes;
  if (!editor) return;

  const tiptap = editor.tiptap as any;
  const { Node, VueNodeViewRenderer, h, NodeViewWrapper } = tiptap;

  interface Heading {
    level: number;
    text: string;
    id: string;
    pos: number;
  }

  function getHeadings(doc: any): Heading[] {
    const headings: Heading[] = [];
    doc.descendants((node: any, pos: number) => {
      if (node.type.name === 'heading') {
        const text = node.textContent || '';
        if (text.trim()) {
          headings.push({
            level: node.attrs.level || 1,
            text: text.trim(),
            id: 'h-' + headings.length,
            pos,
          });
        }
      }
    });
    return headings;
  }

  function scrollToHeading(editorInstance: any, pos: number) {
    try {
      editorInstance.chain().setTextSelection(pos).scrollIntoView().run();
    } catch { /* ignore */ }
  }

  function buildTocVNodes(list: Heading[], editorInstance: any) {
    const indent = (level: number) => `ml-${Math.min((level - 1) * 4, 16)}`;

    return list.map((heading) => {
      const prefix =
        heading.level === 1 ? '1.' :
        heading.level === 2 ? '1.1.' :
        heading.level === 3 ? '1.1.1.' :
        heading.level === 4 ? '\u2219' :
        heading.level === 5 ? '\u2013' : '\u00B7';

      return h(
        'div',
        {
          key: heading.id,
          class: `flex items-start py-1 px-2 rounded-md cursor-pointer transition-colors group ${indent(heading.level)}`,
          onClick: () => scrollToHeading(editorInstance, heading.pos + 1),
        },
        [
          h(
            'span',
            {
              class:
                'text-xs font-mono text-neutral-400 dark:text-neutral-600 w-12 shrink-0 pt-[2px] select-none',
            },
            prefix
          ),
          h(
            'span',
            {
              class:
                'text-sm text-neutral-600 dark:text-neutral-300 group-hover:text-primary transition-colors leading-5',
            },
            heading.text
          ),
        ]
      );
    });
  }

  const TocBlockView = {
    props: {
      node: { type: Object, required: true },
      updateAttributes: { type: Function, required: true },
      editor: { type: Object, required: true },
      getPos: { type: [Function, Boolean] as any, default: false },
      deleteNode: { type: Function, required: true },
    },

    render(this: any) {
      const ed = this.editor;
      const list = getHeadings(ed.state.doc);
      const count = list.length;

      if (count === 0) {
        return h(
          NodeViewWrapper,
          { as: 'div', class: 'my-2' },
          {
            default: () => [
              h('div', {
                class:
                  'overflow-x-auto max-w-full border bg-neutral-50 dark:bg-neutral-900 p-4 rounded-lg min-h-20 flex flex-col items-center justify-center gap-2 text-neutral-400',
              }, [
                h(
                  'svg',
                  {
                    class: 'h-6 w-6',
                    xmlns: 'http://www.w3.org/2000/svg',
                    viewBox: '0 0 24 24',
                    fill: 'currentColor',
                  },
                  [h('path', { d: 'M5 4v3h5.5v12h3V7H19V4z' })]
                ),
                h('span', { class: 'text-xs' }, 'No headings found'),
                h(
                  'span',
                  { class: 'text-[11px] text-neutral-400/60' },
                  'Add headings to your note to see them here'
                ),
              ]),
            ],
          }
        );
      }

      return h(
        NodeViewWrapper,
        { as: 'div', class: 'my-2' },
        {
          default: () => [
            h('div', { class: 'overflow-x-auto max-w-full border rounded-lg' }, [
              h(
                'div',
                { class: 'bg-neutral-50 dark:bg-neutral-900 p-3 rounded-t-lg' },
                [
                  h('div', { class: 'flex items-center gap-2 mb-2' }, [
                    h(
                      'svg',
                      {
                        class: 'h-4 w-4 text-neutral-400',
                        xmlns: 'http://www.w3.org/2000/svg',
                        viewBox: '0 0 24 24',
                        fill: 'currentColor',
                      },
                      [h('path', { d: 'M5 4v3h5.5v12h3V7H19V4z' })]
                    ),
                    h(
                      'span',
                      {
                        class:
                          'text-xs font-semibold text-neutral-500 uppercase tracking-wider',
                      },
                      'Contents'
                    ),
                  ]),
                  h('div', { class: 'space-y-0' }, buildTocVNodes(list, ed)),
                ]
              ),
              h(
                'div',
                {
                  class:
                    'flex p-2 border-t rounded-b-lg items-center justify-between bg-neutral-100 dark:bg-neutral-800/70',
                },
                [
                  h(
                    'span',
                    { class: 'text-xs text-neutral-500' },
                    `${count} heading${count !== 1 ? 's' : ''}`
                  ),
                ]
              ),
            ]),
          ],
        }
      );
    },
  };

  editor.registerExtension(
    Node.create({
      name: 'tocBlock',
      group: 'block',
      atom: true,
      selectable: false,
      isolating: true,
      addCommands() {
        return {
          insertToc:
            () =>
            ({ commands }: any) =>
              commands.insertContent({ type: 'tocBlock' }),
        } as any;
      },
      parseHTML() {
        return [{ tag: 'div[data-toc-block]' }];
      },
      renderHTML({ HTMLAttributes }: any) {
        return ['div', { 'data-toc-block': '' }];
      },
      addNodeView() {
        return VueNodeViewRenderer(TocBlockView as any);
      },
    } as any)
  );

  editor.registerSlashCommand({
    name: 'Table of Contents',
    icon: 'riListOrdered',
    description: 'Insert a table of contents from document headings',
    action: (ed: any) => {
      ed.chain().focus().insertContent({ type: 'tocBlock' }).run();
    },
  });
}
