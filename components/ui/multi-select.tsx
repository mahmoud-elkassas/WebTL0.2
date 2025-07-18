"use client";

import * as React from "react";
import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Command, CommandGroup, CommandItem } from "@/components/ui/command";
import { Command as CommandPrimitive } from "cmdk";

interface MultiSelectProps {
  options: { label: string; value: string }[];
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
  className?: string;
}

export function MultiSelect({
  options,
  selected,
  onChange,
  placeholder = "Select...",
  className,
}: MultiSelectProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [open, setOpen] = React.useState(false);
  const [inputValue, setInputValue] = React.useState("");

  const handleUnselect = (item: string) => {
    onChange(selected.filter((i) => i !== item));
  };

  const handleSelect = (item: string) => {
    onChange([...selected, item]);
    setInputValue("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const input = inputRef.current;
    if (input) {
      if (e.key === "Delete" || e.key === "Backspace") {
        if (input.value === "" && selected.length > 0) {
          onChange(selected.slice(0, -1));
        }
      }
      if (e.key === "Escape") {
        input.blur();
      }
    }
  };

  const selectables = options.filter(
    (option) => !selected.includes(option.value)
  );

  return (
    <div className={`relative ${className}`}>
      <div
        className="flex flex-wrap items-center gap-1 p-1.5 border rounded-md bg-background"
        tabIndex={0}
        onClick={() => {
          inputRef.current?.focus();
        }}
      >
        {selected.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {selected.map((item) => (
              <Badge
                key={item}
                variant="secondary"
                className="flex items-center gap-1"
              >
                {options.find((option) => option.value === item)?.label || item}
                <button
                  type="button"
                  className="ml-1 rounded-full outline-none"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleUnselect(item);
                  }}
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
        <CommandPrimitive onKeyDown={handleKeyDown}>
          <div className="flex flex-1">
            <input
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              className="flex-1 bg-transparent px-1 py-1 outline-none text-sm placeholder:text-muted-foreground"
              placeholder={selected.length === 0 ? placeholder : ""}
              onFocus={() => setOpen(true)}
              onBlur={() => setOpen(false)}
            />
          </div>
        </CommandPrimitive>
      </div>
      <div className="relative mt-1">
        {open && (
          <div className="absolute w-full z-10 top-0 rounded-md border bg-popover text-popover-foreground shadow-md outline-none animate-in">
            <Command className="overflow-visible">
              <CommandGroup className="h-full overflow-auto max-h-52">
                {selectables.length > 0 ? (
                  selectables.map((option) => (
                    <CommandItem
                      key={option.value}
                      className="px-2 py-1.5 text-sm cursor-pointer"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                      onSelect={() => handleSelect(option.value)}
                    >
                      {option.label}
                    </CommandItem>
                  ))
                ) : (
                  <p className="px-2 py-1.5 text-sm text-muted-foreground">
                    No options left
                  </p>
                )}
              </CommandGroup>
            </Command>
          </div>
        )}
      </div>
    </div>
  );
}
