import { EventManagerType } from '../index.js';
import {} from '#modules/global';
import { builder, prisma } from '#lib';
// TODO rename to event.manager

builder.queryField('eventManager', (t) =>
  t.prismaField({
    type: EventManagerType,
    args: {
      user: t.arg.string(),
      eventId: t.arg.id(),
    },
    resolve: async (query, _, { user, eventId }) =>
      prisma.eventManager.findFirstOrThrow({ ...query, where: { user: { uid: user }, eventId } }),
  }),
);
