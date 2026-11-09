import { Bonjour, type Browser, type Service } from "bonjour-service";
import { networkInterfaces } from "node:os";
import { cleanName } from "../shared/protocol.ts";

export interface DiscoveredDevice {
  id: string;
  name: string;
  host: string;
  port: number;
}

/** Non-internal IPv4 addresses, for display and manual connection. */
export function localAddresses(): string[] {
  const out: string[] = [];
  for (const list of Object.values(networkInterfaces())) {
    for (const a of list ?? []) if (a.family === "IPv4" && !a.internal) out.push(a.address);
  }
  return out;
}

/**
 * mDNS (`_mansomirror._tcp`). Best effort: many networks (guest Wi-Fi,
 * corporate, client isolation) block multicast, so manual IP entry always
 * remains available.
 */
export class Discovery {
  private bonjour: Bonjour | null = null;
  private published: Service | null = null;
  private browser: Browser | null = null;
  private devices = new Map<string, DiscoveredDevice>();

  private get b() {
    this.bonjour ??= new Bonjour();
    return this.bonjour;
  }

  publish(name: string, port: number, id: string) {
    this.unpublish();
    this.published = this.b.publish({ name: `${name} (${id.slice(0, 4)})`, type: "mansomirror", port, txt: { v: "1", id, n: name } });
  }

  unpublish() {
    this.published?.stop?.();
    this.published = null;
  }

  browse(selfId: string, onChange: (list: DiscoveredDevice[]) => void) {
    this.stopBrowsing();
    this.devices.clear();
    const emit = () => onChange([...this.devices.values()]);
    this.browser = this.b.find({ type: "mansomirror" });
    this.browser.on("up", (s: Service) => {
      const id = String(s.txt?.id ?? "");
      if (!id || id === selfId) return;
      const host = (s.addresses ?? []).find((a) => /^\d+\.\d+\.\d+\.\d+$/.test(a));
      if (!host || !Number.isInteger(s.port)) return;
      this.devices.set(id, { id, name: cleanName(String(s.txt?.n ?? s.name)), host, port: s.port });
      emit();
    });
    this.browser.on("down", (s: Service) => {
      this.devices.delete(String(s.txt?.id ?? ""));
      emit();
    });
    emit();
  }

  stopBrowsing() {
    this.browser?.stop();
    this.browser = null;
  }

  destroy() {
    this.unpublish();
    this.stopBrowsing();
    this.bonjour?.destroy();
    this.bonjour = null;
  }
}
