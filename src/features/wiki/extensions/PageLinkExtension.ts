import { Node, mergeAttributes } from "@tiptap/core";

export interface PageLinkOptions {
  HTMLAttributes: Record<string, unknown>;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    pageLink: {
      insertPageLink: (id: number, title: string) => ReturnType;
    };
  }
}

export const PageLinkExtension = Node.create<PageLinkOptions>({
  name: "pageLink",
  group: "inline",
  inline: true,
  selectable: true,
  atom: true,

  addOptions() {
    return { HTMLAttributes: {} };
  },

  addAttributes() {
    return {
      id:    { default: null },
      title: { default: "" },
    };
  },

  parseHTML() {
    return [{ tag: "span[data-page-id]" }];
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        "data-page-id": node.attrs.id,
        class: "page-link-chip",
        contenteditable: "false",
        title: `Wiki: ${node.attrs.title}`,
      }),
      `📄 ${node.attrs.title}`,
    ];
  },

  addCommands() {
    return {
      insertPageLink:
        (id: number, title: string) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: { id, title },
          });
        },
    };
  },
});
