import { useState, useRef, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Search, X } from "lucide-react"

interface SearchInputProps {
  onSearch: (query: string) => void
  onClose: () => void
  placeholder?: string
  isLoading?: boolean
}

export default function SearchInput({
  onSearch,
  onClose,
  placeholder = "Enter to search",
  isLoading = false
}: SearchInputProps) {
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    // Focus the input when component mounts
    if (inputRef.current) {
      inputRef.current.focus()
    }
  }, [])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && query.trim()) {
      onSearch(query.trim())
    }
    if (e.key === 'Escape') {
      onClose()
    }
  }

  const handleSearch = () => {
    if (query.trim()) {
      onSearch(query.trim())
    }
  }

  return (
    <div className="flex items-center gap-2 w-full p-1">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={isLoading}
          className="pl-10"
        />
      </div>
      <Button
        onClick={onClose}
        size="default"
        variant="ghost"
        className="p-2"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  )
}
