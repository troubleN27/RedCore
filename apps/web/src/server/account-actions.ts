'use server';

import { getDb } from '@redcore/db';
import { deleteAddress, saveAddress, type AddressInput } from '@redcore/services';
import { revalidatePath } from 'next/cache';
import { ZodError } from 'zod';
import { getSession } from './auth';

export async function saveAddressAction(
  input: AddressInput,
): Promise<{ ok: boolean; fields?: string[] }> {
  const session = await getSession();
  if (!session) return { ok: false };
  try {
    await saveAddress(await getDb(), session.user.id, input);
    revalidatePath('/[locale]/account/addresses', 'page');
    return { ok: true };
  } catch (error) {
    if (error instanceof ZodError)
      return { ok: false, fields: error.issues.map((i) => String(i.path[0])) };
    return { ok: false };
  }
}

export async function deleteAddressAction(id: string): Promise<void> {
  const session = await getSession();
  if (!session) return;
  await deleteAddress(await getDb(), session.user.id, id);
  revalidatePath('/[locale]/account/addresses', 'page');
}
