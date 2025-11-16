import { KeyIcon } from "lucide-react";
import { siteConfig } from "@/lib/config";

export function SecureKeysDisclaimer() {
  return (
    <div className="rounded-lg border border-border bg-muted p-3 sm:p-4">
      <h3 className="mb-2 flex items-center font-semibold text-foreground text-sm sm:text-base">
        <KeyIcon className="mr-2 h-4 w-4" />
        Secure API Key Setup
      </h3>
      <p className="text-muted-foreground text-xs">
        To perform research, you&apos;ll need to provide your API keys. These
        keys are stored securely using HTTP-only cookies and are never exposed
        to client-side JavaScript.
      </p>
      <div className="mt-3 flex flex-col space-y-2 text-xs">
        <div className="text-muted-foreground">
          <p>
            <span className="font-medium">Self-hosting option:</span> You can
            clone the repository and host this application on your own
            infrastructure. This gives you complete control over your data and
            API key management.
          </p>
          <a
            className="mt-1 inline-flex items-center text-muted-foreground transition-colors hover:text-foreground"
            href={siteConfig.githubUrl}
            rel="noopener noreferrer"
            target="_blank"
          >
            View self-hosting instructions
            <svg
              aria-hidden="true"
              className="ml-1 h-3 w-3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                d="M14 5l7 7m0 0l-7 7m7-7H3"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
              />
            </svg>
          </a>
        </div>
      </div>
    </div>
  );
}
