import { Header } from "@/components/header";

export default function OrgLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Header />
      <div className="pt-16 min-h-[calc(100vh-4rem)] w-full">
        {children}
      </div>
    </>
  );
}
