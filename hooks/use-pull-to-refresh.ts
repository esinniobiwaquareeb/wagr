import { useEffect, useRef, useState } from 'react';

interface UsePullToRefreshOptions {
  onRefresh: () => Promise<void> | void;
  threshold?: number; // Distance in pixels to trigger refresh
  disabled?: boolean;
}

interface UsePullToRefreshResult {
  isRefreshing: boolean;
  pullDistance: number;
}

/**
 * Hook for pull-to-refresh functionality on mobile devices
 */
export function usePullToRefresh({
  onRefresh,
  threshold = 80,
  disabled = false,
}: UsePullToRefreshOptions): UsePullToRefreshResult {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  
  const startY = useRef<number>(0);
  const currentY = useRef<number>(0);
  const isPulling = useRef<boolean>(false);
  const elementRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (disabled) return;

    const handleTouchStart = (e: TouchEvent) => {
      const target = e.target as HTMLElement;
      
      // Only trigger if user is at the top of the page
      if (window.scrollY === 0) {
        startY.current = e.touches[0].clientY;
        isPulling.current = true;
        elementRef.current = target;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isPulling.current) return;

      currentY.current = e.touches[0].clientY;
      const distance = currentY.current - startY.current;

      // Only allow downward pull
      if (distance > 0 && window.scrollY === 0) {
        e.preventDefault(); // Prevent default scroll
        const pullDistance = Math.min(distance, threshold * 2);
        setPullDistance(pullDistance);
      }
    };

    const handleTouchEnd = async () => {
      if (!isPulling.current) return;

      const distance = currentY.current - startY.current;

      if (distance >= threshold && !isRefreshing) {
        setIsRefreshing(true);
        setPullDistance(0);
        
        try {
          await onRefresh();
        } catch (error) {
          console.error('Pull to refresh error:', error);
        } finally {
          setIsRefreshing(false);
        }
      } else {
        setPullDistance(0);
      }

      isPulling.current = false;
      startY.current = 0;
      currentY.current = 0;
    };

    document.addEventListener('touchstart', handleTouchStart, { passive: false });
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd);

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [onRefresh, threshold, disabled, isRefreshing]);

  return {
    isRefreshing,
    pullDistance,
  };
}

