import { Tree, TreeItem, TreeItemLabel } from "@/components/reui/tree";
import { buttonVariants } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  ArrowLeft01Icon,
  ArrowRight01Icon,
  CodeIcon,
  File02Icon,
  FileScriptIcon,
  FolderIcon,
  FolderOpenIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { hotkeysCoreFeature, syncDataLoaderFeature } from "@headless-tree/core";
import { useTree } from "@headless-tree/react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

export type DocsVariant = "journey" | "ownership" | "surface";

type StructureItem = {
  name: string;
  children?: string[];
  type?: "folder" | "page" | "code";
};

type VariantDefinition = {
  label: string;
  shortLabel: string;
  description: string;
  items: Record<string, StructureItem>;
};

const variants: Record<DocsVariant, VariantDefinition> = {
  journey: {
    label: "Journey first",
    shortLabel: "A",
    description: "Start with one secure upload-to-download path, then branch into alternatives.",
    items: {
      root: { name: "HVN Storage docs", children: ["start", "build", "deploy", "operate"] },
      start: {
        name: "Start here",
        type: "folder",
        children: ["overview", "quickstart", "boundaries"],
      },
      overview: { name: "How direct transfer works", type: "page" },
      quickstart: { name: "Promise + React + Node", type: "code" },
      boundaries: { name: "Who owns what", type: "page" },
      build: {
        name: "Build",
        type: "folder",
        children: ["authorization", "react", "vanilla", "effect"],
      },
      authorization: { name: "Authorize an Upload Route", type: "code" },
      react: { name: "Upload with React", type: "code" },
      vanilla: { name: "Use the browser client", type: "code" },
      effect: { name: "Compose with Effect", type: "code" },
      deploy: {
        name: "Deploy",
        type: "folder",
        children: ["node", "cloudflare", "providers"],
      },
      node: { name: "Node", type: "page" },
      cloudflare: { name: "Cloudflare Workers", type: "page" },
      providers: { name: "Storage providers", type: "page" },
      operate: {
        name: "Operate",
        type: "folder",
        children: ["migrations", "recovery"],
      },
      migrations: { name: "Run database migrations", type: "page" },
      recovery: { name: "Recover session state", type: "page" },
    },
  },
  ownership: {
    label: "Responsibility first",
    shortLabel: "B",
    description: "Make trust boundaries explicit before introducing APIs and runtimes.",
    items: {
      root: {
        name: "HVN Storage docs",
        children: ["application", "hvn", "infrastructure", "operations"],
      },
      application: {
        name: "Your application",
        type: "folder",
        children: ["auth", "business-data", "interface"],
      },
      auth: { name: "Authentication and authorization", type: "code" },
      "business-data": { name: "Input and metadata", type: "page" },
      interface: { name: "React or vanilla browser", type: "code" },
      hvn: {
        name: "HVN Storage",
        type: "folder",
        children: ["protocol", "lifecycle", "verification"],
      },
      protocol: { name: "HTTP protocol", type: "page" },
      lifecycle: { name: "Sessions and file records", type: "page" },
      verification: { name: "Completion verification", type: "page" },
      infrastructure: {
        name: "Infrastructure",
        type: "folder",
        children: ["runtime", "database", "storage"],
      },
      runtime: { name: "Node or Cloudflare", type: "code" },
      database: { name: "Postgres connectivity", type: "page" },
      storage: { name: "S3-compatible provider", type: "page" },
      operations: {
        name: "Operations",
        type: "folder",
        children: ["migrations", "secrets", "reconciliation"],
      },
      migrations: { name: "Migrations", type: "page" },
      secrets: { name: "Credentials and capabilities", type: "page" },
      reconciliation: { name: "Recovery and reconciliation", type: "page" },
    },
  },
  surface: {
    label: "API and runtime first",
    shortLabel: "C",
    description: "Let experienced developers enter through the surface they already chose.",
    items: {
      root: {
        name: "HVN Storage docs",
        children: ["promise", "effect", "browser", "runtime", "reference"],
      },
      promise: {
        name: "Promise-first",
        type: "folder",
        children: ["promise-server", "promise-client"],
      },
      "promise-server": { name: "Server routes and handlers", type: "code" },
      "promise-client": { name: "Storage client", type: "code" },
      effect: {
        name: "Effect-native",
        type: "folder",
        children: ["effect-server", "effect-client"],
      },
      "effect-server": { name: "Services and Layers", type: "code" },
      "effect-client": { name: "Scoped browser client", type: "code" },
      browser: {
        name: "Browser bindings",
        type: "folder",
        children: ["react", "vanilla"],
      },
      react: { name: "React", type: "code" },
      vanilla: { name: "Vanilla browser", type: "code" },
      runtime: {
        name: "Runtime adapters",
        type: "folder",
        children: ["node", "cloudflare"],
      },
      node: { name: "Node + pg", type: "page" },
      cloudflare: { name: "Cloudflare + edge Postgres", type: "page" },
      reference: { name: "Contracts and errors", type: "folder", children: ["errors", "types"] },
      errors: { name: "Error algebra", type: "page" },
      types: { name: "Public types", type: "page" },
    },
  },
};

