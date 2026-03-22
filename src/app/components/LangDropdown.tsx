'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { SUPPORTED_LANGUAGES, LANG_CONFIG } from '@/lib/i18n';
import type { SupportedLang } from '@/lib/types';

export default function LangDropdown({ currentLang, currentPath }: { currentLang: SupportedLang; currentPath?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Replace current lang in path with new lang
  function getLangPath(lang: SupportedLang) {
    if (!currentPath || currentPath === '/') return `/${lang}`;
    // Replace /ko/... with /lang/...
    const pathWithoutLang = currentPath.replace(/^\/[a-z]{2}(-[A-Z]{2})?/, '');
    return `/${lang}${pathWithoutLang}`;
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="text-gray-400 hover:text-gray-600 text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 transition-colors"
      >
        {LANG_CONFIG[currentLang].nativeName}
        <svg className="inline-block ml-1 w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={open ? "M5 15l7-7 7 7" : "M19 9l-7 7-7-7"} />
        </svg>
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1.5 bg-white border border-gray-200 rounded-xl shadow-xl py-1.5 z-50 min-w-[160px] max-h-[320px] overflow-y-auto">
          {SUPPORTED_LANGUAGES.map(sl => (
            <Link
              key={sl}
              href={getLangPath(sl)}
              onClick={() => setOpen(false)}
              className={`block px-3 py-2 text-xs transition-colors ${
                sl === currentLang ? 'text-blue-600 bg-blue-50 font-medium' : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              {LANG_CONFIG[sl].nativeName}
              {sl !== currentLang && <span className="ml-2 text-gray-400">{LANG_CONFIG[sl].name}</span>}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
