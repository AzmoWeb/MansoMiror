// Real host and viewer talking over a real local WebSocket.
import { test } from "node:test";
import assert from "node:assert/strict";
import { WebSocket } from "ws";
import { HostServer, type ConnectionRequest } from "../../src/main/host.ts";
import { ViewerClient, PairingError } from "../../src/main/viewer.ts";
import { PIN_MAX_ATTEMPTS, deriveKey, sdpMac } from "../../src/main/pairing.ts";

const OFFER = "v=0\r\no=- offer fingerprint:sha-256 AA:BB\r\n";
const ANSWER = "v=0\r\no=- answer fingerprint:sha-256 CC:DD\r\n";

async function setup() {
  const host = new HostServer(() => "PC-Bureau");
  const port = await host.start(0, "127.0.0.1");
  const { pin } = host.issuePin();
  return { host, port, pin };
}

const wrongPin = (pin: string) => String((Number(pin) + 1) % 1_000_000).padStart(6, "0");

test("correct PIN + consent → both sides get each other's SDP", async () => {
  const { host, port, pin } = await setup();
  const viewer = new ViewerClient();
  host.once("request", (r: ConnectionRequest) => {
    assert.equal(r.name, "PC-Salon");
    assert.equal(r.offerSdp, OFFER);
    host.accept(r.requestId, ANSWER);
  });
  const connected = new Promise((r) => host.once("connected", r));
  const res = await viewer.connect({ host: "127.0.0.1", port, pin, name: "PC-Salon", offerSdp: OFFER });
  assert.deepEqual(res, { answerSdp: ANSWER, hostName: "PC-Bureau" });
  await connected;
  assert.ok(host.inSession);

  // Recording notice reaches the host.
  const rec = new Promise<{ on: boolean }>((r) => host.once("recording", r));
  viewer.setRecording(true);
  assert.deepEqual(await rec, { on: true });

  // Viewer disconnect ends the host session.
  const ended = new Promise<{ reason: string }>((r) => host.once("ended", r));
  viewer.disconnect();
  assert.equal((await ended).reason, "bye");
  assert.equal(host.inSession, false);
  await host.stop();
});

test("the PIN cannot be reused once a viewer paired", async () => {
  const { host, port, pin } = await setup();
  host.on("request", (r) => host.accept(r.requestId, ANSWER));
  await new ViewerClient().connect({ host: "127.0.0.1", port, pin, name: "A", offerSdp: OFFER });
  await assert.rejects(new ViewerClient().connect({ host: "127.0.0.1", port, pin, name: "B", offerSdp: OFFER }), (e: PairingError) => e.code === "busy");
  await host.stop();
});

test("refusal is reported to the viewer", async () => {
  const { host, port, pin } = await setup();
  host.on("request", (r) => host.refuse(r.requestId));
  await assert.rejects(new ViewerClient().connect({ host: "127.0.0.1", port, pin, name: "A", offerSdp: OFFER }), (e: PairingError) => e.code === "refused");
  assert.equal(host.inSession, false);
  await host.stop();
});

test("wrong PINs count down, then lock — even the right PIN is refused afterwards", async () => {
  const { host, port, pin } = await setup();
  let requests = 0;
  host.on("request", () => requests++);
  for (let i = 1; i <= PIN_MAX_ATTEMPTS; i++) {
    await assert.rejects(
      new ViewerClient().connect({ host: "127.0.0.1", port, pin: wrongPin(pin), name: "X", offerSdp: OFFER }),
      (e: PairingError) => (i < PIN_MAX_ATTEMPTS ? e.code === "bad-pin" && e.remaining === PIN_MAX_ATTEMPTS - i : e.code === "locked"),
    );
  }
  await assert.rejects(new ViewerClient().connect({ host: "127.0.0.1", port, pin, name: "X", offerSdp: OFFER }), (e: PairingError) => e.code === "locked");
  assert.equal(requests, 0, "the user is never asked for a wrong PIN");
  await host.stop();
});

test("expired PIN is refused", async () => {
  let t = Date.now();
  const host = new HostServer(() => "H", () => t);
  const port = await host.start(0, "127.0.0.1");
  const { pin } = host.issuePin();
  t += 121_000;
  await assert.rejects(new ViewerClient().connect({ host: "127.0.0.1", port, pin, name: "X", offerSdp: OFFER }), (e: PairingError) => e.code === "expired");
  await host.stop();
});

test("a host that does not know the PIN is detected (forged answer)", async () => {
  // Fake host: sends a valid-looking challenge, then an answer MAC'd with the wrong key.
  const { WebSocketServer } = await import("ws");
  const wss = new WebSocketServer({ port: 0, host: "127.0.0.1" });
  await new Promise((r) => wss.once("listening", r));
  const port = (wss.address() as { port: number }).port;
  wss.on("connection", (ws) => {
    let nonceV = "";
    const salt = "ab".repeat(16);
    const nonceH = "cd".repeat(16);
    ws.on("message", async (d) => {
      const m = JSON.parse(d.toString());
      if (m.t === "hello") {
        nonceV = m.nonce;
        ws.send(JSON.stringify({ t: "challenge", v: 1, hostName: "Evil", salt, nonce: nonceH }));
      } else if (m.t === "offer") {
        const k = await deriveKey("000000", salt);
        ws.send(JSON.stringify({ t: "answer", sdp: ANSWER, mac: sdpMac(k, "answer", nonceV, nonceH, ANSWER) }));
      }
    });
  });
  await assert.rejects(new ViewerClient().connect({ host: "127.0.0.1", port, pin: "123456", name: "V", offerSdp: OFFER }), (e: PairingError) => e.code === "mitm");
  await new Promise((r) => wss.close(r));
});

test("no PIN issued → not accepting; malformed traffic is dropped", async () => {
  const host = new HostServer(() => "H");
  const port = await host.start(0, "127.0.0.1");
  await assert.rejects(new ViewerClient().connect({ host: "127.0.0.1", port, pin: "123456", name: "X", offerSdp: OFFER }), (e: PairingError) => e.code === "not-accepting");

  const ws = new WebSocket(`ws://127.0.0.1:${port}`);
  await new Promise((r) => ws.once("open", r));
  const reply = new Promise<string>((r) => ws.once("message", (d) => r(d.toString())));
  ws.send("{garbage");
  assert.equal(JSON.parse(await reply).code, "protocol");
  await host.stop();
});

test("stopping the host (kill switch) ends an active session", async () => {
  const { host, port, pin } = await setup();
  host.on("request", (r) => host.accept(r.requestId, ANSWER));
  const viewer = new ViewerClient();
  await viewer.connect({ host: "127.0.0.1", port, pin, name: "A", offerSdp: OFFER });
  const viewerEnded = new Promise((r) => viewer.once("ended", r));
  await host.stop("killed");
  await viewerEnded;
  assert.equal(viewer.connected, false);
});
