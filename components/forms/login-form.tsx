"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

import { z } from "zod";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import Link from "next/link";

const requestSchema = z.object({
  email: z.string().email(),
});
const verifySchema = z.object({
  code: z.string().length(6),
});

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState<"request" | "verify">("request");
  const [email, setEmail] = useState<string>("");

  const router = useRouter();
  const requestForm = useForm<z.infer<typeof requestSchema>>({
    resolver: zodResolver(requestSchema),
    defaultValues: { email: "" },
  });
  const verifyForm = useForm<z.infer<typeof verifySchema>>({
    resolver: zodResolver(verifySchema),
    defaultValues: { code: "" },
  });

  /* const signInWithGoogle = async () => {
    await authClient.signIn.social({
      provider: "google",
      callbackURL: "/landing",
    });
  }; */

  async function submitRequest(values: z.infer<typeof requestSchema>) {
    setIsLoading(true);
    try {
      const normalized = values.email.trim().toLowerCase();
      const res = await fetch("/api/auth/request-otp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: normalized }),
      });
      if (!res.ok) {
        let msg = "Failed to send code";
        try {
          const data = await res.json();
          if (data?.message) msg = data.message;
        } catch {
          const text = await res.text();
          if (text) msg = text;
        }
        throw new Error(msg);
      }
  setEmail(normalized);
      setStep("verify");
      toast.success("We sent you a 6-digit code.");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Could not send code";
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  }

  async function submitVerify(values: z.infer<typeof verifySchema>) {
    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), code: values.code }),
      });
      if (!res.ok) {
        const msg = await res.text();
        throw new Error(msg || "Invalid code");
      }
      toast.success("Signed in successfully.");
      router.push("/landing");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Invalid code";
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div
      className={cn(
        "flex flex-col gap-6 max-w-md md:max-w-xl lg:max-w-2xl mx-auto",
        className,
      )}
      {...props}
    >
      <Card>
        <CardHeader className="text-center md:py-8">
          <CardTitle className="text-xl md:text-3xl">Welcome back</CardTitle>
          <CardDescription className="md:text-base">
            Login with your ventia email
          </CardDescription>
        </CardHeader>
        <CardContent>
          {step === "request" ? (
            <Form {...requestForm}>
              <form
                onSubmit={requestForm.handleSubmit(submitRequest)}
                className="space-y-8 md:space-y-10"
              >
                <div className="grid gap-6 md:gap-8">
                  <div className="after:border-border relative text-center text-sm md:text-base after:absolute after:inset-0 after:top-1/2 after:z-0 after:flex after:items-center after:border-t"></div>
                  <div className="grid gap-6 md:gap-8">
                    <div className="grid gap-3 md:gap-4">
                      <FormField
                        control={requestForm.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="md:text-base">Email</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="@ventia.com"
                                className="text-base md:text-lg md:h-12"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <Button
                      type="submit"
                      className="w-full md:h-12 md:text-base"
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <Loader2 className="size-4 md:size-5 animate-spin" />
                      ) : (
                        "Send code"
                      )}
                    </Button>
                  </div>
                  <div className="text-center text-sm md:text-base">
                    Don&apos;t have an account?{" "}
                    <Link href="/signup" className="underline underline-offset-4">
                      Sign up
                    </Link>
                  </div>
                </div>
              </form>
            </Form>
          ) : (
            <Form {...verifyForm}>
              <form
                onSubmit={verifyForm.handleSubmit(submitVerify)}
                className="space-y-8 md:space-y-10"
              >
                <div className="grid gap-6 md:gap-8">
                  <div className="grid gap-3 md:gap-4">
                    <FormField
                      control={verifyForm.control}
                      name="code"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="md:text-base">
                            Enter code sent to {email}
                          </FormLabel>
                          <FormControl>
                            <Input
                              placeholder="123456"
                              maxLength={6}
                              className="text-base md:text-lg md:h-12"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <Button
                    type="submit"
                    className="w-full md:h-12 md:text-base"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <Loader2 className="size-4 md:size-5 animate-spin" />
                    ) : (
                      "Verify & sign in"
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="md:text-base"
                    onClick={() => setStep("request")}
                  >
                    Use a different email
                  </Button>
                </div>
              </form>
            </Form>
          )}
        </CardContent>
      </Card>
      <div className="text-muted-foreground *:[a]:hover:text-primary text-center text-xs md:text-sm text-balance *:[a]:underline *:[a]:underline-offset-4">
        <div className="mx-auto inline-block max-w-[46ch] md:max-w-[60ch] text-left">
          <p className="mb-1 font-medium text-foreground/80">How sign‑in works</p>
          <ol className="list-decimal space-y-1 md:space-y-1.5 pl-5">
            <li>Enter your work email and select “Send code”.</li>
            <li>Check your inbox for a 6‑digit code (valid for a few minutes).</li>
            <li>Enter the code and select “Verify &amp; sign in”.</li>
            <li>
              If you have one organisation, you’ll go straight to its home.
              If you have several, pick one and continue.
            </li>
            <li>If something looks wrong, choose “Use a different email” to try again.</li>
          </ol>
          <p className="mt-2 text-[11px] md:text-xs">
            Tip: If you don’t see the email, check spam/junk and ensure your inbox accepts external mail.
          </p>
        </div>
      </div>
    </div>
  );
}
