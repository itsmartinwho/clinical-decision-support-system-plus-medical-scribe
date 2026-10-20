import React, { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { supabaseDataService } from "@/lib/supabaseDataService";
import type { Patient, Diagnosis, Treatment } from "@/lib/types";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { createPortal } from "react-dom";
import Image from "next/image";

type MatchKind =
  | "name"
  | "reason"
  | "diagnosis"
  | "treatment"
  | "lab";

interface SearchResult {
  patient: Patient;
  snippet?: string; // undefined for name matches
  kind: MatchKind;
  encounterId?: string; // Needed for consult-specific navigation (future)
}

interface QuickSearchProps {
  /** Wrapper className */
  className?: string;
  /** Additional className passed to the underlying Input */
  inputClassName?: string;
  /** Optional dropdown class override (e.g., for sidebar) */
  dropdownClassName?: string;
  /** Render dropdown in a portal to avoid clipping (e.g., inside sidebar) */
  portal?: boolean;
}

/**
 * Lightweight search box that queries the in-memory patient cache (or Supabase)
 * and surfaces up to 10 matching patients in a floating list. Clicking a result
 * navigates to that patient's workspace at /patients/[id].
 *
 * Future iterations can switch the query source to the dedicated Supabase RPC
 * without changing the component surface.
 */
export default function QuickSearch({ className, inputClassName, dropdownClassName, portal }: QuickSearchProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [portalStyle, setPortalStyle] = useState<React.CSSProperties | null>(null);

  const calcWidth = (rect: DOMRect) => {
    // Make dropdown width same as input container width
    return rect.width;
  };

  // Debounce the query input ~300 ms
  useEffect(() => {
    const handler = setTimeout(async () => {
      const q = query.trim();
      if (q.length < 3) {
        setResults([]);
        return;
      }
      // Ensure data is loaded; noop if already loaded
      try {
        await supabaseDataService.loadPatientData();
      } catch (_) {
        /* load errors are logged inside the service */
      }
      const lower = q.toLowerCase();
      const matches: SearchResult[] = [];

      const allPatients = supabaseDataService.getAllPatients();

      const addIfNotExceeded = (res: SearchResult) => {
        if (matches.length < 10) matches.push(res);
      };

      const buildSnippet = (raw: string): string => {
        const words = raw.split(/\s+/);
        const idx = words.findIndex((w) => w.toLowerCase().includes(lower));
        if (idx === -1) return raw.slice(0, 50); // fallback
        // Increase context to 4 words before and after
        const start = Math.max(0, idx - 4);
        const end = Math.min(words.length, idx + 5); // idx + 4 words + the match itself
        return words.slice(start, end).join(" ");
      };

      allPatients.forEach((p) => {
        if (matches.length >= 10) return;

        const fullName = (p.name || "").toLowerCase();
        const first = (p.firstName || "").toLowerCase();
        const last = (p.lastName || "").toLowerCase();

        // 1) Name match – highest priority, show only once per patient.
        if (
          fullName.includes(lower) ||
          first.includes(lower) ||
          last.includes(lower)
        ) {
          addIfNotExceeded({ patient: p, kind: "name" });
          return; // Skip deeper search to avoid duplicate entries.
        }

        // 2) Patient-level diagnosis fields - removed as these are now in conditions table

        if (matches.length >= 10) return;

        // 3) Deep search in encounters / diagnoses / treatments.
        const encounters = supabaseDataService.getPatientEncounters(p.id);
        for (const enc of encounters) {
          if (matches.length >= 10) break;

          // Reason (Consultation tab)
          const reasonText = enc.reasonDisplayText || enc.reasonCode;
          if (reasonText && reasonText.toLowerCase().includes(lower)) {
            addIfNotExceeded({
              patient: p,
              kind: "reason",
              encounterId: enc.id,
              snippet: buildSnippet(reasonText),
            });
          }

          // Diagnoses (Diagnosis tab)
          const key = `${p.id}_${enc.id}`;
          // const diagMap = (supabaseDataService as any).allDiagnosesByAdmission;
          // const diagnoses: Diagnosis[] = diagMap ? diagMap[key] || [] : [];
          // for (const dx of diagnoses) {
          //   if (dx.description && dx.description.toLowerCase().includes(lower)) {
          //     addIfNotExceeded({
          //       patient: p,
          //       kind: "diagnosis",
          //       encounterId: enc.id,
          //       snippet: buildSnippet(dx.description),
          //     });
          //     break;
          //   }
          // }

          // Treatments (Treatment tab)
          const treatments: Treatment[] = enc.treatments || [];
          for (const t of treatments) {
            if (t.drug && t.drug.toLowerCase().includes(lower)) {
              addIfNotExceeded({
                patient: p,
                kind: "treatment",
                encounterId: enc.id,
                snippet: buildSnippet(t.drug),
              });
              break;
            }
          }
        }
      });

      setResults(matches);
      setIsOpen(true);
      // compute dropdown position if portal mode
      if (portal && containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        
        const dropdownEffectiveWidth = calcWidth(rect); // Width determined by input container

        // Align left edge of dropdown with left edge of input container
        let newLeft = rect.left;
        
        const margin = 8; // Screen edge margin

        // Ensure it doesn't go off-screen to the left (should be redundant if input is on screen)
        newLeft = Math.max(margin, newLeft);

        // Ensure it doesn't go off-screen to the right
        if (newLeft + dropdownEffectiveWidth + margin > window.innerWidth) {
          // If it would go off-screen, align to the right edge of the screen with margin
          newLeft = window.innerWidth - dropdownEffectiveWidth - margin;
        }
        
        setPortalStyle({
          position: "fixed",
          top: rect.bottom + 4,
          left: newLeft,
          width: dropdownEffectiveWidth, // Set the width directly
          zIndex: 9999,
        });
      }
    }, 300);
    return () => clearTimeout(handler);
  }, [query, portal]);

  // Recompute when data service emits changes
  useEffect(() => {
    const cb = () => {
      if (query.trim().length >= 3) {
        setQuery((q) => q + ""); // trigger debounce effect
      }
    };
    supabaseDataService.subscribe(cb);
    return () => supabaseDataService.unsubscribe(cb);
  }, [query]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node) &&
        dropdownRef.current && // Check dropdown ref
        !dropdownRef.current.contains(e.target as Node) // If click is also outside dropdown
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleSelect = (res: SearchResult) => {
    let url = `/patients/${res.patient.id}`;
    if (res.kind === "diagnosis") url += "?tab=diagnosis";
    else if (res.kind === "treatment") url += "?tab=treatment";
            else if (res.kind === "reason") url += "?tab=consultation";
    // name matches keep default (consult)
    router.push(url);
    setQuery("");
    setIsOpen(false);
  };

  // New component for rendering each row
  const SearchResultRow = ({ result, query, onSelect }: { result: SearchResult; query: string; onSelect: (res: SearchResult) => void }) => {
    const [imageError, setImageError] = useState(false);

    const handleImageError = () => {
      setImageError(true);
    };

    return (
      <button
        key={result.patient.id} // Use a stable key like patient.id
        type="button"
        onClick={() => onSelect(result)}
        className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-well focus:bg-well focus:outline-none"
      >
        {result.patient.photo && !imageError ? (
          <Image
            src={result.patient.photo}
            alt={result.patient.name || "Patient photo"}
            width={24}
            height={24}
            className="rounded-full"
            onError={handleImageError}
          />
        ) : (
          <div className="h-6 w-6 rounded-full bg-ink flex items-center justify-center text-xs font-medium text-white">
            {(result.patient.firstName?.charAt(0) || "").toUpperCase()}
            {(result.patient.lastName?.charAt(0) || "").toUpperCase() || "?"}
          </div>
        )}
        <div className="flex-1 text-left whitespace-nowrap overflow-hidden text-ellipsis">
          {result.patient.name || result.patient.id}
          {result.kind !== "name" && result.snippet && (
            <>
              {" "}
              <span className="opacity-60">
                &gt; {highlightSnippet(result.snippet, query.trim().toLowerCase())}
              </span>
            </>
          )}
        </div>
      </button>
    );
  };

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <Input
        placeholder="Quick search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className={cn("placeholder:text-muted-foreground", inputClassName)}
        onFocus={() => {
          if (results.length > 0) setIsOpen(true);
        }}
      />
      {isOpen && (
        (!portal ? (
          <div
            ref={dropdownRef}
            className={cn(
              "absolute left-0 mt-1 max-h-80 overflow-auto z-50 rounded-xl bg-[rgba(255,255,255,0.55)] border border-border shadow-lg animate-fade-in-down",
              dropdownClassName
            )}
          >
            {results.length === 0 && query.trim().length >= 3 && (
              <div className="px-3 py-2 text-sm text-muted-foreground">No matches found</div>
            )}
            {results.map((r, idx) => (
              <SearchResultRow key={r.patient.id + '-' + idx} result={r} query={query} onSelect={handleSelect} />
            ))}
          </div>
        ) : createPortal(
          <div
            ref={dropdownRef}
            style={portalStyle || {}}
            className={cn(
              "max-h-80 overflow-auto rounded-xl bg-[rgba(255,255,255,0.55)] border border-border shadow-lg animate-fade-in-down",
              dropdownClassName
            )}
          >
            {results.length === 0 && query.trim().length >= 3 && (
              <div className="px-3 py-2 text-sm text-muted-foreground">No matches found</div>
            )}
            {results.map((r, idx) => (
               <SearchResultRow key={r.patient.id + '-' + idx} result={r} query={query} onSelect={handleSelect} />
            ))}
          </div>, document.body)
        )
      )}
    </div>
  );
}

// helper to bold the search term within snippet
function highlightSnippet(snippet: string, term: string) {
  const regex = new RegExp(`(${term})`, "ig");
  const parts = snippet.split(regex);
  return (
    <>
      {parts.map((part, idx) =>
        regex.test(part) ? (
          <span key={idx} className="font-semibold text-foreground">
            {part}
          </span>
        ) : (
          <span key={idx}>{part}</span>
        )
      )}
    </>
  );
} 