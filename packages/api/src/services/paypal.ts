import { log } from '../objects/logs.js';
import { prisma } from '../prisma.js';

const { PUBLIC_PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, PUBLIC_PAYPAL_API_BASE_URL } = process.env;

async function accessToken() {
  const response = await fetch(new URL(`/v1/oauth2/token`, PUBLIC_PAYPAL_API_BASE_URL), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(
        `${PUBLIC_PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`,
      ).toString('base64')}`,
    },
    body: 'grant_type=client_credentials',
  }).catch((error) => {
    console.error(
      `Error while getting paypal access token: ${error}, secret=${PAYPAL_CLIENT_SECRET} && id=${PUBLIC_PAYPAL_CLIENT_ID}`,
    );
    throw error;
  });
  const { access_token } = (await response.json()) as { access_token: string };
  return access_token;
}

async function initiatePaypalPayment(
  title: string,
  price: number,
  referenceId: string,
): Promise<string> {
  console.info(
    `Initiating paypal payment with ref ${referenceId}, baseurl ${PUBLIC_PAYPAL_API_BASE_URL}`,
  );
  const response = await fetch(new URL('/v2/checkout/orders', PUBLIC_PAYPAL_API_BASE_URL), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${await accessToken()}`,
    },
    body: JSON.stringify({
      intent: 'CAPTURE',
      purchase_units: [
        {
          amount: {
            reference_id: referenceId,
            currency_code: 'EUR',
            value: price.toString(),
            description: title,
          },
        },
      ],
    }),
  }).catch((error) => {
    console.error(`Error while initiating paypal payment: ${error}`);
    throw error;
  });
  const { id } = (await response.json()) as { id: string };
  return id;
}

export async function finishPaypalPayment(orderId: string) {
  const response = await fetch(
    new URL(`/v2/checkout/orders/${orderId}/capture`, PUBLIC_PAYPAL_API_BASE_URL),
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${await accessToken()}`,
      },
    },
  );
  const { status } = (await response.json()) as { status: string };
  return status;
}

export async function checkPaypalPayment(orderId: string): Promise<boolean> {
  const response = await fetch(
    new URL(`/v2/checkout/orders/${orderId}`, PUBLIC_PAYPAL_API_BASE_URL),
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${await accessToken()}`,
      },
    },
  );
  const { status } = (await response.json()) as { status: string };
  return ['APPROVED', 'COMPLETED'].includes(status);
}

export async function payEventRegistrationViaPaypal(
  registrationId: string,
  emailAddress: string,
): Promise<string> {
  const registration = await prisma.registration.findUniqueOrThrow({
    where: { id: registrationId },
    include: { ticket: { include: { event: true } }, paypalTransaction: true },
  });

  // Transaction was already paid
  if (registration.paypalTransaction?.orderId) {
    const paid = await checkPaypalPayment(registration.paypalTransaction.orderId);
    if (paid) {
      await log('paypal', 'fallback mark as paid', { registration }, registration.id);
      await prisma.registration.update({
        where: { id: registration.id },
        data: { paid: true },
      });
    }
  }

  const orderId = await initiatePaypalPayment(
    registration.ticket.event.title,
    registration.ticket.price,
    registration.id,
  );

  // Create transaction
  await prisma.paypalTransaction.upsert({
    where: { registrationId: registration.id },
    create: {
      registration: { connect: { id: registration.id } },
      emailAddress,
      orderId,
    },
    update: {
      emailAddress,
      orderId,
    },
  });

  return orderId;
}