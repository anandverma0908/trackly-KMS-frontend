import { Node, mergeAttributes } from "@tiptap/core";

export interface TicketLinkOptions {
  HTMLAttributes: Record<string, unknown>;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    ticketLink: {
      insertTicketLink: (key: string, summary?: string) => ReturnType;
    };
  }
}

export const TicketLinkExtension = Node.create<TicketLinkOptions>({
  name: "ticketLink",
  group: "inline",
  inline: true,
  selectable: true,
  atom: true,

  addOptions() {
    return { HTMLAttributes: {} };
  },

  addAttributes() {
    return {
      key:     { default: null },
      summary: { default: "" },
    };
  },

  parseHTML() {
    return [{ tag: "span[data-ticket-key]" }];
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        "data-ticket-key": node.attrs.key,
        class: "ticket-link-chip",
        contenteditable: "false",
        title: node.attrs.summary || node.attrs.key,
      }),
      `🎫 ${node.attrs.key}`,
    ];
  },

  addCommands() {
    return {
      insertTicketLink:
        (key: string, summary?: string) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: { key, summary: summary ?? "" },
          });
        },
    };
  },
});
