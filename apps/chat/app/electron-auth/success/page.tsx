import { Suspense } from "react";
import { config } from "@/lib/config";
import { ElectronAuthSuccessClient } from "./client";

export default function ElectronAuthSuccess() {
  return (
    <Suspense>
      <ElectronAuthSuccessClient appScheme={config.appPrefix} />
    </Suspense>
  );
}