const exampleFiles: Record<string, StructureItem> = {
  root: { name: "document-intake", children: ["app", "server", "deploy", "package"] },
  app: { name: "app", type: "folder", children: ["upload", "contract"] },
  upload: { name: "upload-documents.tsx", type: "code" },
  contract: { name: "storage-contract.ts", type: "code" },
  server: { name: "server", type: "folder", children: ["routes", "handler"] },
  routes: { name: "upload-routes.ts", type: "code" },
  handler: { name: "storage-handler.ts", type: "code" },
  deploy: { name: "deploy", type: "folder", children: ["node", "cloudflare"] },
  node: { name: "node.ts", type: "code" },
  cloudflare: { name: "cloudflare.ts", type: "code" },
  package: { name: "package.json", type: "page" },
};

const codeSamples = {
  promise: `const uploadRoutes = createUploadRoutes({
  documents: uploadRoute({
    input: DocumentInput,
    authorizeUpload: async ({ input, files, allow }) =>
      allow({ sessionMetadata: { caseId: input.caseId }, files }),
    authorizeOperation: async ({ operation, user, allow }) =>
      user.can(operation) ? allow() : accessDenied(),
  }),
})

export const handleStorage = createStorageHandler({
  routes: uploadRoutes,
  persistence,
  storage,
})`,
  react: `const { useStorage } = createStorageHooks<AppStorage>()

function DocumentIntake() {
  const storage = useStorage("documents")

  return <button onClick={() => storage.upload({
    input: { caseId },
    files: selectedFiles,
  })}>Upload documents</button>
}`,
  effect: `const uploadRoutes = createEffectUploadRoutes({
  documents: effectUploadRoute({
    input: DocumentInput,
    authorizeUpload: ({ input, files, allow }) =>
      Effect.gen(function* () {
        const cases = yield* Cases
        yield* cases.requireEditor(input.caseId)
        return allow({ sessionMetadata: { caseId: input.caseId }, files })
      }),
  }),
})`,
  cloudflare: `export default {
  fetch: createEffectStorageHandler({ routes: uploadRoutes }).pipe(
    Effect.provide(HyperdrivePersistence),
    Effect.provide(DigitalOceanSpaces),
    Effect.runPromise,
  ),
} satisfies ExportedHandler<Env>`,
};

const responsibilities = [
  {
    owner: "Application",
    verb: "decides",
    detail: "Identity, authorization, route input, metadata, and user experience.",
  },
  {
    owner: "HVN Storage",
    verb: "coordinates",
    detail: "Sessions, capabilities, transfer lifecycle, verification, and typed outcomes.",
  },
  {
    owner: "Infrastructure",
    verb: "hosts",
    detail: "Node or Worker runtime, Postgres connectivity, bucket policy, CORS, and credentials.",
  },
  {
    owner: "Operations",
    verb: "maintains",
    detail: "Migrations, secret rotation, compatibility, recovery, and reconciliation.",
  },
];

