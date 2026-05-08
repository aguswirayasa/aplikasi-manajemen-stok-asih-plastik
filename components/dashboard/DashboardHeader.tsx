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
        <p className="mt-2 max-w-[640px] text-[15px] leading-[1.25] text-[#36342e]">
          Selamat datang,{" "}
          <span className="font-bold text-[#201515]">{displayName}</span>.
        </p>
      </div>
    </header>
  );
}
