import { AIDevtools } from "@ai-sdk-tools/devtools";
import { cookies, headers } from "next/headers";
import { AppSidebar } from "@/components/app-sidebar";
import { KeyboardShortcuts } from "@/components/keyboard-shortcuts";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { type AppModelId, DEFAULT_CHAT_MODEL } from "@/lib/ai/app-models";
import { ANONYMOUS_LIMITS } from "@/lib/types/anonymous";
import { DefaultModelProvider } from "@/providers/default-model-provider";
import { SessionProvider } from "@/providers/session-provider";
import { TRPCReactProvider } from "@/trpc/react";
import { auth } from "../../lib/auth";
import { ChatProviders } from "./chat-providers";

export default async function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const raw = await auth.api.getSession({ headers: await headers() });
  const session = raw
    ? {
        user: raw.user
          ? {
              id: raw.user.id,
              name: raw.user.name ?? null,
              email: raw.user.email ?? null,
              image: raw.user.image ?? null,
            }
          : undefined,
        expires: raw.session?.expiresAt
          ? new Date(raw.session.expiresAt).toISOString()
          : undefined,
      }
    : undefined;
  const isCollapsed = cookieStore.get("sidebar:state")?.value !== "true";

  const cookieModel = cookieStore.get("chat-model")?.value as AppModelId;
  const isAnonymous = !session?.user;

  // Check if the model from cookie is available for anonymous users
  let defaultModel = cookieModel ?? DEFAULT_CHAT_MODEL;

  if (isAnonymous && cookieModel) {
    const isModelAvailable = ANONYMOUS_LIMITS.AVAILABLE_MODELS.includes(
      cookieModel as (typeof ANONYMOUS_LIMITS.AVAILABLE_MODELS)[number]
    );
    if (!isModelAvailable) {
      // Switch to default model if current model is not available for anonymous users
      defaultModel = DEFAULT_CHAT_MODEL;
    }
  }

  return (
    <TRPCReactProvider>
      <SessionProvider initialSession={session}>
        <ChatProviders user={session?.user}>
          <SidebarProvider defaultOpen={!isCollapsed}>
            <AppSidebar />
            <SidebarInset
              style={
                {
                  "--header-height": "calc(var(--spacing) * 13)",
                } as React.CSSProperties
              }
            >
              <DefaultModelProvider defaultModel={defaultModel}>
                <KeyboardShortcuts />
                {children}
              </DefaultModelProvider>
            </SidebarInset>
          </SidebarProvider>
        </ChatProviders>
      </SessionProvider>
      {process.env.NODE_ENV === "development" && <AIDevtools />}
    </TRPCReactProvider>
  );
}
