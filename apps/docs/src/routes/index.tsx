import { DocsPrototype, type DocsVariant } from "#/components/prototype/docs-prototype.tsx";
import { createFileRoute } from "@tanstack/react-router";

const docsVariants: DocsVariant[] = ["journey", "ownership", "surface"];

export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown>): { variant: DocsVariant } => ({
    variant: docsVariants.includes(search.variant as DocsVariant)
      ? (search.variant as DocsVariant)
      : "journey",
  }),
  component: Home,
});

function Home() {
  const { variant } = Route.useSearch();
  return <DocsPrototype variant={variant} />;
}
