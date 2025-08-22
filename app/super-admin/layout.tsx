import { Header } from "@/components/header";

export default function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Header />
      <div className="pt-16">
        {children}
      </div>
    </>
  );
}
