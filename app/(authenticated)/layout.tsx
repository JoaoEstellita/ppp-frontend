import { Sidebar } from "@/components/Sidebar";
import { Topbar } from "@/components/Topbar";
import { CaseProvider } from "@/lib/caseContext";

export default function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <CaseProvider>
      <div className="flex min-h-screen">
        <Sidebar />
        <div className="flex-1 flex flex-col">
          <Topbar />
          <main className="flex-1 p-6 bg-gray-50">{children}</main>
        </div>
      </div>
    </CaseProvider>
  );
}

