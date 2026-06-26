import React from "react";
import { Navigate, Outlet, useLocation } from "react-router";
import { useAtom } from "jotai";
import { appPage } from "@/store/jotai.ts";
import { LOGIN, MENU } from "@/routes/posr.ts";
import { getUserModules } from "@/lib/access.rules.ts";

const ROUTE_MODULE_MAPPING: Record<string, string> = {
  '/menu': 'Menu',
  '/orders': 'Orders',
  '/summary': 'Summary',
  '/closing': 'Closing',
  '/kitchen': 'Kitchen',
  '/delivery': 'Delivery',
  '/online-orders': 'Delivery',
  '/admin': 'Admin',
  '/settings': 'Settings',
  '/inventory': 'Inventory',
  '/tip-distribution': 'Tips',
};

export const ProtectedRoute: React.FC = () => {
  const [pageState] = useAtom(appPage);
  const location = useLocation();

  if (!pageState.user || pageState.locked) {
    // Redirect to login if user is not authenticated or screen is locked
    return <Navigate to={LOGIN} replace />;
  }

  const userModules = getUserModules(pageState.user);
  const path = location.pathname;

  let requiredModule: string | undefined = undefined;
  if (path.startsWith('/reports')) {
    requiredModule = 'Reports';
  } else {
    const matchedRoute = Object.keys(ROUTE_MODULE_MAPPING).find(r => path === r);
    if (matchedRoute) {
      requiredModule = ROUTE_MODULE_MAPPING[matchedRoute];
    }
  }

  if (requiredModule && !userModules.includes(requiredModule)) {
    if (userModules.includes('Menu')) {
      return <Navigate to={MENU} replace />;
    }
    return <Navigate to={LOGIN} replace />;
  }

  return <Outlet />;
};


