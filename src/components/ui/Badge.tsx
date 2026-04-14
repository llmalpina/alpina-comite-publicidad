import * as React from "react";
import { cn } from "@/lib/utils";

const Badge = ({ className, variant = "default", ...props }: React.HTMLAttributes<HTMLDivElement> & {
  variant?: "default" | "secondary" | "destructive" | "outline" | "success" | "warning";
}) => {
  const variants = {
    default: "border-transparent bg-brand text-white",
    secondary: "border-transparent bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300",
    destructive: "border-transparent bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400",
    outline: "text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-600",
    success: "border-transparent bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400",
    warning: "border-transparent bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-400",
  };

  return <div className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors", variants[variant], className)} {...props} />;
};

export { Badge };
