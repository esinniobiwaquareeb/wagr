import Link from "next/link";
import { ChevronRight, Home } from "lucide-react";
import { StructuredData, getBreadcrumbSchema } from "./structured-data";

export interface BreadcrumbItem {
  name: string;
  url: string;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  className?: string;
}

export function Breadcrumbs({ items, className = "" }: BreadcrumbsProps) {
  // Always include home as first item
  const allItems = [
    { name: "Home", url: "/" },
    ...items
  ];

  const breadcrumbSchema = getBreadcrumbSchema(allItems);

  return (
    <>
      <StructuredData data={breadcrumbSchema} />
      <nav 
        aria-label="Breadcrumb" 
        className={`flex items-center gap-2 text-sm text-muted-foreground ${className}`}
      >
        <ol className="flex items-center gap-2 flex-wrap">
          {allItems.map((item, index) => {
            const isLast = index === allItems.length - 1;
            
            return (
              <li key={item.url} className="flex items-center gap-2">
                {index === 0 ? (
                  <Link
                    href={item.url}
                    className="flex items-center gap-1 hover:text-foreground transition-colors"
                    aria-label="Home"
                  >
                    <Home className="h-4 w-4" />
                    <span className="sr-only">Home</span>
                  </Link>
                ) : (
                  <>
                    <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
                    {isLast ? (
                      <span className="text-foreground font-medium" aria-current="page">
                        {item.name}
                      </span>
                    ) : (
                      <Link
                        href={item.url}
                        className="hover:text-foreground transition-colors"
                      >
                        {item.name}
                      </Link>
                    )}
                  </>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
    </>
  );
}

