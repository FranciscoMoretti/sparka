import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { SocialAuthProviders } from "@/components/auth-providers";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { auth } from "@/lib/auth";

// Opened in the user's default browser by the Electron app.
// If already authenticated, immediately exchanges the session for a token and
// returns the user to the app. Otherwise shows provider selection so the user
// can sign in — OAuth state cookies are stored here (not in Electron), which
// prevents the state_mismatch error.
export default async function ElectronAuth() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (session) {
    redirect("/api/auth/electron-callback");
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-sm px-4">
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-xl">Sign in</CardTitle>
            <CardDescription>
              You&apos;ll be returned to the app after signing in
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SocialAuthProviders callbackURL="/api/auth/electron-callback" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
