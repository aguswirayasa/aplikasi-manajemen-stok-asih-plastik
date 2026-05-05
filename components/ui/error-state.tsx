import Link from "next/link";
import type { ComponentType, ReactNode } from "react";
import type { LucideProps } from "lucide-react";

export function ErrorState({
  icon: Icon,
  eyebrow,
  title,
  description,
  children,
}: {
  icon: ComponentType<LucideProps>;
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-[720px] items-center justify-center py-10">
      <section className="w-full rounded-[8px] border border-[#c5c0b1] bg-[#fffefb] p-6 text-center sm:p-10">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-[8px] border border-[#ff4f00]/25 bg-[#fff4ee] text-[#ff4f00]">
          <Icon className="h-7 w-7" />
        </div>
        <p className="mt-5 text-[12px] font-bold uppercase tracking-[0.5px] text-[#939084]">
          {eyebrow}
        </p>
        <h1 className="mt-2 text-[28px] font-semibold leading-[1.05] text-[#201515] sm:text-[34px]">
          {title}
        </h1>
        <p className="mx-auto mt-3 max-w-[480px] text-[15px] leading-[1.45] text-[#36342e]">
          {description}
        </p>
        <div className="mt-7 flex flex-col items-stretch justify-center gap-3 sm:flex-row">
          {children}
        </div>
      </section>
    </div>
  );
}

export function ErrorStateLink({
  href,
  children,
  variant = "primary",
}: {
  href: string;
  children: ReactNode;
  variant?: "primary" | "secondary";
}) {
  const className =
    variant === "primary"
      ? "inline-flex min-h-11 items-center justify-center gap-2 rounded-[8px] border border-[#ff4f00] bg-[#ff4f00] px-4 text-[14px] font-bold text-[#fffefb] transition-colors hover:bg-[#e64600]"
      : "inline-flex min-h-11 items-center justify-center gap-2 rounded-[8px] border border-[#c5c0b1] bg-[#fffefb] px-4 text-[14px] font-bold text-[#201515] transition-colors hover:bg-[#eceae3]";

  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}

export const errorStateButtonClassName =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-[8px] border border-[#ff4f00] bg-[#ff4f00] px-4 text-[14px] font-bold text-[#fffefb] transition-colors hover:bg-[#e64600]";
