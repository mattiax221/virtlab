import { l2Flood } from "./l2";
import type { Device, LabState } from "./types";

export function authenticateAaa(
  state: LabState,
  router: Device,
  username: string,
  password: string,
): { ok: boolean; message: string; state: LabState } {
  const cfg = router.aaaConfig;
  if (!cfg?.newModel || !cfg.authEnable) {
    return { ok: true, message: "", state };
  }
  if (!cfg.serverIp) {
    return {
      ok: false,
      message: "% AAA: nessun radius-server host configurato",
      state,
    };
  }

  const flood = l2Flood(state, router.id);
  const server = flood.state.devices.find(
    (d) =>
      d.powered &&
      d.services?.aaa?.enabled &&
      d.interfaces.some((i) => i.ip === cfg.serverIp),
  );
  // Also allow any AAA server with that IP even if not on same L2
  const serverAny =
    server ??
    flood.state.devices.find(
      (d) =>
        d.services?.aaa?.enabled &&
        d.interfaces.some((i) => i.ip === cfg.serverIp),
    ) ??
    state.devices.find(
      (d) =>
        d.services?.aaa?.enabled &&
        d.interfaces.some((i) => i.ip === cfg.serverIp),
    );

  if (!serverAny) {
    return {
      ok: false,
      message: `% AAA: server ${cfg.serverIp} non raggiungibile / senza AAA`,
      state: flood.state,
    };
  }

  const aaa = serverAny.services!.aaa!;
  const routerIp =
    router.interfaces.find((i) => i.ip && i.enabled)?.ip ?? "";
  const clientOk =
    aaa.clients.length === 0 ||
    aaa.clients.some(
      (c) =>
        c.type === cfg.type &&
        c.secret === cfg.secret &&
        (c.ip === routerIp ||
          c.ip === "0.0.0.0" ||
          c.ip === "*" ||
          !routerIp),
    );
  if (!clientOk) {
    return {
      ok: false,
      message: `% AAA: client ${routerIp || router.name} non autorizzato (aggiungi Client in Services → AAA)`,
      state: flood.state,
    };
  }

  const user = aaa.users.find((u) => u.username === username);
  if (!user || user.password !== password) {
    return {
      ok: false,
      message: "% Authentication failed.",
      state: flood.state,
    };
  }

  return {
    ok: true,
    message: `% AAA ${cfg.type.toUpperCase()}: utente ${username} autenticato su ${serverAny.name}`,
    state: flood.state,
  };
}
