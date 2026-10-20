// Performance optimizations for rich content components
import React, { useState, useEffect, useMemo, useCallback, memo } from 'react';

// Virtualized list component for large datasets
export const VirtualizedList: React.FC<{
  items: any[];
  itemHeight: number;
  containerHeight: number;
  renderItem: (item: any, index: number) => React.ReactNode;
  overscan?: number;
}> = memo(({ items, itemHeight, containerHeight, renderItem, overscan = 5 }) => {
  const [scrollTop, setScrollTop] = useState(0);

  const visibleItems = useMemo(() => {
    const startIndex = Math.floor(scrollTop / itemHeight);
    const endIndex = Math.min(
      startIndex + Math.ceil(containerHeight / itemHeight) + overscan,
      items.length
    );
    const visibleStartIndex = Math.max(0, startIndex - overscan);

    return {
      startIndex: visibleStartIndex,
      endIndex,
      items: items.slice(visibleStartIndex, endIndex),
      offsetY: visibleStartIndex * itemHeight
    };
  }, [scrollTop, itemHeight, containerHeight, items, overscan]);

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  return (
    <div
      style={{ height: containerHeight, overflow: 'auto' }}
      onScroll={handleScroll}
    >
      <div style={{ height: items.length * itemHeight, position: 'relative' }}>
        <div style={{ transform: `translateY(${visibleItems.offsetY}px)` }}>
          {visibleItems.items.map((item, index) =>
            renderItem(item, visibleItems.startIndex + index)
          )}
        </div>
      </div>
    </div>
  );
});

VirtualizedList.displayName = 'VirtualizedList';

// Intersection Observer hook for lazy loading
export const useIntersectionObserver = (
  ref: React.RefObject<Element>,
  options: IntersectionObserverInit = {},
  dependencies: any[] = []
) => {
  const [isIntersecting, setIsIntersecting] = useState(false);

  useEffect(() => {
    if (!ref.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsIntersecting(entry.isIntersecting);
      },
      {
        threshold: 0.1,
        rootMargin: '100px',
        ...options
      }
    );

    observer.observe(ref.current);

    return () => observer.disconnect();
  }, [ref, ...dependencies]);

  return isIntersecting;
};

// Lazy loaded component wrapper
export const LazyLoadComponent: React.FC<{
  children: React.ReactNode;
  fallback?: React.ReactNode;
  className?: string;
}> = ({ children, fallback = <div>Loading...</div>, className = "" }) => {
  const ref = React.useRef<HTMLDivElement>(null);
  const isVisible = useIntersectionObserver(ref, { threshold: 0.1 });
  const [hasLoaded, setHasLoaded] = useState(false);

  useEffect(() => {
    if (isVisible && !hasLoaded) {
      setHasLoaded(true);
    }
  }, [isVisible, hasLoaded]);

  return (
    <div ref={ref} className={className}>
      {hasLoaded ? children : fallback}
    </div>
  );
};

// Debounced input hook
export const useDebouncedValue = <T,>(value: T, delay: number): T => {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => clearTimeout(handler);
  }, [value, delay]);

  return debouncedValue;
};

// Memoized decision tree renderer
export const MemoizedDecisionTreeNode: React.FC<{
  node: any;
  level: number;
  onNodeClick?: (nodeId: string) => void;
}> = memo(({ node, level, onNodeClick }) => {
  const handleClick = useCallback(() => {
    if (onNodeClick) {
      onNodeClick(node.id);
    }
  }, [node.id, onNodeClick]);

  return (
    <div
      className={`tree-node level-${level} cursor-pointer`}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick();
        }
      }}
    >
      <div className="node-content p-2 border rounded">
        <div className="node-label font-medium">{node.label}</div>
        {node.action && <div className="node-action text-sm text-ink-2">{node.action}</div>}
        {node.condition && <div className="node-condition text-sm text-info">{node.condition}</div>}
      </div>
    </div>
  );
});

MemoizedDecisionTreeNode.displayName = 'MemoizedDecisionTreeNode';

// Progressive image loading
export const ProgressiveImage: React.FC<{
  src: string;
  placeholder?: string;
  alt: string;
  className?: string;
}> = ({ src, placeholder, alt, className = "" }) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  const handleLoad = useCallback(() => {
    setIsLoaded(true);
  }, []);

  const handleError = useCallback(() => {
    setHasError(true);
  }, []);

  if (hasError) {
    return (
      <div className={`bg-well flex items-center justify-center ${className}`}>
        <span className="text-muted-foreground">Image failed to load</span>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      {placeholder && !isLoaded && (
        <img
          src={placeholder}
          alt=""
          className="absolute inset-0 w-full h-full object-cover filter blur-sm"
        />
      )}
      <img
        src={src}
        alt={alt}
        onLoad={handleLoad}
        onError={handleError}
        className={`w-full h-full object-cover transition-opacity duration-300 ${
          isLoaded ? 'opacity-100' : 'opacity-0'
        }`}
      />
    </div>
  );
};

