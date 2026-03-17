'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const tabs = [
  { href: '/ai', label: '오늘 경기', exact: true },
  { href: '/ai/odds-movement', label: '배당 변동', exact: false },
  { href: '/ai/teams', label: '팀 분석', exact: false },
  { href: '/ai/accuracy', label: '정확도', exact: false },
];

export default function AiSubNav() {
  const pathname = usePathname();

  return (
    <div className="border-b border-gray-800 bg-gray-950 px-3 py-1.5 shrink-0">
      <div className="flex items-center gap-0.5">
        {tabs.map((tab) => {
          const isActive = tab.exact ? pathname === tab.href : pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`px-2.5 py-1.5 rounded-md text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-gray-700 text-white'
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
