export const RPC = "https://rpc.cookiescan.io";
export const WSS = "wss://wss.cookiescan.io";
export const GENESIS = "9wDaBRDgArEUpvhHxGguNkwozsZh4UpGZB9o2EoEcBB2";
export const EXPLORER = "https://cookiescan.io";
export const BRIDGE = "https://hyperlane.cookiescan.io";
export const COOKIE_JAR = "568tU9FMksJDxjkLBjWisSA4J4C5uPH87NCCkyREwrxe";
export const PROGRAM_ID = "6GcyLhDfzZBHNpkiBaiWQbXamVoaGK9dcMxHh5DtcjQB";
export const txUrl = (sig: string) => `${EXPLORER}/tx/${sig}`;
export const accUrl = (a: string) => `${EXPLORER}/account/${a}`;
