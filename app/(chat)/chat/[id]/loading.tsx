import { WithSkeleton } from "@/components/with-skeleton";

export default function Loading() {
  return (
    <WithSkeleton className="h-full w-full" isLoading={true}>
      <div className="flex h-dvh w-full" />
    </WithSkeleton>
  );
}