// Bundle size optimization - dynamic imports
export const loadComponentAsync = (componentPath: string) => {
  return React.lazy(() => import(componentPath));
};

// Performance monitoring hook
export const usePerformanceMonitor = (componentName: string) => {
  const renderStart = useMemo(() => performance.now(), []);
  const [renderTime, setRenderTime] = useState<number | null>(null);

  useEffect(() => {
    const renderEnd = performance.now();
    const duration = renderEnd - renderStart;
    setRenderTime(duration);

    // Log performance metrics in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`[Performance] ${componentName} render time: ${duration.toFixed(2)}ms`);
    }

    // Optional: Send to analytics service
    // analytics.track('component_render_time', { component: componentName, duration });
  }, [componentName, renderStart]);

  return renderTime;
};

// Optimized content renderer with chunking
export const ChunkedContentRenderer: React.FC<{
  content: string;
  chunkSize?: number;
  renderChunk: (chunk: string, index: number) => React.ReactNode;
}> = ({ content, chunkSize = 1000, renderChunk }) => {
  const [visibleChunks, setVisibleChunks] = useState(1);
  
  const chunks = useMemo(() => {
    const result = [];
    for (let i = 0; i < content.length; i += chunkSize) {
      result.push(content.slice(i, i + chunkSize));
    }
    return result;
  }, [content, chunkSize]);

  const loadMoreChunks = useCallback(() => {
    setVisibleChunks(prev => Math.min(prev + 2, chunks.length));
  }, [chunks.length]);

  useEffect(() => {
    // Reset visible chunks when content changes
    setVisibleChunks(1);
  }, [content]);

  return (
    <div>
      {chunks.slice(0, visibleChunks).map((chunk, index) => (
        <div key={index}>{renderChunk(chunk, index)}</div>
      ))}
      
      {visibleChunks < chunks.length && (
        <button
          onClick={loadMoreChunks}
          className="mt-4 px-4 py-2 bg-info text-white rounded hover:bg-info focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        >
          Load More Content ({chunks.length - visibleChunks} chunks remaining)
        </button>
      )}
    </div>
  );
};

// Resource preloader
export const useResourcePreloader = (resources: string[]) => {
  const [loadedResources, setLoadedResources] = useState<Set<string>>(new Set());

  useEffect(() => {
    const loadResource = (url: string) => {
      return new Promise((resolve, reject) => {
        const link = document.createElement('link');
        link.rel = 'preload';
        link.href = url;
        
        if (url.endsWith('.css')) {
          link.as = 'style';
        } else if (url.endsWith('.js')) {
          link.as = 'script';
        } else if (url.match(/\.(jpg|jpeg|png|gif|webp)$/)) {
          link.as = 'image';
        }

        link.onload = () => {
          setLoadedResources(prev => new Set(prev).add(url));
          resolve(url);
        };
        link.onerror = reject;

        document.head.appendChild(link);
      });
    };

    const loadPromises = resources.map(loadResource);
    Promise.allSettled(loadPromises);

    return () => {
      // Cleanup preloaded resources if needed
      resources.forEach(url => {
        const link = document.querySelector(`link[href="${url}"]`);
        if (link && link.parentNode) {
          link.parentNode.removeChild(link);
        }
      });
    };
  }, [resources]);

  return loadedResources;
};

// Memory usage monitor
export const useMemoryMonitor = () => {
  const [memoryInfo, setMemoryInfo] = useState<{
    usedJSHeapSize?: number;
    totalJSHeapSize?: number;
    jsHeapSizeLimit?: number;
  }>({});

  useEffect(() => {
    const updateMemoryInfo = () => {
      if ('memory' in performance) {
        const memory = (performance as any).memory;
        setMemoryInfo({
          usedJSHeapSize: memory.usedJSHeapSize,
          totalJSHeapSize: memory.totalJSHeapSize,
          jsHeapSizeLimit: memory.jsHeapSizeLimit
        });
      }
    };

    updateMemoryInfo();
    const interval = setInterval(updateMemoryInfo, 5000); // Update every 5 seconds

    return () => clearInterval(interval);
  }, []);

  return memoryInfo;
};

export default {
  VirtualizedList,
  useIntersectionObserver,
  LazyLoadComponent,
  useDebouncedValue,
  MemoizedDecisionTreeNode,
  ProgressiveImage,
  loadComponentAsync,
  usePerformanceMonitor,
  ChunkedContentRenderer,
  useResourcePreloader,
  useMemoryMonitor
}; 