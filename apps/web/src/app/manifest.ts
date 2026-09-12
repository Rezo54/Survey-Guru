import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Survey Guru',
    short_name: 'Survey Guru',
    description: 'TES field survey, coverage and outlet intelligence platform.',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#111827',
    orientation: 'any',
    icons: []
  };
}
