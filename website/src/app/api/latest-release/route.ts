import { NextResponse } from 'next/server';

export const runtime = 'edge';
export const revalidate = 300; // Cache for 5 minutes

interface GitHubAsset {
  name: string;
  browser_download_url: string;
  size: number;
}

interface GitHubRelease {
  tag_name: string;
  name: string;
  published_at: string;
  body: string;
  assets: GitHubAsset[];
}

interface ReleaseInfo {
  version: string;
  downloadUrl: string | null;
  publishedAt: string;
  changelog: string;
  fileName: string | null;
  fileSize: number | null;
}

export async function GET() {
  try {
    const response = await fetch(
      'https://api.github.com/repos/florianmahner/amber-sync/releases/latest',
      {
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'Amber-Website',
        },
        next: { revalidate: 300 }, // Cache for 5 minutes
      }
    );

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json(
          {
            error: 'No releases found',
            fallback: true,
            fallbackUrl: 'https://github.com/florianmahner/amber-sync/releases'
          },
          { status: 404 }
        );
      }
      throw new Error(`GitHub API error: ${response.status}`);
    }

    const release: GitHubRelease = await response.json();

    // Find the .dmg file in assets (prefer arm64, fallback to x64)
    const dmgAsset = release.assets.find((asset: GitHubAsset) =>
      asset.name.endsWith('.dmg') && asset.name.includes('arm64')
    ) || release.assets.find((asset: GitHubAsset) =>
      asset.name.endsWith('.dmg')
    );

    const releaseInfo: ReleaseInfo = {
      version: release.tag_name.replace(/^v/, ''), // Remove 'v' prefix
      downloadUrl: dmgAsset?.browser_download_url || null,
      publishedAt: release.published_at,
      changelog: release.body || '',
      fileName: dmgAsset?.name || null,
      fileSize: dmgAsset?.size || null,
    };

    return NextResponse.json(releaseInfo, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      },
    });
  } catch (error) {
    console.error('Error fetching latest release:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch latest release',
        fallback: true,
        fallbackUrl: 'https://github.com/florianmahner/amber-sync/releases'
      },
      { status: 500 }
    );
  }
}
