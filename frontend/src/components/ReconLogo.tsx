import React from "react";

export function ReconLogo({ className = "w-8 h-8", size = 32 }: { className?: string; size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 32 32"
      width={size}
      height={size}
      fill="none"
      className={className}
    >
      <rect width="32" height="32" rx="6" fill="#0F172A" />
      <path
        d="M8 10h16M8 16h10M8 22h16"
        stroke="#0284C7"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <circle cx="23" cy="16" r="3.5" fill="#10B981" />
    </svg>
  );
}
