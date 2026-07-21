"use client";

import {
  isConnected,
  requestAccess,
  getAddress,
  signTransaction,
} from "@stellar/freighter-api";
import type { SignFn } from "@openajo/sdk";

export async function freighterInstalled(): Promise<boolean> {
  try {
    const res = await isConnected();
    return !!res.isConnected;
  } catch {
    return false;
  }
}

/** Prompts the user if not yet authorized; returns their public key. */
export async function connectWallet(): Promise<string> {
  const res = await requestAccess();
  if (res.error) throw new Error(String(res.error));
  if (!res.address) throw new Error("No Stellar account authorized in Freighter.");
  return res.address;
}

/** Non-interactive: returns the address if already authorized, else null. */
export async function currentAddress(): Promise<string | null> {
  try {
    const res = await getAddress();
    return res.address || null;
  } catch {
    return null;
  }
}

/** SDK-compatible signer backed by Freighter. */
export function freighterSigner(): SignFn {
  return async (xdrBase64, networkPassphrase) => {
    const res = await signTransaction(xdrBase64, { networkPassphrase });
    if (res.error) throw new Error(String(res.error));
    return res.signedTxXdr;
  };
}
