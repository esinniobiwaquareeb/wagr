"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from 'next/navigation';
import { useRouter } from 'next/navigation';
import { Home } from "lucide-react";

interface Category {
  id: string;
  slug: string;
  label: string;
  icon: string | null;
}

interface CategoryNavigationProps {
  categories: Category[];
  categoryCounts: Record<string, number>;
  onCategoryChange?: () => void; // Optional callback when category changes
}

export function CategoryNavigation({ 
  categories, 
  categoryCounts,
  onCategoryChange 
}: CategoryNavigationProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();

  const handleAllClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    const params = new URLSearchParams(searchParams?.toString() || '');
    params.delete('category');
    params.delete('search'); // Clear search when clicking "All"
    router.push(`/wagers?${params.toString()}`);
    onCategoryChange?.();
  };

  const handleCategoryClick = (e: React.MouseEvent<HTMLAnchorElement>, categorySlug: string) => {
    e.preventDefault();
    const params = new URLSearchParams();
    params.set('category', categorySlug);
    params.delete('search'); // Clear search when selecting a category
    router.push(`/wagers?${params.toString()}`);
    onCategoryChange?.();
  };

  return (
    <div className="flex items-center gap-1 h-12 border-t border-border/50 overflow-x-auto scrollbar-hide px-1">
      <Link
        href="/wagers"
        onClick={handleAllClick}
        className={`flex items-center gap-1.5 px-3 py-2 rounded-md whitespace-nowrap text-sm font-medium transition-all ${
          pathname === "/wagers" && !searchParams?.get("category")
            ? "bg-primary/10 text-primary"
            : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
        }`}
      >
        <Home className="h-3.5 w-3.5 flex-shrink-0" />
        <span>All</span>
      </Link>
      {categories.map((category) => {
        const count = categoryCounts[category.slug] || 0;
        const isActive = pathname === "/wagers" && searchParams?.get("category") === category.slug;
        
        return (
          <Link
            key={category.id}
            href={`/wagers?category=${category.slug}`}
            onClick={(e) => handleCategoryClick(e, category.slug)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-md whitespace-nowrap text-sm font-medium transition-all ${
              isActive
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            }`}
          >
            {category.icon && <span className="text-base flex-shrink-0">{category.icon}</span>}
            <span>{category.label}</span>
            {count > 0 && (
              <span className={`ml-0.5 px-1.5 py-0.5 rounded-full text-xs font-semibold ${
                isActive
                  ? "bg-primary/20 text-primary"
                  : "bg-muted text-muted-foreground"
              }`}>
                {count}
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );
}
