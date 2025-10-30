'use client';

import Link from 'next/link';
import { useLocale } from '@/lib/context/LocaleContext';

export function AppFooter() {
  const { dictionary } = useLocale();
  const { brand, navigation } = dictionary.common;

  return (
    <footer className="border-t border-white/70 bg-white/80 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-6 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <p className="text-center sm:text-left">{brand.credit}</p>
        <div className="flex items-center justify-center gap-4 text-xs text-slate-500">
          <Link href="/seed" className="transition hover:text-indigo-600">
            {navigation.seed}
          </Link>
          <span aria-hidden="true">•</span>
          <Link href="/interview" className="transition hover:text-indigo-600">
            {navigation.interview}
          </Link>
          <span aria-hidden="true">•</span>
          <Link href="/dashboard" className="transition hover:text-indigo-600">
            {navigation.dashboard}
          </Link>
        </div>
      </div>
    </footer>
  );
}
