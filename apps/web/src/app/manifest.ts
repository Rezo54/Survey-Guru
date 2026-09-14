import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Survey Guru',
    short_name: 'Survey Guru',
    description: 'TES field survey, coverage and outlet intelligence platform.',
    start_url: '/',
    display: 'standalone',
    background_color: '#07131f',
    theme_color: '#07131f',
    orientation: 'any',
    icons: [
      {
        src: '/survey-guru-icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any'
      }
    ]
  };
}
