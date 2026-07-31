import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { siteUrl } from "@/lib/siteUrl";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Member Login — CCAC" },
      { name: "description", content: "Sign in or create an account to access the CCAC member portal." },
    ],
  }),
  component: AuthPage,
});

const emailSchema = z.string().trim().email({ message: "Enter a valid email" }).max(255);
const passwordSchema = z.string().min(8, { message: "Password must be at least 8 characters" }).max(128);
const nameSchema = z.string().trim().min(1, { message: "Required" }).max(100);

function AuthPage() {
  const { user, loading } = useSession();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) navigate({ to: "/dashboard" });
  }, [user, loading, navigate]);

  const handleSignIn = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const email = emailSchema.safeParse(fd.get("email"));
    const password = passwordSchema.safeParse(fd.get("password"));
    if (!email.success) return toast.error(email.error.issues[0].message);
    if (!password.success) return toast.error(password.error.issues[0].message);
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.data, password: password.data });
    setBusy(false);
    if (error) return toast.error(error.message);
    navigate({ to: "/dashboard" });
  };

  const handleSignUp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const name = nameSchema.safeParse(fd.get("name"));
    const email = emailSchema.safeParse(fd.get("email"));
    const password = passwordSchema.safeParse(fd.get("password"));
    if (!name.success) return toast.error(name.error.issues[0].message);
    if (!email.success) return toast.error(email.error.issues[0].message);
    if (!password.success) return toast.error(password.error.issues[0].message);
    setBusy(true);
    const { error } = await supabase.auth.signUp({
      email: email.data,
      password: password.data,
      options: {
        emailRedirectTo: siteUrl("/dashboard"),
        data: { display_name: name.data },
      },
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Welcome to the family!");
    navigate({ to: "/dashboard" });
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-night text-night-foreground">
      <div className="hidden lg:flex flex-col justify-between p-12 bg-gradient-to-br from-night via-night to-primary">
        <Link to="/" className="flex items-center gap-3">
          <div className="h-10 w-10 flex items-center justify-center border border-gold/40 text-gold font-display">C</div>
          <div className="font-display text-xl">CCAC</div>
        </Link>
        <div>
          <div className="eyebrow text-gold mb-6">— Member Portal</div>
          <h1 className="display-hero text-6xl">Welcome<br />home.</h1>
          <p className="mt-8 text-night-foreground/70 max-w-sm">
            Sign in to access events, evangelism tools, Bible plans, and connect with your church family.
          </p>
        </div>
        <div className="text-xs text-night-foreground/50">© CCAC · Baltimore, MD</div>
      </div>

      <div className="flex items-center justify-center p-8 bg-background text-foreground">
        <div className="w-full max-w-md">
          <Link to="/" className="lg:hidden eyebrow text-accent mb-8 inline-block">← Back to site</Link>
          <Tabs defaultValue="signin">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Sign In</TabsTrigger>
              <TabsTrigger value="signup">Create Account</TabsTrigger>
            </TabsList>
            <TabsContent value="signin">
              <form onSubmit={handleSignIn} className="space-y-4 mt-6">
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" name="email" type="email" required />
                </div>
                <div>
                  <Label htmlFor="password">Password</Label>
                  <Input id="password" name="password" type="password" required />
                </div>
                <Button type="submit" disabled={busy} className="w-full bg-night text-night-foreground hover:bg-night/90 rounded-none py-6 eyebrow">
                  {busy ? "Signing in..." : "Sign In"}
                </Button>
              </form>
            </TabsContent>
            <TabsContent value="signup">
              <form onSubmit={handleSignUp} className="space-y-4 mt-6">
                <div>
                  <Label htmlFor="name">Full Name</Label>
                  <Input id="name" name="name" required maxLength={100} />
                </div>
                <div>
                  <Label htmlFor="email-up">Email</Label>
                  <Input id="email-up" name="email" type="email" required />
                </div>
                <div>
                  <Label htmlFor="password-up">Password</Label>
                  <Input id="password-up" name="password" type="password" required minLength={8} />
                  <p className="text-xs text-muted-foreground mt-1">At least 8 characters.</p>
                </div>
                <Button type="submit" disabled={busy} className="w-full bg-night text-night-foreground hover:bg-night/90 rounded-none py-6 eyebrow">
                  {busy ? "Creating..." : "Create Account"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
