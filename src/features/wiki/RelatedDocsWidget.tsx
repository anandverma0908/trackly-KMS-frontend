import { useQuery } from "@tanstack/react-query";
import { fetchRelatedDocs } from "@/services/api";
import type { RelatedDoc } from "@/types";
import styles from "./RelatedDocsWidget.module.css";

interface Props {
  pageId:   string;
  onSelect: (id: string) => void;
}

export default function RelatedDocsWidget({ pageId, onSelect }: Props) {
  const { data: rawDocs = [], isLoading } = useQuery({
    queryKey: ["related-docs", pageId],
    queryFn:  () => fetchRelatedDocs("wiki", pageId),
    enabled:  !!pageId,
    staleTime: 1000 * 60 * 5,
  });

  const docs: RelatedDoc[] = rawDocs as RelatedDoc[];

  if (isLoading) {
    return (
      <div className={styles.widget}>
        <div className={styles.title}>Related Docs</div>
        <div className={styles.loading}>
          <span className={styles.loadingDot} />
          <span className={styles.loadingDot} />
          <span className={styles.loadingDot} />
        </div>
      </div>
    );
  }

  if (docs.length === 0) return null;

  return (
    <div className={styles.widget}>
      <div className={styles.title}>
        <span className={styles.novaIcon}>✦</span> Related Docs
      </div>
      <div className={styles.list}>
        {docs.map((doc) => (
          <button
            key={doc.id}
            className={styles.item}
            onClick={() => doc.type === "wiki" && onSelect(doc.id)}
          >
            <span className={styles.itemIcon}>
              {doc.type === "wiki" ? "📄" : "🎫"}
            </span>
            <span className={styles.itemBody}>
              <span className={styles.itemTitle}>{doc.title}</span>
              {doc.key && (
                <span className={styles.itemSnippet}>{doc.key}</span>
              )}
            </span>
            <span className={styles.itemScore}>
              {Math.round(doc.similarity * 100)}%
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
