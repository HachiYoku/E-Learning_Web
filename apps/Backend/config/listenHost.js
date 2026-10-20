const { isIP } = require("node:net");

function resolveListenHost(env = process.env) {
  const host = env.LISTEN_HOST;
  if (host === undefined) return undefined;

  const validDnsName = typeof host === "string" && host.length <= 253 &&
    host.split(".").every((label) => label.length <= 63 &&
      /^[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?$/.test(label));
  if (typeof host !== "string" || host !== host.trim() ||
    (!isIP(host) && !validDnsName)) {
    throw new Error("LISTEN_HOST must be an IP address or DNS hostname.");
  }
  return host;
}

function listenOnHost(server, port, host, onListening) {
  return host === undefined
    ? server.listen(port, onListening)
    : server.listen(port, host, onListening);
}

module.exports = { resolveListenHost, listenOnHost };