export function DocsPrototype({ variant }: { variant: DocsVariant }) {
  return (
    <main className="overflow-hidden pb-28">
      {variant === "journey" ? <JourneyVariant /> : null}
      {variant === "ownership" ? <OwnershipVariant /> : null}
      {variant === "surface" ? <SurfaceVariant /> : null}
      <PrototypeSwitcher variant={variant} />
    </main>
  );
}

function JourneyVariant() {
  return (
    <>
      <section className="border-b">
        <div className="container container-padding-x mx-auto grid min-h-[38rem] items-center gap-14 py-20 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="max-w-2xl">
            <PrototypeEyebrow>Journey-first documentation</PrototypeEyebrow>
            <h1 className="heading-xl mt-6 max-w-xl">
              Move bytes directly. Keep authority in your application.
            </h1>
            <p className="mt-7 max-w-xl text-lg leading-8 text-muted-foreground">
              HVN Storage gives TypeScript applications a verified browser-to-S3 upload path without
              turning storage credentials or authorization decisions over to the browser.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link
                className={buttonVariants({ size: "lg" })}
                to="/docs/$"
                params={{ _splat: "quickstart" }}
              >
                Build the first upload
                <HugeiconsIcon icon={ArrowRight01Icon} />
              </Link>
              <Link
                className={buttonVariants({ variant: "outline", size: "lg" })}
                to="/docs/$"
                params={{ _splat: "responsibility-boundaries" }}
              >
                Understand the boundary
              </Link>
            </div>
          </div>
          <TransferPath />
        </div>
      </section>
      <section className="container container-padding-x section-padding-y mx-auto">
        <SectionHeading
          kicker="One path first"
          title="A complete journey before a menu of options"
          description="The reader gets one secure Promise + React + Node path, then substitutes only the layer they need."
        />
        <div className="mt-12 grid overflow-hidden rounded-3xl border lg:grid-cols-[0.72fr_1.28fr]">
          <StructureTree variant="journey" />
          <CodeJourney />
        </div>
      </section>
      <ResponsibilityRail />
    </>
  );
}

function OwnershipVariant() {
  return (
    <>
      <section className="container container-padding-x mx-auto py-16 sm:py-24">
        <PrototypeEyebrow>Responsibility-first documentation</PrototypeEyebrow>
        <div className="mt-6 grid gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:items-end">
          <h1 className="heading-xl max-w-2xl">
            One transfer. Four owners. No blurred boundaries.
          </h1>
          <p className="max-w-2xl text-lg leading-8 text-muted-foreground lg:justify-self-end">
            Begin with who makes each decision, then show the API and deployment path inside that
            responsibility. This structure optimizes for security and operational clarity.
          </p>
        </div>
        <div className="mt-14 divide-y rounded-3xl border bg-card">
          {responsibilities.map((responsibility, index) => (
            <div
              className="grid gap-3 p-5 sm:grid-cols-[2rem_0.7fr_0.5fr_1.8fr] sm:items-baseline sm:p-7"
              key={responsibility.owner}
            >
              <span className="font-mono text-xs text-muted-foreground">0{index + 1}</span>
              <h2 className="heading-xs">{responsibility.owner}</h2>
              <span className="text-sm font-medium">{responsibility.verb}</span>
              <p className="text-sm leading-6 text-muted-foreground">{responsibility.detail}</p>
            </div>
          ))}
        </div>
      </section>
      <section className="border-y bg-muted/35">
        <div className="container container-padding-x section-padding-y mx-auto grid gap-12 lg:grid-cols-2">
          <div>
            <SectionHeading
              kicker="The documentation map"
              title="The boundary is the navigation"
              description="Readers can enter through their responsibility without mistaking deployment work for application authorization."
            />
            <div className="mt-10 rounded-3xl border bg-background">
              <StructureTree variant="ownership" />
            </div>
          </div>
          <div>
            <SectionHeading
              kicker="Canonical example"
              title="One codebase, divided at trust seams"
              description="The home page shows exactly where application code stops and runtime wiring begins."
            />
            <div className="mt-10 rounded-3xl border bg-background">
              <ExampleTree />
            </div>
          </div>
        </div>
      </section>
      <section className="container container-padding-x section-padding-y mx-auto">
        <CodeJourney />
      </section>
    </>
  );
}

