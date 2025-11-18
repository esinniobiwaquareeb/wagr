"use client";

import { useState, useMemo, ReactNode } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Search, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";

export interface Column<T> {
  id: string;
  header: string;
  accessorKey?: keyof T;
  cell?: (row: T) => ReactNode;
  sortable?: boolean;
  filterable?: boolean;
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  searchable?: boolean;
  searchPlaceholder?: string;
  searchKeys?: (keyof T)[];
  pagination?: boolean;
  pageSize?: number;
  sortable?: boolean;
  defaultSort?: { key: keyof T; direction: "asc" | "desc" };
  emptyMessage?: string;
  className?: string;
}

export function DataTable<T extends Record<string, any>>({
  data,
  columns,
  searchable = true,
  searchPlaceholder = "Search...",
  searchKeys,
  pagination = true,
  pageSize = 10,
  sortable = true,
  defaultSort,
  emptyMessage = "No data found",
  className = "",
}: DataTableProps<T>) {
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [sortConfig, setSortConfig] = useState<{
    key: keyof T | null;
    direction: "asc" | "desc";
  }>(defaultSort ? { key: defaultSort.key, direction: defaultSort.direction } : { key: null, direction: "asc" });

  // Filter data based on search
  const filteredData = useMemo(() => {
    if (!search.trim()) return data;

    const searchLower = search.toLowerCase().trim();
    
    // Get keys to search - use provided searchKeys or all accessorKeys from columns
    const keysToSearch = searchKeys || columns
      .map(col => col.accessorKey)
      .filter(Boolean) as (keyof T)[];

    return data.filter((row) => {
      // Search through specified keys
      for (const key of keysToSearch) {
        const value = row[key];
        
        if (value === null || value === undefined) continue;
        
        // Handle different value types
        let searchableValue = "";
        
        if (typeof value === "string") {
          searchableValue = value;
        } else if (typeof value === "number") {
          searchableValue = String(value);
        } else if (typeof value === "boolean") {
          searchableValue = String(value);
        } else if (value && typeof value === "object" && "getTime" in value) {
          // Handle Date objects
          const dateValue = value as Date;
          searchableValue = dateValue.toISOString();
        } else if (typeof value === "object" && value !== null) {
          // For objects, try to stringify or search nested properties
          try {
            searchableValue = JSON.stringify(value);
          } catch {
            searchableValue = String(value);
          }
        } else {
          searchableValue = String(value);
        }
        
        if (searchableValue.toLowerCase().includes(searchLower)) {
          return true;
        }
      }
      
      // Also search through all column values (including formatted ones)
      // This helps when searchKeys might not include all searchable fields
      for (const column of columns) {
        if (column.accessorKey && !keysToSearch.includes(column.accessorKey)) {
          const value = row[column.accessorKey];
          if (value !== null && value !== undefined) {
            const searchableValue = String(value).toLowerCase();
            if (searchableValue.includes(searchLower)) {
              return true;
            }
          }
        }
      }
      
      return false;
    });
  }, [data, search, searchKeys, columns]);

  // Sort data
  const sortedData = useMemo(() => {
    if (!sortConfig.key) return filteredData;

    return [...filteredData].sort((a, b) => {
      const aValue = a[sortConfig.key!];
      const bValue = b[sortConfig.key!];

      if (aValue === null || aValue === undefined) return 1;
      if (bValue === null || bValue === undefined) return -1;

      // Handle different types
      if (typeof aValue === "number" && typeof bValue === "number") {
        return sortConfig.direction === "asc" ? aValue - bValue : bValue - aValue;
      }

      // Handle Date objects or date strings
      let aDate: Date | null = null;
      let bDate: Date | null = null;
      
      if (aValue && typeof aValue === "object" && "getTime" in aValue) {
        aDate = aValue as Date;
      } else if (typeof aValue === "string") {
        aDate = new Date(aValue);
      }
      
      if (bValue && typeof bValue === "object" && "getTime" in bValue) {
        bDate = bValue as Date;
      } else if (typeof bValue === "string") {
        bDate = new Date(bValue);
      }
      
      if (aDate && bDate && !isNaN(aDate.getTime()) && !isNaN(bDate.getTime())) {
        return sortConfig.direction === "asc"
          ? aDate.getTime() - bDate.getTime()
          : bDate.getTime() - aDate.getTime();
      }

      // String comparison
      const aStr = String(aValue).toLowerCase();
      const bStr = String(bValue).toLowerCase();

      if (sortConfig.direction === "asc") {
        return aStr.localeCompare(bStr);
      } else {
        return bStr.localeCompare(aStr);
      }
    });
  }, [filteredData, sortConfig]);

  // Paginate data
  const paginatedData = useMemo(() => {
    if (!pagination) return sortedData;

    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return sortedData.slice(startIndex, endIndex);
  }, [sortedData, currentPage, pageSize, pagination]);

  const totalPages = Math.ceil(sortedData.length / pageSize);

  const handleSort = (key: keyof T) => {
    setSortConfig((prev) => {
      if (prev.key === key) {
        return {
          key,
          direction: prev.direction === "asc" ? "desc" : "asc",
        };
      }
      return { key, direction: "asc" };
    });
    setCurrentPage(1); // Reset to first page on sort
  };

  const getSortIcon = (column: Column<T>) => {
    if (!column.sortable && !sortable) return null;
    if (sortConfig.key !== column.accessorKey) {
      return <ArrowUpDown className="h-4 w-4 ml-1 opacity-50" />;
    }
    return sortConfig.direction === "asc" ? (
      <ArrowUp className="h-4 w-4 ml-1" />
    ) : (
      <ArrowDown className="h-4 w-4 ml-1" />
    );
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Search */}
      {searchable && (
        <div className="flex items-center gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={searchPlaceholder}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1); // Reset to first page on search
              }}
              className="pl-9"
            />
          </div>
          {search && (
            <span className="text-sm text-muted-foreground">
              {filteredData.length} result{filteredData.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>
      )}

      {/* Table */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {columns.map((column) => (
                  <TableHead
                    key={column.id}
                    className={column.sortable !== false && sortable ? "cursor-pointer hover:bg-muted/50" : ""}
                    onClick={() => {
                      if ((column.sortable !== false && sortable) && column.accessorKey) {
                        handleSort(column.accessorKey);
                      }
                    }}
                  >
                    <div className="flex items-center">
                      {column.header}
                      {getSortIcon(column)}
                    </div>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={columns.length} className="text-center text-muted-foreground py-8">
                    {emptyMessage}
                  </TableCell>
                </TableRow>
              ) : (
                paginatedData.map((row, index) => (
                  <TableRow key={index}>
                    {columns.map((column) => (
                      <TableCell key={column.id}>
                        {column.cell ? column.cell(row) : column.accessorKey ? String(row[column.accessorKey] ?? "") : ""}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Pagination */}
      {pagination && totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Showing {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, sortedData.length)} of{" "}
            {sortedData.length} entries
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
            >
              <ChevronsLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="text-sm font-medium">
              Page {currentPage} of {totalPages}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
            >
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

