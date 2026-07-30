export function DashboardHeader({ displayName }: { displayName: string }) {
  return (
    <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div>
        <p className="text-[12px] font-semibold uppercase tracking-[0.5px] text-[#939084]">
          Ringkasan operasional
        </p>
        <h1 className="mt-1 text-[30px] font-semibold leading-[1] text-[#201515] md:text-[36px]">
          Dashboard Stok
        </h1>
      </div>
      <div className="text-left md:text-right">
        <p className="text-[11px] font-semibold uppercase tracking-[0.5px] text-[#939084]">
          Pengguna
        </p>
        <p className="mt-1 text-[15px] font-bold text-[#201515]">
          {displayName}
        </p>
      </div>
    </header>
  );
}
