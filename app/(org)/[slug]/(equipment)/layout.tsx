import { Metadata } from "next";

import { Header } from "@/components/header";

export const metadata: Metadata = {
  title: "DOT Equipment Register",
  description: "DOT Equipment Register",
};

export default function PreviewLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-50 via-stone-100 to-zinc-100 dark:from-neutral-900 dark:via-neutral-950 dark:to-neutral-950">
      <Header />
      <main className="pt-16">
        <div className="p-4">{children}</div>
      </main>
    </div>
  );
}
