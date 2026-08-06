import { ModeToggle } from "#/components/mode-toggle.tsx";
import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return (
    <div className="p-8">
      <h1 className="text-4xl font-bold">Welcome to the TanStack Docs!</h1>
      <Link
        to="/docs/$"
        params={{
          _splat: "",
        }}
      >
        Go to Docs
      </Link>
      <ModeToggle />
    </div>
  );
}
