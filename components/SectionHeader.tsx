import Link from "next/link";

type SectionHeaderProps = {
  title: string;
  action?: { label: string; href: string };
};

export function SectionHeader({ title, action }: SectionHeaderProps) {
  return (
    <div className="flex h-[50px] items-center justify-between px-5">
      <h2 className="text-[0.8125rem] font-medium leading-[1.125rem] text-faint">
        {title}
      </h2>
      {action ? (
        <Link
          href={action.href}
          className="-mr-3 flex h-11 items-center px-3 text-[0.8125rem] font-semibold leading-[1.125rem] text-primary-ink"
        >
          {action.label}
        </Link>
      ) : null}
    </div>
  );
}