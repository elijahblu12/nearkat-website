const MINT = "6UtY9iTZMQQ5QZVrbzFnNaJntV7oySm9k97mvwnuZcxr";
const RPC_URLS = [
  "https://moltnode.ag/solana",
  "https://solana.api.onfinality.io/public",
];
const TOKEN_PROGRAMS = [
  "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
  "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb",
];
const BASE58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

export function isSolanaAddress(value: string) {
  const address = value.trim();
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)) return false;

  let number = 0n;
  for (const character of address) {
    const digit = BASE58.indexOf(character);
    if (digit < 0) return false;
    number = number * 58n + BigInt(digit);
  }

  const payloadBytes =
    number === 0n ? 0 : Math.ceil(number.toString(16).length / 2);
  const leadingZeroBytes = address.match(/^1*/)?.[0].length ?? 0;
  return payloadBytes + leadingZeroBytes === 32;
}

type ParsedTokenAccount = {
  account?: {
    data?: {
      parsed?: {
        info?: {
          mint?: string;
          tokenAmount?: {
            amount?: string;
            decimals?: number;
          };
        };
      };
    };
  };
};

async function queryProgram(
  rpcUrl: string,
  address: string,
  programId: string,
  id: number,
) {
  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id,
      method: "getTokenAccountsByOwner",
      params: [
        address,
        { programId },
        { commitment: "confirmed", encoding: "jsonParsed" },
      ],
    }),
  });

  if (!response.ok) throw new Error("RPC request failed");
  const payload = (await response.json()) as {
    error?: unknown;
    result?: { value?: ParsedTokenAccount[] };
  };
  if (payload.error || !payload.result) throw new Error("RPC returned an error");
  return payload.result.value ?? [];
}

async function readBalance(rpcUrl: string, address: string) {
  const accountGroups: ParsedTokenAccount[][] = [];
  for (const [index, programId] of TOKEN_PROGRAMS.entries()) {
    accountGroups.push(await queryProgram(rpcUrl, address, programId, index + 1));
  }

  let balance = 0;
  for (const account of accountGroups.flat()) {
    const info = account.account?.data?.parsed?.info;
    if (info?.mint !== MINT) continue;
    const raw = Number(info.tokenAmount?.amount ?? 0);
    const decimals = Number(info.tokenAmount?.decimals ?? 0);
    if (Number.isFinite(raw) && Number.isFinite(decimals)) {
      balance += raw / 10 ** decimals;
    }
  }
  return balance;
}

export async function POST(request: Request) {
  let address = "";
  try {
    const body = (await request.json()) as { address?: unknown };
    address = typeof body.address === "string" ? body.address.trim() : "";
  } catch {
    return Response.json(
      { error: "that is not a Solana tunnel." },
      { status: 400, headers: { "cache-control": "no-store" } },
    );
  }

  if (!isSolanaAddress(address)) {
    return Response.json(
      { error: "that is not a Solana tunnel." },
      { status: 400, headers: { "cache-control": "no-store" } },
    );
  }

  for (const rpcUrl of RPC_URLS) {
    try {
      const balance = await readBalance(rpcUrl, address);
      return Response.json(
        { balance },
        { headers: { "cache-control": "no-store" } },
      );
    } catch {
      // Try the next public read-only endpoint.
    }
  }

  return Response.json(
    { error: "lookout lost the trail. try again." },
    { status: 502, headers: { "cache-control": "no-store" } },
  );
}
