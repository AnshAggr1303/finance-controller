"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Layers,
  AlertTriangle,
  BarChart3,
  User,
} from "lucide-react";
import { ReconLogo } from "../ReconLogo";

const LAST_BATCH_STORAGE_KEY = "reconai:lastActiveBatchId";

function readLastBatchId(): string | null {
  try {
    return window.localStorage.getItem(LAST_BATCH_STORAGE_KEY);
  } catch {
    return null; // private browsing / storage disabled -- fall back to no batch
  }
}

function writeLastBatchId(id: string) {
  try {
    window.localStorage.setItem(LAST_BATCH_STORAGE_KEY, id);
  } catch {
    // ignore -- nothing to persist to, links just won't carry a batch
  }
}

interface SidebarProps {
  // undefined/null means "not known yet" (still loading, or the fetch
  // that would supply it failed) -- never substitute a stale/placeholder
  // number for that. The badge is simply omitted in that case.
  exceptionCount?: number | null;
  // The batch currently being viewed, if any -- carried into every
  // batch-scoped nav link's ?batch= query param so switching screens via
  // the sidebar stays on this batch instead of silently dropping back to
  // each page's own hardcoded default batch. Pages with no single active
  // batch (the Batches list) pass nothing; the last real batch id seen on
  // any other screen is remembered here (per-browser, via localStorage) so
  // passing *through* that page doesn't drop the context either.
  activeBatchId?: string | null;
}

export function Sidebar({ exceptionCount, activeBatchId }: SidebarProps) {
  const hasExceptionCount = typeof exceptionCount === "number";
  const pathname = usePathname();
  const [rememberedBatchId, setRememberedBatchId] = useState<string | null>(null);

  useEffect(() => {
    if (activeBatchId) {
      writeLastBatchId(activeBatchId);
      setRememberedBatchId(activeBatchId);
    } else {
      setRememberedBatchId(readLastBatchId());
    }
  }, [activeBatchId]);

  const effectiveBatchId = activeBatchId ?? rememberedBatchId;
  const batchQuery = effectiveBatchId ? `?batch=${effectiveBatchId}` : "";

  const navItems = [
    {
      name: "Dashboard",
      href: `/${batchQuery}`,
      icon: LayoutDashboard,
      active: pathname === "/" || pathname === "/dashboard",
    },
    {
      name: "Batches",
      href: "/batches",
      icon: Layers,
      active: pathname === "/batches",
    },
    {
      name: "Exception Review",
      href: `/exceptions${batchQuery}`,
      icon: AlertTriangle,
      active: pathname.startsWith("/exceptions") || pathname.startsWith("/review"),
      badge: hasExceptionCount && exceptionCount > 0 ? exceptionCount : undefined,
      badgeColor: "bg-error-container text-on-error-container",
    },
    {
      name: "Scorecard",
      href: `/scorecard${batchQuery}`,
      icon: BarChart3,
      active: pathname === "/scorecard",
    },
  ];

  return (
    <aside className="fixed left-0 top-0 h-screen w-sidebar-width bg-surface-container-lowest z-50 flex flex-col justify-between shadow-[0_1px_8px_rgba(0,0,0,0.04)] border-r border-surface-container">
      <div className="flex flex-col">
        {/* Brand Header */}
        <div className="h-14 px-space-lg flex items-center justify-between border-b border-surface-container-low">
          <div className="flex items-center gap-space-sm">
            <ReconLogo size={28} className="w-7 h-7 rounded-md" />
            <span className="font-semibold text-base text-on-surface tracking-tight">
              ReconAI
            </span>
          </div>
          <span className="font-mono text-[11px] bg-surface-container-high text-on-surface-variant px-1.5 py-0.5 rounded font-medium">
            PROD
          </span>
        </div>

        {/* Navigation Group */}
        <div className="px-space-md py-space-xs mt-2">
          <div className="text-[11px] font-semibold text-on-surface-variant/80 px-space-sm py-space-xs uppercase tracking-wider">
            Navigation
          </div>
          <nav className="flex flex-col gap-1 mt-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                    item.active
                      ? "bg-primary-container text-on-primary-container font-semibold shadow-xs"
                      : "text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface font-medium"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{item.name}</span>
                  </div>
                  {item.badge !== undefined && (
                    <span
                      className={`font-mono text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                        item.active
                          ? "bg-white text-primary"
                          : item.badgeColor || "bg-error-container text-on-error-container"
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Footer Info */}
      <div className="p-3.5 bg-surface-container-low/50 border-t border-surface-container">
        <div className="flex items-center gap-2 mb-2.5">
          <span className="w-2 h-2 rounded-full bg-secondary"></span>
          <span className="font-mono text-[11px] text-on-surface-variant">
            Engine: Online (v2.4.1)
          </span>
        </div>
        <div className="flex items-center justify-between pt-1">
          <div className="flex flex-col min-w-0 pr-2">
            <span className="text-xs text-on-surface font-medium truncate">
              finance-ops
            </span>
            <span className="font-mono text-[11px] text-on-surface-variant truncate">
              recon.internal
            </span>
          </div>
          <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center shrink-0">
            <User className="w-3.5 h-3.5 text-on-primary" />
          </div>
        </div>
      </div>
    </aside>
  );
}
