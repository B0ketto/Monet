"use server";

import { db } from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";

const serializeTransaction = (obj) => {
  const serialized = { ...obj };

  if (obj.balance) {
    serialized.balance = obj.balance.toNumber();
  }
  if (obj.amount) {
    serialized.amount = obj.amount.toNumber();
  }

  return serialized;
};

export async function updateDefaultAccount(accountId) {
  try {
    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");

    const user = await db.user.findUnique({
      where: { clerkUserId: userId },
    });

    if (!user) throw new Error("User Not Found");

    await db.account.updateMany({
      where: { userId: user.id, isDefault: true },
      data: { isDefault: false },
    });

    const account = await db.account.update({
      where: {
        id: accountId,
        userId: user.id,
      },
      data: { isDefault: true },
    });

    revalidatePath("/dashboard");
    return { success: true, data: serializeTransaction(account) };
  } catch (error) {
    return { success: true, error: error.message };
  }
}

export async function getAccountWithTransaction(accountId) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const user = await db.user.findUnique({
    where: { clerkUserId: userId },
  });

  if (!user) throw new Error("User Not Found");

  const account = await db.account.findUnique({
    where: { id: accountId, userId: user.id },
    include: {
      trasnsactions: {
        orderBy: { date: "desc" },
      },
      _count: {
        select: { trasnsactions: true },
      },
    },
  });

  if (!account) return null;

  return {
    ...serializeTransaction(account),
    transactions: account.trasnsactions.map(serializeTransaction),
  };
}

export async function bulkDeleteTransactions(transactionIds) {
  try {
    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");

    const user = await db.user.findUnique({
      where: { clerkUserId: userId },
    });

    if (!user) throw new Error("User Not Found");

    const transactions = await db.trasnsactions.findMany({
      where: {
        id: { in: transactionIds },
        userId: user.id,
      },
    });

    const accountBalanaceChanges = transactions.reduce((acc, transaction) => {
      const change =
        transaction.type == "EXPENSE"
          ? transaction.amount
          : -transaction.amount;

      acc[transaction.accountId] = (acc[transaction.accountId] || 0) + change;
      return acc;
    }, {});

    //delete transactions and update account balance
    await db.$transaction(async (tx) => {
        await tx.transaction.deleteMany({
            where: {
                id: {in:transactionIds},
                userId: user.id,           
            },
        });

        for(const [accountId, balanceChange] of Object.entries(
            accountBalanaceChanges 
        )){
            await tx.account.update({
                where: {id: accountId},
                data: {
                    balance: {
                        increment : balanceChange,
                    },
                },
            });
        }
    });
    revalidatePath("/dashboard");
    revalidatePath("/account/[id");

    return {success: true};
  } catch (error) {
    return {success: false, error: error.message};
  }
}
