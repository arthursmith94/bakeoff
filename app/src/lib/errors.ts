// Turns the many shapes of wallet / RPC / program errors into something a player can act on.
import { IDL } from './bakeoff'

export type TxErrorKind =
  | 'user-rejected'
  | 'insufficient-funds'
  | 'blockhash-expired'
  | 'program-error'
  | 'wrong-network'
  | 'wallet'
  | 'rpc'
  | 'unknown'

export interface ClassifiedError {
  kind: TxErrorKind
  title: string
  detail: string
  /** Whether re-sending the same clicks is likely to succeed. */
  retryable: boolean
  /** Whether the "Get COOK via bridge" call-to-action should be shown. */
  needsFunds: boolean
  logs?: string[]
}

const idlErrors = new Map<number, string>((IDL.errors ?? []).map((e) => [e.code, e.msg ?? e.name]))

function messageOf(e: unknown): string {
  if (e instanceof Error) return e.message
  if (typeof e === 'string') return e
  if (e && typeof e === 'object' && 'message' in e) return String((e as { message: unknown }).message)
  return String(e)
}

function logsOf(e: unknown): string[] | undefined {
  if (!e || typeof e !== 'object') return undefined
  const o = e as Record<string, unknown>
  for (const k of ['logs', 'transactionLogs']) {
    const v = o[k]
    if (Array.isArray(v) && v.every((x) => typeof x === 'string')) return v as string[]
  }
  return undefined
}

/** Extract a human message from Anchor logs or a `custom program error: 0x…` string. */
function programErrorFrom(text: string, logs: string[] | undefined): string | null {
  const joined = [text, ...(logs ?? [])].join('\n')
  const anchorMsg = /Error Message: ([^\n.]+)/.exec(joined)
  if (anchorMsg) return anchorMsg[1]!.trim()
  const custom = /custom program error: (0x[0-9a-f]+)/i.exec(joined)
  if (custom) {
    const code = parseInt(custom[1]!, 16)
    return idlErrors.get(code) ?? `program error code ${code}`
  }
  const inJson = /"Custom":\s*(\d+)/.exec(joined)
  if (inJson) {
    const code = Number(inJson[1])
    return idlErrors.get(code) ?? `program error code ${code}`
  }
  return null
}

export function classifyError(e: unknown): ClassifiedError {
  const msg = messageOf(e)
  const lower = msg.toLowerCase()
  const name = e instanceof Error ? e.name : ''
  const code = e && typeof e === 'object' && 'code' in e ? (e as { code: unknown }).code : undefined
  const logs = logsOf(e)

  if (
    code === 4001 ||
    name === 'WalletSignTransactionError' ||
    /user rejected|rejected the request|user denied|user cancel|cancelled by user|declined/.test(lower)
  ) {
    return {
      kind: 'user-rejected',
      title: 'Signature declined',
      detail: 'You dismissed the request in your wallet. Your clicks are safe — retry when ready.',
      retryable: true,
      needsFunds: false,
    }
  }

  if (
    /insufficient (lamports|funds)|found no record of a prior credit|insufficientfundsfor(fee|rent)|not enough (sol|cook|balance)/.test(lower)
  ) {
    return {
      kind: 'insufficient-funds',
      title: 'Not enough COOK',
      detail: 'Your wallet cannot cover the transaction fee (or the upgrade cost). Bridge some COOK and retry.',
      retryable: true,
      needsFunds: true,
      logs,
    }
  }

  if (
    name === 'TransactionExpiredBlockheightExceededError' ||
    name === 'TransactionExpiredTimeoutError' ||
    /blockhash not found|block height exceeded|expired|has expired/.test(lower)
  ) {
    return {
      kind: 'blockhash-expired',
      title: 'Blockhash expired',
      detail:
        'The transaction was not confirmed before its blockhash expired. This also happens when the wallet is on a different network than Cookie Chain.',
      retryable: true,
      needsFunds: false,
      logs,
    }
  }

  const programMsg = programErrorFrom(msg, logs)
  if (programMsg) {
    const isMax = /max level/i.test(programMsg)
    return {
      kind: 'program-error',
      title: 'Program rejected the transaction',
      detail: programMsg,
      retryable: !isMax,
      needsFunds: false,
      logs,
    }
  }

  if (/program that does not exist|invalid program id|programaccountnotfound|unsupported program id/.test(lower)) {
    return {
      kind: 'wrong-network',
      title: 'Wrong network',
      detail: 'The Bakeoff program was not found. Make sure your wallet and RPC are both on Cookie Chain.',
      retryable: true,
      needsFunds: false,
      logs,
    }
  }

  if (/simulation failed|transaction simulation/.test(lower)) {
    const tail = msg.replace(/^.*simulation failed:?\s*/i, '').slice(0, 240)
    return {
      kind: 'rpc',
      title: 'Simulation failed',
      detail: tail || msg,
      retryable: true,
      needsFunds: false,
      logs,
    }
  }

  if (name === 'WalletNotConnectedError' || /wallet not connected|not connected/.test(lower)) {
    return {
      kind: 'wallet',
      title: 'Wallet not connected',
      detail: 'Connect Nightly to bake on-chain.',
      retryable: true,
      needsFunds: false,
    }
  }

  if (/failed to fetch|network ?error|fetch failed|econnrefused|503|502|timeout|timed out/.test(lower)) {
    return {
      kind: 'rpc',
      title: 'RPC unreachable',
      detail: `Could not reach the RPC endpoint. ${msg.slice(0, 160)}`,
      retryable: true,
      needsFunds: false,
    }
  }

  return { kind: 'unknown', title: 'Transaction failed', detail: msg.slice(0, 300) || 'Unknown error', retryable: true, needsFunds: false, logs }
}
