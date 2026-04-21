import { useState, useEffect } from "react";
import { RefreshCw } from "lucide-react";

interface RefreshCountdownButtonProps {
  onRefresh: () => Promise<void>;
  isRefreshing: boolean;
}

export function RefreshCountdownButton({
  onRefresh,
  isRefreshing,
}: RefreshCountdownButtonProps) {
  const [refreshCountdown, setRefreshCountdown] = useState(30);

  useEffect(() => {
    let isSubscribed = true;
    let countdownInterval: ReturnType<typeof setInterval> | undefined;

    const startCountdown = () => {
      if (countdownInterval) clearInterval(countdownInterval);
      setRefreshCountdown(30);

      countdownInterval = setInterval(() => {
        setRefreshCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(countdownInterval);
            poll();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    };

    const poll = async () => {
      if (!isSubscribed) return;
      try {
        await onRefresh();
      } catch (err) {
        // ignore auto-refresh errors
      }
      if (!isSubscribed) return;
      startCountdown();
    };

    // Note: We don't call poll() immediately here because App.tsx 
    // does the initial loadAccounts() -> refreshUsage() on mount.
    // We just start the 30s timer.
    startCountdown();

    return () => {
      isSubscribed = false;
      if (countdownInterval) clearInterval(countdownInterval);
    };
  }, [onRefresh]);

  return (
    <button
      onClick={() => {
        setRefreshCountdown(30);
        void onRefresh();
      }}
      disabled={isRefreshing}
      className={`relative flex h-10 w-10 items-center justify-center rounded-lg ${
        isRefreshing
          ? "bg-black/10 dark:bg-white/10"
          : "bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10"
      } text-claude-text transition-colors disabled:opacity-50 dark:text-claude-text-dark shrink-0 overflow-hidden group`}
      title={
        isRefreshing
          ? "Refreshing all usage"
          : `Refresh all usage (${refreshCountdown}s)`
      }
    >
      <div
        className={`absolute bottom-0 left-0 h-[3px] bg-claude-accent/80 dark:bg-claude-accent/80 ${
          isRefreshing ? "w-full animate-pulse" : "transition-all duration-1000 ease-linear"
        }`}
        style={{
          width: isRefreshing
            ? "100%"
            : `${((30 - refreshCountdown) / 30) * 100}%`,
        }}
      />
      <span
        className={`relative z-10 ${
          isRefreshing
            ? "animate-spin inline-block"
            : "group-hover:rotate-180 transition-transform duration-500"
        }`}
      >
        <RefreshCw className="w-4 h-4" />
      </span>
    </button>
  );
}
