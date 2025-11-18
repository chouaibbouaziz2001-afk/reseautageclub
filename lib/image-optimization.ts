export interface ImageOptimizationOptions {
  width?: number;
  height?: number;
  quality?: number;
  format?: 'webp' | 'jpg' | 'png';
}

export function getOptimizedImageUrl(
  url: string | null | undefined,
  options: ImageOptimizationOptions = {}
): string | null {
  if (!url) return null;

  const {
    width,
    height,
    quality = 80,
    format = 'webp'
  } = options;

  if (url.includes('supabase')) {
    let optimizedUrl = url;
    const params: string[] = [];

    if (width) params.push(`width=${width}`);
    if (height) params.push(`height=${height}`);
    if (quality) params.push(`quality=${quality}`);
    if (format) params.push(`format=${format}`);

    if (params.length > 0) {
      const separator = url.includes('?') ? '&' : '?';
      optimizedUrl = `${url}${separator}${params.join('&')}`;
    }

    return optimizedUrl;
  }

  return url;
}

export const IMAGE_SIZES = {
  thumbnail: { width: 150, height: 150 },
  small: { width: 300, height: 300 },
  medium: { width: 600, height: 600 },
  large: { width: 1200, height: 1200 },
  avatar: { width: 80, height: 80 },
  avatarLarge: { width: 200, height: 200 },
  postImage: { width: 800, height: 600 },
  banner: { width: 1200, height: 400 },
};

export function getAvatarUrl(url: string | null | undefined, size: 'small' | 'large' = 'small'): string | null {
  const dimensions = size === 'small' ? IMAGE_SIZES.avatar : IMAGE_SIZES.avatarLarge;
  return getOptimizedImageUrl(url, { ...dimensions, quality: 85 });
}

export function getPostImageUrl(url: string | null | undefined): string | null {
  return getOptimizedImageUrl(url, { ...IMAGE_SIZES.postImage, quality: 80 });
}

export function getThumbnailUrl(url: string | null | undefined): string | null {
  return getOptimizedImageUrl(url, { ...IMAGE_SIZES.thumbnail, quality: 70 });
}

export async function preloadImage(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = reject;
    img.src = url;
  });
}

export function lazyLoadImage(img: HTMLImageElement) {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const target = entry.target as HTMLImageElement;
        const src = target.dataset.src;
        if (src) {
          target.src = src;
          target.removeAttribute('data-src');
        }
        observer.unobserve(target);
      }
    });
  }, {
    rootMargin: '50px'
  });

  observer.observe(img);
}
