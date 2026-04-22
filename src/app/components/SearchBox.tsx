'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function SearchBox({
  lang,
  category,
  initialQuery = '',
  placeholder,
  ariaLabel,
}: {
  lang: string;
  category: string;
  initialQuery?: string;
  placeholder: string;
  ariaLabel: string;
}) {
  const router = useRouter();
  const [value, setValue] = useState(initialQuery);

  const submit = (e: { preventDefault: () => void }) => {
    e.preventDefault();
    const q = value.trim();
    const base = `/${lang}/${category}`;
    router.push(q ? `${base}?q=${encodeURIComponent(q)}` : base);
  };

  function clear() {
    setValue('');
    router.push(`/${lang}/${category}`);
  }

  return (
    <form onSubmit={submit} className="relative mb-6" role="search">
      <input
        type="search"
        value={value}
        onChange={e => setValue(e.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel}
        className="w-full border border-gray-300 rounded-xl pl-11 pr-24 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      />
      <svg
        className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M11 18a7 7 0 110-14 7 7 0 010 14z" />
      </svg>
      {value && (
        <button
          type="button"
          onClick={clear}
          className="absolute right-20 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs"
          aria-label="Clear"
        >
          &#10005;
        </button>
      )}
      <button
        type="submit"
        className="absolute right-2 top-1/2 -translate-y-1/2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg px-3 py-1.5 transition-colors"
      >
        {ariaLabel}
      </button>
    </form>
  );
}
