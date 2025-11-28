"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Search, User, X } from "lucide-react";
import { useDebounce } from "@/hooks/use-debounce";

interface User {
  id: string;
  username: string;
  avatar_url?: string | null;
  email?: string | null;
}

interface UsernameInputProps {
  value: string;
  onChange: (value: string) => void;
  onUserSelect?: (user: User | null) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function UsernameInput({
  value,
  onChange,
  onUserSelect,
  placeholder = "Enter username (e.g., @username)",
  disabled = false,
  className = "",
}: UsernameInputProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [suggestions, setSuggestions] = useState<User[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const debouncedQuery = useDebounce(searchQuery, 300);

  // Search users when query changes
  useEffect(() => {
    const searchUsers = async () => {
      if (!debouncedQuery || debouncedQuery.length < 2) {
        setSuggestions([]);
        setShowSuggestions(false);
        return;
      }

      setLoading(true);
      try {
        const response = await fetch(`/api/wallet/search-users?q=${encodeURIComponent(debouncedQuery)}`, {
          credentials: 'include',
        });
        const data = await response.json();
        
        if (data.success && data.data?.users) {
          setSuggestions(data.data.users);
          setShowSuggestions(data.data.users.length > 0);
        } else {
          setSuggestions([]);
          setShowSuggestions(false);
        }
      } catch (error) {
        console.error("Error searching users:", error);
        setSuggestions([]);
        setShowSuggestions(false);
      } finally {
        setLoading(false);
      }
    };

    searchUsers();
  }, [debouncedQuery]);

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setSearchQuery(newValue);
    onChange(newValue);
    
    // Clear selected user if input changes
    if (selectedUser) {
      setSelectedUser(null);
      onUserSelect?.(null);
    }
  };

  // Handle user selection
  const handleUserSelect = (user: User) => {
    setSelectedUser(user);
    setSearchQuery(`@${user.username}`);
    onChange(`@${user.username}`);
    setShowSuggestions(false);
    setSuggestions([]);
    onUserSelect?.(user);
  };

  // Handle clear
  const handleClear = () => {
    setSearchQuery("");
    onChange("");
    setSelectedUser(null);
    setShowSuggestions(false);
    setSuggestions([]);
    onUserSelect?.(null);
    inputRef.current?.focus();
  };

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className={`relative ${className}`}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={searchQuery}
          onChange={handleInputChange}
          onFocus={() => {
            if (suggestions.length > 0) {
              setShowSuggestions(true);
            }
          }}
          placeholder={placeholder}
          disabled={disabled}
          className="w-full pl-10 pr-10 py-2.5 md:py-3 border border-input rounded-lg md:rounded-md bg-background text-foreground text-sm md:text-base focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50 disabled:cursor-not-allowed"
        />
        {searchQuery && !disabled && (
          <button
            onClick={handleClear}
            className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1.5 hover:bg-muted rounded-lg transition-colors"
            aria-label="Clear"
          >
            <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
          </button>
        )}
      </div>

      {/* Suggestions Dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <div
          ref={suggestionsRef}
          className="absolute z-50 w-full mt-1 bg-card border border-border rounded-lg shadow-lg max-h-60 overflow-y-auto"
        >
          {loading && (
            <div className="p-3 text-sm text-muted-foreground text-center">
              Searching...
            </div>
          )}
          {!loading && suggestions.map((user) => (
            <button
              key={user.id}
              onClick={() => handleUserSelect(user)}
              className="w-full flex items-center gap-3 px-3 py-2 hover:bg-muted transition-colors text-left"
            >
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden">
                {user.avatar_url ? (
                  <img
                    src={user.avatar_url}
                    alt={user.username || ""}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <User className="h-4 w-4 text-primary" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm text-foreground truncate">
                  @{user.username}
                </div>
                {user.email && (
                  <div className="text-xs text-muted-foreground truncate">
                    {user.email}
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Selected User Display */}
      {selectedUser && (
        <div className="mt-2 flex items-center gap-2 px-2 py-1.5 bg-primary/10 border border-primary/20 rounded-lg">
          <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center overflow-hidden">
            {selectedUser.avatar_url ? (
              <img
                src={selectedUser.avatar_url}
                alt={selectedUser.username || ""}
                className="w-full h-full object-cover"
              />
            ) : (
              <User className="h-3 w-3 text-primary" />
            )}
          </div>
          <div className="flex flex-col text-xs">
            <span className="font-medium text-primary">
              @{selectedUser.username}
            </span>
            {selectedUser.email && (
              <span className="text-primary/80">{selectedUser.email}</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

