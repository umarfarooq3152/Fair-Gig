import React from "react";
import { cn } from "@/lib/utils";

export const BentoGrid = ({
  className,
  children,
}: {
  className?: string;
  children?: React.ReactNode;
}) => {
  return (
    <div
      className={cn(
        "mx-auto grid max-w-7xl grid-cols-1 gap-4 md:auto-rows-[18rem] md:grid-cols-3",
        className,
      )}
    >
      {children}
    </div>
  );
};

export const BentoGridItem = ({
  className,
  title,
  description,
  header,
  icon,
}: {
  className?: string;
  title?: string | React.ReactNode;
  description?: string | React.ReactNode;
  header?: React.ReactNode;
  icon?: React.ReactNode;
  key?: React.Key;
}) => {
  return (
    <div
      className={cn(
        "group/bento shadow-sm row-span-1 flex flex-col justify-between space-y-4 rounded-[32px] border border-slate-100 bg-white p-8 transition duration-500 hover:shadow-[0_0_40px_-15px_rgba(0,209,255,0.3)] hover:border-mint-500/40",
        className,
      )}
    >
      {header}
      <div className="transition duration-200 group-hover/bento:translate-x-2">
        {icon}
        <div className="mt-2 mb-2 font-sans font-bold text-slate-900 dark:text-white">
          {title}
        </div>
        <div className="font-sans text-xs font-normal text-slate-600 dark:text-slate-400">
          {description}
        </div>
      </div>
    </div>
  );
};
