// S4-15: Empty state component

import { FileSearch } from "lucide-react";

interface EmptyStateProps {
  title?: string;
  description?: string;
  icon?: React.ReactNode;
}

export function EmptyState({
  title = "No results found",
  description = "Try adjusting your search or filters.",
  icon,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center text-slate-500">
      <div className="mb-4 text-slate-300">
        {icon ?? <FileSearch size={48} />}
      </div>
      <p className="text-lg font-medium text-slate-600">{title}</p>
      <p className="mt-1 text-sm">{description}</p>
    </div>
  );
}
