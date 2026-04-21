import { useState, useRef, useEffect } from "react";
import type { AccountWithUsage } from "../types";
import { UsageBar } from "./UsageBar";
import { Check, Zap, RefreshCw, Trash2, Eye, EyeOff } from "lucide-react";

interface AccountCardProps {
  account: AccountWithUsage;
  onSwitch: () => void;
  onWarmup: () => Promise<void>;
  onDelete: () => void;
  onRefresh: () => Promise<void>;
  onRename: (newName: string) => Promise<void>;
  switching?: boolean;
  switchDisabled?: boolean;
  warmingUp?: boolean;
  masked?: boolean;
  onToggleMask?: () => void;
}

function formatLastRefresh(date: Date | null): string {
  if (!date) return "Never";
  const now = new Date();
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (diff < 5) return "Just now";
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return date.toLocaleDateString();
}

function BlurredText({ children, blur }: { children: React.ReactNode; blur: boolean }) {
  return (
    <span
      className={`transition-all duration-200 select-none ${blur ? "blur-sm" : ""}`}
      style={blur ? { userSelect: "none" } : undefined}
    >
      {children}
    </span>
  );
}

export function AccountCard({
  account,
  onSwitch,
  onWarmup,
  onDelete,
  onRefresh,
  onRename,
  switching,
  switchDisabled,
  warmingUp,
  masked = false,
  onToggleMask,
}: AccountCardProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(
    account.usage && !account.usage.error ? new Date() : null
  );
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(account.name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await onRefresh();
      setLastRefresh(new Date());
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleRename = async () => {
    const trimmed = editName.trim();
    if (trimmed && trimmed !== account.name) {
      try {
        await onRename(trimmed);
      } catch {
        setEditName(account.name);
      }
    } else {
      setEditName(account.name);
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleRename();
    } else if (e.key === "Escape") {
      setEditName(account.name);
      setIsEditing(false);
    }
  };

  const planDisplay = account.plan_type
    ? account.plan_type.charAt(0).toUpperCase() + account.plan_type.slice(1)
    : account.auth_mode === "api_key"
      ? "API Key"
      : "Unknown";

  const planColors: Record<string, string> = {
    pro: "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-700",
    plus: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-700",
    team: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700",
    enterprise: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700",
    free: "bg-gray-50 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700",
    api_key: "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-700",
  };

  const planKey = account.plan_type?.toLowerCase() || "api_key";
  const planColorClass = planColors[planKey] || planColors.free;


  return (
    <div
      className={`relative rounded-xl border p-5 transition-all duration-200 flex flex-col h-full min-h-[260px] ${
        account.is_active
          ? "bg-claude-card dark:bg-claude-card-dark border-claude-accent shadow-sm"
          : "bg-claude-card dark:bg-claude-card-dark border-black/10 dark:border-white/10 hover:border-black/20 dark:hover:border-white/20"
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {account.is_active && (
              <span className="flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
              </span>
            )}
            {isEditing ? (
              <input
                ref={inputRef}
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onBlur={handleRename}
                onKeyDown={handleKeyDown}
                className="font-semibold text-gray-900 dark:text-gray-100 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded border border-gray-300 dark:border-gray-700 focus:outline-none focus:border-gray-500 dark:focus:border-gray-500 w-full"
              />
            ) : (
              <h3
                className="font-semibold text-claude-text dark:text-claude-text-dark truncate cursor-pointer hover:opacity-70"
                onClick={() => {
                  if (masked) return;
                  setEditName(account.name);
                  setIsEditing(true);
                }}
                title={masked ? undefined : "Click to rename"}
              >
                <BlurredText blur={masked}>{account.name}</BlurredText>
              </h3>
            )}
          </div>
          {account.email && (
            <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
              <BlurredText blur={masked}>{account.email}</BlurredText>
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Eye toggle */}
          {onToggleMask && (
            <button
              onClick={onToggleMask}
              className="p-1 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              title={masked ? "Show info" : "Hide info"}
            >
              {masked ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </button>
          )}
          {/* Plan badge */}
          <span
            className={`px-2.5 py-1 text-xs font-medium rounded-full border ${planColorClass}`}
          >
            {planDisplay}
          </span>
        </div>
      </div>

      {/* Usage */}
      <div className="mb-3">
        <UsageBar usage={account.usage} loading={isRefreshing || account.usageLoading} />
      </div>

      {/* Last refresh time */}
      <div className="text-xs text-gray-400 dark:text-gray-500 mb-3">
        Last updated: {formatLastRefresh(lastRefresh)}
      </div>

      {/* Actions */}
      <div className="flex gap-2 mt-auto pt-4">
        {account.is_active ? (
          <button
            disabled
            className="flex-1 px-4 py-2 text-sm font-medium rounded-lg bg-black/5 dark:bg-white/5 text-black/40 dark:text-white/40 border border-transparent cursor-default flex items-center justify-center gap-1.5"
          >
            <Check className="w-4 h-4" /> Active
          </button>
        ) : (
          <button
            onClick={onSwitch}
            disabled={switching || switchDisabled}
            className={`flex-1 px-4 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center ${
              switchDisabled
                ? "bg-black/5 dark:bg-white/5 text-black/40 dark:text-white/40 cursor-not-allowed"
                : "bg-claude-text text-claude-bg hover:bg-claude-text/90 dark:bg-claude-text-dark dark:text-claude-bg-dark dark:hover:bg-white/90"
            }`}
            title={switchDisabled ? "Close all Codex processes first" : undefined}
          >
            {switching ? "Switching..." : switchDisabled ? "Codex Running" : "Switch"}
          </button>
        )}
        <button
          onClick={() => {
            void onWarmup();
          }}
          disabled={warmingUp}
          className={`px-3 py-2 flex items-center justify-center text-sm rounded-lg transition-colors ${
            warmingUp
              ? "bg-claude-accent/20 text-claude-accent"
              : "bg-claude-accent/10 hover:bg-claude-accent/20 text-claude-accent"
          }`}
          title={warmingUp ? "Sending warm-up request..." : "Send minimal warm-up request"}
        >
          <Zap className={`w-4 h-4 ${warmingUp ? "animate-pulse" : ""}`} />
        </button>
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className={`px-3 py-2 flex items-center justify-center text-sm rounded-lg transition-colors ${
            isRefreshing
              ? "bg-black/5 dark:bg-white/5 text-black/40 dark:text-white/40"
              : "bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-claude-text dark:text-claude-text-dark"
          }`}
          title="Refresh usage"
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`} />
        </button>
        <button
          onClick={onDelete}
          className="px-3 py-2 flex items-center justify-center text-sm rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 transition-colors"
          title="Remove account"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
