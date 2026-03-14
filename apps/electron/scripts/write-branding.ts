import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { config } from "@/lib/config";

const { appName, appPrefix, appUrl, organization } = config;

writeFileSync(
  resolve(__dirname, "..", "branding.json"),
  JSON.stringify({ appName, appPrefix, appUrl, orgName: organization.name }, null, 2)
);

console.log("branding.json written:", { appName, appPrefix, appUrl });
