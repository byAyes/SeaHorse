import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { getScoreVariant } from "@/lib/utils";

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "success" | "warning" | "danger" | "outline";
}

const variantClasses: Record<string, string> = {
  default:
    "bg-primary-100 text-primary-dark dark:bg-primary-50/10 dark:text-primary-light",
  success:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",
  warning:
    "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400",
  danger:
    "bg-rose-100 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400",
  outline:
    "border border-slate-300 text-slate-600 dark:border-slate-600 dark:text-slate-400",
};

export function Badge({
  className,
  variant = "default",
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-[--radius-badge] px-2.5 py-0.5 text-xs font-medium transition-all duration-150",
        variantClasses[variant],
        className
      )}
      {...props}
    />
  );
}

interface ScoreBadgeProps {
  score: number;
  showIcon?: boolean;
}

export function ScoreBadge({ score, showIcon = true }: ScoreBadgeProps) {
  const variant = getScoreVariant(score);
  return (
    <motion.span
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
    >
    <Badge variant={variant} className="gap-1">
      {showIcon && (
        <span
          className={cn(
            "inline-block h-1.5 w-1.5 rounded-full",
            variant === "success" && "bg-emerald-500",
            variant === "warning" && "bg-amber-500",
            variant === "danger" && "bg-rose-500"
          )}
        />
      )}
      {Math.round(score)}% match
    </Badge>
    </motion.span>
  );
}
