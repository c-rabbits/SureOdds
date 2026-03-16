'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const tabs = [
  { href: '/ai', label: '오늘 경기', exact: true },
  { href: '/ai/odds-movement', label: '배당 변동', exact: false },
  { href: '/ai/teams', label: '팀 분석', exact: false },
];

export default function AiSubNav() {
  const pathname = usePathname();

  return (
    <div className="border-b border-gray-800 bg-gray-900/50 px-4 py-1.5 shrink-0">
      <div className="flex items-center gap-1">
        {tabs.map((tab) => {
          const isActive = tab.exact ? pathname === tab.href : pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                isActive
                  ? 'bg-purple-600/20 text-purple-400 border border-purple-500/30'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800/60'
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
