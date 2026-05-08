"use client";

import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type BeforeInstallPromptChoice = {
  outcome: "accepted" | "dismissed";
  platform: string;
};

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<BeforeInstallPromptChoice>;
};

function isStandaloneDisplay() {
  const navigatorWithStandalone = window.navigator as Navigator & {
    standalone?: boolean;
  };

  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches ||
    window.matchMedia("(display-mode: minimal-ui)").matches ||
    navigatorWithStandalone.standalone === true
  );
}

export function useInstallAppPrompt() {
  const [installPrompt, setInstallPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setInstallPrompt(null);
      setIsInstalled(true);
      toast.success("Aplikasi berhasil dipasang.");
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt,
      );
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const isStandalone =
    typeof window !== "undefined" ? isStandaloneDisplay() : false;

  const canInstall = Boolean(installPrompt) && !isInstalled && !isStandalone;

  const handleInstall = async () => {
    if (!installPrompt) {
      return;
    }

    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;

    setInstallPrompt(null);

    if (choice.outcome === "accepted") {
      toast.success("Aplikasi sedang dipasang.");
      return;
    }

    toast.info("Pemasangan aplikasi dibatalkan.");
  };

  return {
    canInstall,
    installApp: handleInstall,
  };
}

type InstallAppButtonProps = {
  className?: string;
  iconClassName?: string;
  onClick: () => Promise<void> | void;
};

export function InstallAppAction({
  className,
  iconClassName,
  onClick,
}: InstallAppButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-start gap-3 rounded px-3 py-3 text-left transition-colors",
        "text-[#36342e] hover:bg-[#eceae3] hover:text-[#201515]",
        className,
      )}
    >
      <Download
        className={cn(
          "mt-0.5 h-5 w-5 flex-shrink-0 text-[#ff4f00]",
          iconClassName,
        )}
      />
      <span className="min-w-0">
        <span className="block text-sm font-semibold">
          Pasang di perangkat
        </span>
        <span className="block text-xs leading-5 text-[#6f6a60]">
          Buka lebih cepat seperti aplikasi biasa.
        </span>
      </span>
    </button>
  );
}

type InstallAppButtonWrapperProps = Omit<InstallAppButtonProps, "onClick">;

export function InstallAppButton(props: InstallAppButtonWrapperProps) {
  const { canInstall, installApp } = useInstallAppPrompt();

  if (!canInstall) {
    return null;
  }

  return <InstallAppAction {...props} onClick={installApp} />;
}
