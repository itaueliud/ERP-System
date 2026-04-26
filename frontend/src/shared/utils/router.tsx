/**
 * Minimal client-side router — replaces react-router-dom dependency
 * Supports: useNavigate, useLocation, Routes, Route, Navigate, BrowserRouter, Link
 */
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

interface RouterContextValue {
  pathname: string;
  state: any;
  navigate: (to: string, opts?: { replace?: boolean; state?: any }) => void;
}

const RouterContext = createContext<RouterContextValue>({
  pathname: window.location.pathname,
  state: null,
  navigate: () => {},
});

export function BrowserRouter({ children }: { children: React.ReactNode }) {
  const [pathname, setPathname] = useState(window.location.pathname);
  const [state, setState] = useState<any>(null);

  useEffect(() => {
    const handler = () => {
      setPathname(window.location.pathname);
      setState((window.history.state as any)?.usr ?? null);
    };
    window.addEventListener('popstate', handler);
    return () => window.removeEventListener('popstate', handler);
  }, []);

  const navigate = useCallback((to: string, opts?: { replace?: boolean; state?: any }) => {
    const histState = { usr: opts?.state };
    if (opts?.replace) {
      window.history.replaceState(histState, '', to);
    } else {
      window.history.pushState(histState, '', to);
    }
    setPathname(to);
    setState(opts?.state ?? null);
  }, []);

  return (
    <RouterContext.Provider value={{ pathname, state, navigate }}>
      {children}
    </RouterContext.Provider>
  );
}

export function useNavigate() {
  return useContext(RouterContext).navigate;
}

export function useLocation() {
  const { pathname, state } = useContext(RouterContext);
  return { pathname, state };
}

interface RouteProps {
  path: string;
  element: React.ReactNode;
}

interface RoutesProps {
  children: React.ReactNode;
}

export function Routes({ children }: RoutesProps) {
  const { pathname } = useContext(RouterContext);

  const routes: RouteProps[] = [];
  React.Children.forEach(children, (child) => {
    if (React.isValidElement(child) && child.props.path) {
      routes.push(child.props as RouteProps);
    }
  });

  // Find matching route (exact match first, then wildcard prefix, then catch-all)
  const match = routes.find((r) => {
    if (r.path === '*') return false;
    if (r.path === pathname) return true;
    // Handle trailing slash
    if (r.path.replace(/\/$/, '') === pathname.replace(/\/$/, '')) return true;
    // Wildcard prefix match: "/foo/*" matches "/foo", "/foo/", "/foo/bar/baz"
    if (r.path.endsWith('/*')) {
      const prefix = r.path.slice(0, -2); // strip "/*"
      return prefix === '' || pathname === prefix || pathname.startsWith(prefix + '/');
    }
    return false;
  }) ?? routes.find((r) => r.path === '*');

  return <>{match?.element ?? null}</>;
}

export function Route({ element }: RouteProps) {
  return <>{element}</>;
}

export function Navigate({ to, replace, state }: { to: string; replace?: boolean; state?: any }) {
  const navigate = useNavigate();
  useEffect(() => {
    navigate(to, { replace, state });
  }, [navigate, to, replace, state]);
  return null;
}

export function Link({ to, children, className, onClick }: { to: string; children: React.ReactNode; className?: string; onClick?: () => void }) {
  const navigate = useNavigate();
  return (
    <a href={to} className={className}
      onClick={(e) => { e.preventDefault(); onClick?.(); navigate(to); }}>
      {children}
    </a>
  );
}

export function Suspense({ children, fallback }: { children: React.ReactNode; fallback: React.ReactNode }) {
  return <React.Suspense fallback={fallback}>{children}</React.Suspense>;
}
