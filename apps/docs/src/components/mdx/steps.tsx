export function Steps({ ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className="[counter-reset:step] [&_h2]:mt-6 [&_h2]:text-base relative ps-5 ms-2 border-s sm:ms-4 sm:ps-6 steps"
      {...props}
    />
  );
}

export function Step({ ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className="before:bg-secondary before:text-secondary-foreground before:content-[counter(step)] before:[counter-increment:step] before:justify-center before:items-center before:text-xs before:flex before:absolute before:size-6 before:-inset-s-3 before:rounded-full"
      {...props}
    />
  );
}
