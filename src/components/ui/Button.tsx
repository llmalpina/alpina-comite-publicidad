import * as React from "react";
import { cn } from "@/lib/utils";

const Button = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
    size?: "default" | "sm" | "lg" | "icon";
  }
>(({ className, variant = "default", size = "default", ...props }, ref) => {
  const variants = {
    default: "bg-brand text-white hover:bg-brand-600 shadow-sm",
    destructive: "bg-red-500 text-white hover:bg-red-600",
    outline: "border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200",
    secondary: "bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-slate-100 hover:bg-slate-200 dark:hover:bg-slate-600",
    ghost: "hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200",
    link: "text-brand underline-offset-4 hover:underline",
  };
  const sizes = { default: "h-10 px-4 py-2", sm: "h-9 rounded-md px-3", lg: "h-11 rounded-md px-8", icon: "h-10 w-10" };

  return (
    <button className={cn("inline-flex items-center justify-center rounded-xl text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50", variants[variant], sizes[size], className)} ref={ref} {...props} />
  );
});
Button.displayName = "Button";

export { Button };
