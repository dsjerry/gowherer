import { useCallback, useEffect, useRef, useState } from 'react';

import { NearbyPlace } from '@/lib/reverse-geocode';

const SEARCH_DEBOUNCE_MS = 450;

/**
 * 地点搜索输入状态（带防抖）。
 * `search` 由调用方注入，便于复用不同的地点搜索实现（高德 / 后端代理）。
 */
export function usePlaceSearch(search: (keyword: string) => Promise<NearbyPlace[]>) {
  const [keyword, setKeyword] = useState('');
  const [results, setResults] = useState<NearbyPlace[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [failed, setFailed] = useState(false);
  const searchRef = useRef(search);
  searchRef.current = search;

  useEffect(() => {
    const trimmed = keyword.trim();
    if (!trimmed) {
      setResults(null);
      setSearching(false);
      setFailed(false);
      return;
    }

    let active = true;
    setSearching(true);
    setFailed(false);
    const timer = setTimeout(() => {
      searchRef
        .current(trimmed)
        .then((list) => {
          if (!active) return;
          setResults(list);
          setSearching(false);
        })
        .catch(() => {
          if (!active) return;
          setResults([]);
          setSearching(false);
          setFailed(true);
        });
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [keyword]);

  const reset = useCallback(() => {
    setKeyword('');
    setResults(null);
    setSearching(false);
    setFailed(false);
  }, []);

  return {
    keyword,
    setKeyword,
    results,
    searching,
    failed,
    reset,
  };
}