function SurfaceVariant() {
  return (
    <>
      <section className="border-b bg-[linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] bg-[size:2.5rem_2.5rem]">
        <div className="bg-background/90">
          <div className="container container-padding-x mx-auto py-20 sm:py-28">
            <PrototypeEyebrow>API and runtime-first documentation</PrototypeEyebrow>
            <h1 className="heading-xl mt-6 max-w-4xl">
              Choose your application surface. Keep the same storage contract.
            </h1>
            <p className="mt-7 max-w-2xl text-lg leading-8 text-muted-foreground">
              Enter through Promise or Effect, React or vanilla browser, Node or Cloudflare. Each
              path points back to one lifecycle and one responsibility model.
            </p>
            <PathMatrix />
          </div>
        </div>
      </section>
      <section className="container container-padding-x section-padding-y mx-auto grid gap-12 lg:grid-cols-[0.7fr_1.3fr]">
        <div>
          <SectionHeading
            kicker="Browse by surface"
            title="Reference-shaped navigation"
            description="Optimized for readers who already know their framework and runtime choices."
          />
          <div className="mt-10 rounded-3xl border">
            <StructureTree variant="surface" />
          </div>
        </div>
        <CodeJourney />
      </section>
      <ResponsibilityRail />
    </>
  );
}

function PrototypeEyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
      <span className="size-2 rounded-full bg-foreground" />
      Prototype · {children}
    </div>
  );
}

function SectionHeading({
  kicker,
  title,
  description,
}: {
  kicker: string;
  title: string;
  description: string;
}) {
  return (
    <div className="max-w-2xl">
      <p className="font-mono text-xs uppercase tracking-[0.16em] text-muted-foreground">
        {kicker}
      </p>
      <h2 className="heading-md mt-4">{title}</h2>
      <p className="mt-5 leading-7 text-muted-foreground">{description}</p>
    </div>
  );
}

