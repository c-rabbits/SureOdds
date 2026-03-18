'use client';

import { useState, useEffect } from 'react';
import { getTeamLogoUrl, requestTeamLogos } from '@/lib/api';

interface Props {
  teamName: string;
  size?: number;
  className?: string;
}

export default function TeamLogo({ teamName, size = 20, className = '' }: Props) {
  const [logoUrl, setLogoUrl] = useState<string | null>(getTeamLogoUrl(teamName));
  const [error, setError] = useState(false);

  useEffect(() => {
    if (logoUrl || error) return;

    const cached = getTeamLogoUrl(teamName);
    if (cached) {
      setLogoUrl(cached);
      return;
    }

    requestTeamLogos([teamName], () => {
      const url = getTeamLogoUrl(teamName);
      if (url) setLogoUrl(url);
      else setError(true);
    });
  }, [teamName, logoUrl, error]);

  if (!logoUrl || error) return null;

  return (
    <img
      src={logoUrl}
      alt=""
      width={size}
      height={size}
      className={`inline-block object-contain ${className}`}
      onError={() => setError(true)}
      loading="lazy"
    />
  );
}
