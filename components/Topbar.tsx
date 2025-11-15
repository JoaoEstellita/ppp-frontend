export function Topbar() {
  return (
    <header className="bg-white shadow-sm border-b border-gray-200 px-6 py-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Auditoria de PPP</h1>
        <div className="flex items-center space-x-4">
          <span className="text-sm text-gray-600">Usuário: Admin</span>
        </div>
      </div>
    </header>
  );
}