function TransferPath() {
  const steps = [
    ["01", "Authorize", "Your server decides which files and operations are allowed."],
    ["02", "Transfer", "The browser sends bytes directly to S3-compatible storage."],
    ["03", "Verify", "Trusted server logic verifies identity and exact byte size."],
    ["04", "Download", "Your server authorizes a short-lived download capability."],
  ];

  return (
    <div className="relative rounded-3xl border bg-card p-3 shadow-sm">
      <div className="rounded-2xl border bg-muted/30 p-5 sm:p-7">
        <div className="mb-7 flex items-center justify-between border-b pb-4">
          <span className="font-mono text-xs uppercase tracking-wider">Upload to ready</span>
          <span className="rounded-full bg-foreground px-2.5 py-1 font-mono text-[0.625rem] text-background">
            DIRECT
          </span>
        </div>
        <div className="space-y-2">
          {steps.map(([number, title, detail]) => (
            <div
              className="grid grid-cols-[2rem_1fr] gap-3 rounded-xl p-3 hover:bg-background"
              key={number}
            >
              <span className="font-mono text-xs text-muted-foreground">{number}</span>
              <div>
                <p className="text-sm font-semibold">{title}</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">{detail}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StructureTree({ variant }: { variant: DocsVariant }) {
  const definition = variants[variant];
  const tree = useTree<StructureItem>({
    initialState: {
      expandedItems: definition.items.root.children ?? [],
    },
    indent: 18,
    rootItemId: "root",
    getItemName: (item) => item.getItemData().name,
    isItemFolder: (item) => (item.getItemData().children?.length ?? 0) > 0,
    dataLoader: {
      getItem: (itemId) => definition.items[itemId],
      getChildren: (itemId) => definition.items[itemId].children ?? [],
    },
    features: [syncDataLoaderFeature, hotkeysCoreFeature],
  });

  return (
    <div className="p-5 sm:p-7">
      <div className="mb-5 border-b pb-4">
        <p className="text-sm font-semibold">{definition.label}</p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">{definition.description}</p>
      </div>
      <Tree indent={18} tree={tree}>
        {tree.getItems().map((item) => (
          <TreeItem item={item} key={item.getId()}>
            <TreeItemLabel className="rounded-lg bg-transparent py-1.5 hover:bg-muted">
              <span className="flex items-center gap-2">
                {getItemIcon(item.getItemData(), item.isExpanded())}
                {item.getItemName()}
              </span>
            </TreeItemLabel>
          </TreeItem>
        ))}
      </Tree>
    </div>
  );
}

function ExampleTree() {
  const tree = useTree<StructureItem>({
    initialState: { expandedItems: ["app", "server", "deploy"] },
    indent: 18,
    rootItemId: "root",
    getItemName: (item) => item.getItemData().name,
    isItemFolder: (item) => (item.getItemData().children?.length ?? 0) > 0,
    dataLoader: {
      getItem: (itemId) => exampleFiles[itemId],
      getChildren: (itemId) => exampleFiles[itemId].children ?? [],
    },
    features: [syncDataLoaderFeature, hotkeysCoreFeature],
  });

  return (
    <div className="p-5 sm:p-7">
      <div className="mb-5 border-b pb-4 font-mono text-xs text-muted-foreground">
        Reference shape · illustrative, not runnable
      </div>
      <Tree indent={18} tree={tree}>
        {tree.getItems().map((item) => (
          <TreeItem item={item} key={item.getId()}>
            <TreeItemLabel className="rounded-lg bg-transparent py-1.5 hover:bg-muted">
              <span className="flex items-center gap-2">
                {getItemIcon(item.getItemData(), item.isExpanded())}
                {item.getItemName()}
              </span>
            </TreeItemLabel>
          </TreeItem>
        ))}
      </Tree>
    </div>
  );
}

function getItemIcon(item: StructureItem, expanded: boolean) {
  if (item.children?.length) {
    return (
      <HugeiconsIcon
        className="size-4 text-amber-500"
        icon={expanded ? FolderOpenIcon : FolderIcon}
        strokeWidth={2}
      />
    );
  }
  return (
    <HugeiconsIcon
      className={cn("size-4", item.type === "code" ? "text-blue-500" : "text-muted-foreground")}
      icon={item.type === "code" ? FileScriptIcon : File02Icon}
      strokeWidth={2}
    />
  );
}

function CodeJourney() {
  return (
    <div className="min-w-0 bg-[#101110] text-[#f3f3ef]">
      <div className="flex items-center justify-between border-b border-white/10 px-5 py-4 sm:px-7">
        <div className="flex items-center gap-2 font-mono text-xs text-white/55">
          <HugeiconsIcon className="size-4" icon={CodeIcon} />
          document-intake
        </div>
        <span className="font-mono text-[0.625rem] uppercase tracking-widest text-emerald-300">
          illustrative API
        </span>
      </div>
      <Tabs defaultValue="promise" className="gap-0">
        <TabsList
          className="w-full justify-start overflow-x-auto rounded-none border-b border-white/10 bg-transparent px-4 py-2"
          variant="line"
        >
          <TabsTrigger className="text-white/65 data-active:text-white" value="promise">
            Promise server
          </TabsTrigger>
          <TabsTrigger className="text-white/65 data-active:text-white" value="react">
            React
          </TabsTrigger>
          <TabsTrigger className="text-white/65 data-active:text-white" value="effect">
            Effect server
          </TabsTrigger>
          <TabsTrigger className="text-white/65 data-active:text-white" value="cloudflare">
            Cloudflare
          </TabsTrigger>
        </TabsList>
        {(Object.keys(codeSamples) as Array<keyof typeof codeSamples>).map((key) => (
          <TabsContent className="m-0" key={key} value={key}>
            <pre className="min-h-[29rem] overflow-x-auto p-5 font-mono text-[0.78rem] leading-6 text-white/85 sm:p-7">
              <code>{codeSamples[key]}</code>
            </pre>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

function ResponsibilityRail() {
  return (
    <section className="border-y bg-muted/35">
      <div className="container container-padding-x mx-auto grid md:grid-cols-2 xl:grid-cols-4">
        {responsibilities.map((responsibility, index) => (
          <div
            className="border-b py-8 md:odd:border-r md:nth-[3]:border-b-0 md:nth-[4]:border-b-0 xl:border-b-0 xl:border-r xl:last:border-r-0 xl:px-7 xl:first:pl-0"
            key={responsibility.owner}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">{responsibility.owner}</h2>
              <span className="font-mono text-[0.625rem] text-muted-foreground">0{index + 1}</span>
            </div>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">{responsibility.detail}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function PathMatrix() {
  const paths = [
    ["Authoring", "Promise-first", "Effect-native"],
    ["Browser", "React", "Vanilla"],
    ["Runtime", "Node", "Cloudflare"],
    ["Postgres", "pg", "Hyperdrive / Neon"],
  ];

  return (
    <div className="mt-12 grid overflow-hidden rounded-3xl border bg-background sm:grid-cols-2 lg:grid-cols-4">
      {paths.map(([label, primary, alternate]) => (
        <div
          className="border-b p-5 sm:odd:border-r lg:border-r lg:border-b-0 lg:last:border-r-0"
          key={label}
        >
          <p className="font-mono text-[0.625rem] uppercase tracking-widest text-muted-foreground">
            {label}
          </p>
          <p className="mt-5 text-lg font-semibold">{primary}</p>
          <p className="mt-1 text-sm text-muted-foreground">or {alternate}</p>
        </div>
      ))}
    </div>
  );
}

function PrototypeSwitcher({ variant }: { variant: DocsVariant }) {
  const navigate = useNavigate({ from: "/" });
  const order: DocsVariant[] = ["journey", "ownership", "surface"];
  const index = order.indexOf(variant);

  const select = (next: DocsVariant) => {
    void navigate({ search: { variant: next }, replace: true });
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.matches("input, textarea, [contenteditable='true']")) return;
      if (event.key === "ArrowLeft") select(order[(index - 1 + order.length) % order.length]);
      if (event.key === "ArrowRight") select(order[(index + 1) % order.length]);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [index]);

  if (import.meta.env.PROD) return null;

  return (
    <div className="fixed bottom-5 left-1/2 z-50 flex -translate-x-1/2 items-center gap-1 rounded-full border bg-foreground p-1 text-background shadow-2xl">
      <button
        aria-label="Previous prototype variant"
        className="grid size-9 place-items-center rounded-full hover:bg-background/15"
        onClick={() => select(order[(index - 1 + order.length) % order.length])}
        type="button"
      >
        <HugeiconsIcon icon={ArrowLeft01Icon} />
      </button>
      <div className="min-w-44 px-3 text-center text-xs">
        <span className="font-mono text-background/60">{variants[variant].shortLabel}</span>
        <span className="mx-2 text-background/30">·</span>
        <span className="font-medium">{variants[variant].label}</span>
      </div>
      <button
        aria-label="Next prototype variant"
        className="grid size-9 place-items-center rounded-full hover:bg-background/15"
        onClick={() => select(order[(index + 1) % order.length])}
        type="button"
      >
        <HugeiconsIcon icon={ArrowRight01Icon} />
      </button>
    </div>
  );
}
