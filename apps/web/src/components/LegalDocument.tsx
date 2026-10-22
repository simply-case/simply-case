import Link from "next/link";
import { Card } from "@/components/ui";
import { getLegalDocument, type LegalBlock, type LegalDocId, type LegalInline } from "@mycasepro/shared";

/**
 * Renders a legal document from the shared content in
 * packages/shared/src/legal.ts — the same source the mobile app renders
 * natively, so the website and the app can't drift apart.
 *
 * The text itself lives in that shared module, NOT here. This file is only
 * the web presentation of it.
 */
export function LegalDocument({ id }: { id: LegalDocId }) {
  const document = getLegalDocument(id);

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <Link
        href="/"
        className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] rounded"
      >
        ← Simply Case
      </Link>

      <h1 className="mt-4 text-2xl font-semibold text-[var(--color-text)]">{document.title}</h1>
      <p className="mt-1 text-sm text-[var(--color-text-muted)]">
        Last updated: {document.lastUpdated}
      </p>

      <Card className="mt-6 flex flex-col gap-4 text-sm leading-relaxed text-[var(--color-text)]">
        {document.sections.map((section) => (
          <section key={section.heading}>
            <h2 className="font-semibold">{section.heading}</h2>
            {section.blocks.map((block, i) => (
              <LegalBlockView key={i} block={block} />
            ))}
          </section>
        ))}
      </Card>
    </main>
  );
}

function LegalBlockView({ block }: { block: LegalBlock }) {
  if (block.kind === "list") {
    return (
      <ul className="mt-1 list-disc pl-5 text-[var(--color-text-muted)]">
        {block.items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    );
  }

  return (
    <p className="mt-1 text-[var(--color-text-muted)]">
      {block.content.map((inline, i) => (
        <LegalInlineView key={i} inline={inline} />
      ))}
    </p>
  );
}

function LegalInlineView({ inline }: { inline: LegalInline }) {
  if (typeof inline === "string") return <>{inline}</>;

  return (
    <Link href={`/legal/${inline.doc}`} className="underline">
      {inline.text}
    </Link>
  );
}
