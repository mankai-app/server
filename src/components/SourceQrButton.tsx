import { QrCode } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

import { buildMankaiSourceLink } from "#/utils/sourceLinks";

import styles from "./SourceQrButton.module.scss";

interface SourceQrButtonProps {
  apiUrl: string;
  compact?: boolean;
}

export default function SourceQrButton({
  apiUrl,
  compact = false,
}: SourceQrButtonProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const id = useId();
  const sourceLink = useMemo(() => buildMankaiSourceLink(apiUrl), [apiUrl]);

  function clearCloseTimer() {
    if (closeTimer.current !== null) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }

  function show() {
    clearCloseTimer();
    setOpen(true);
  }

  function close() {
    clearCloseTimer();
    setOpen(false);
  }

  function scheduleClose() {
    clearCloseTimer();
    closeTimer.current = setTimeout(() => {
      if (
        document.activeElement !== triggerRef.current &&
        !popoverRef.current?.contains(document.activeElement)
      ) {
        setOpen(false);
      }
    }, 150);
  }

  function handleBlur(relatedTarget: EventTarget | null) {
    if (
      relatedTarget instanceof Node &&
      (triggerRef.current?.contains(relatedTarget) ||
        popoverRef.current?.contains(relatedTarget))
    ) {
      return;
    }
    close();
  }

  useEffect(() => clearCloseTimer, []);

  useLayoutEffect(() => {
    if (!open || !triggerRef.current || !popoverRef.current) return;

    const trigger = triggerRef.current.getBoundingClientRect();
    const popover = popoverRef.current.getBoundingClientRect();
    const gap = 8;
    const left = Math.max(
      gap,
      Math.min(
        trigger.right - popover.width,
        window.innerWidth - popover.width - gap,
      ),
    );
    const top =
      trigger.bottom + gap + popover.height <= window.innerHeight
        ? trigger.bottom + gap
        : Math.max(gap, trigger.top - popover.height - gap);

    // Only the measured position is dynamic; appearance lives in the stylesheet.
    popoverRef.current.style.setProperty("--qr-left", `${left}px`);
    popoverRef.current.style.setProperty("--qr-top", `${top}px`);
  }, [open, apiUrl]);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: PointerEvent) {
      if (
        event.target instanceof Node &&
        !triggerRef.current?.contains(event.target) &&
        !popoverRef.current?.contains(event.target)
      ) {
        close();
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (popoverRef.current?.contains(document.activeElement)) {
        triggerRef.current?.focus();
      }
      close();
    }

    function handleViewportChange(event: Event) {
      if (
        event.target instanceof Node &&
        popoverRef.current?.contains(event.target)
      )
        return;
      close();
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("scroll", handleViewportChange, true);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("scroll", handleViewportChange, true);
    };
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={`${compact ? "iconButton" : "outlineButton"} ${styles.trigger}`}
        title={compact ? "Show source QR code" : undefined}
        onMouseEnter={show}
        onMouseLeave={scheduleClose}
        onFocus={show}
        onBlur={(event) => handleBlur(event.relatedTarget)}
        onClick={show}
      >
        <QrCode size={16} />
        {!compact && <span>QR code</span>}
      </button>
      {open &&
        createPortal(
          <div
            ref={popoverRef}
            id={id}
            role="dialog"
            className={styles.popover}
            onMouseEnter={show}
            onMouseLeave={scheduleClose}
            onFocus={show}
            onBlur={(event) => handleBlur(event.relatedTarget)}
          >
            <QRCodeSVG
              className={styles.qrCode}
              value={sourceLink}
              size={224}
              level="M"
              marginSize={4}
              title="Scan to add this source to Mankai"
            />
            <p className={styles.description}>
              Scan the QR code or click{" "}
              <a className={styles.sourceLink} href={sourceLink}>
                link
              </a>{" "}
              to add this source to Mankai.
            </p>
          </div>,
          document.body,
        )}
    </>
  );
}
