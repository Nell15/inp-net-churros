import { builder } from '../builder.js';
import { startOfWeek, endOfWeek } from 'date-fns';
import { TicketType, createUid as createTicketUid, userCanSeeTicket } from './tickets.js';
import {
  type Event as EventPrisma,
  Visibility as VisibilityPrisma,
  Visibility,
  type Event,
  type EventManager,
} from '@prisma/client';
import { toHtml } from '../services/markdown.js';
import { prisma } from '../prisma.js';
import { DateTimeScalar, FileScalar } from './scalars.js';
import { mappedGetAncestors } from 'arborist';
import slug from 'slug';
import { LinkInput } from './links.js';
import type { Context } from '../context.js';
import dichotomid from 'dichotomid';
import {
  type FuzzySearchResult,
  levenshteinFilterAndSort,
  levenshteinSorter,
  splitSearchTerms,
  sanitizeOperators,
} from '../services/search.js';
import { dateFromNumbers } from '../date.js';
import { TicketInput } from './tickets.js';
import { TicketGroupInput } from './ticket-groups.js';
import { ManagerOfEventInput } from './event-managers.js';
// import imageType, { minimumBytes } from 'image-type';
import { unlink } from 'node:fs/promises';
import { scheduleShotgunNotifications } from '../services/notifications.js';
import { updatePicture } from '../pictures.js';
import { join } from 'node:path';

export const VisibilityEnum = builder.enumType(VisibilityPrisma, {
  name: 'Visibility',
});

export function visibleEventsPrismaQuery(user: { uid: string } | undefined) {
  return {
    visibility: {
      not: VisibilityPrisma.Private,
    },
    OR: [
      // Completely public events
      {
        visibility: VisibilityPrisma.Public,
      },
      // Restricted events in the user's groups
      {
        group: { members: { some: { member: { uid: user?.uid ?? '' } } } },
        visibility: VisibilityPrisma.Restricted,
      },
      // Unlisted events that the user booked
      {
        visibility: VisibilityPrisma.Unlisted,
        tickets: {
          some: {
            registrations: {
              some: {
                OR: [
                  {
                    beneficiary: user?.uid ?? '',
                  },
                  {
                    author: { uid: user?.uid ?? '' },
                  },
                ],
              },
            },
          },
        },
      },
    ],
  };
}

export const EventType = builder.prismaNode('Event', {
  id: { field: 'id' },
  fields: (t) => ({
    authorId: t.exposeID('authorId', { nullable: true }),
    groupId: t.exposeID('groupId'),
    contactMail: t.exposeString('contactMail'),
    beneficiary: t.relation('beneficiary', { nullable: true }),
    lydiaAccountId: t.exposeID('lydiaAccountId', { nullable: true }),
    description: t.exposeString('description'),
    descriptionHtml: t.string({ resolve: async ({ description }) => toHtml(description) }),
    uid: t.exposeString('uid'),
    title: t.exposeString('title'),
    startsAt: t.expose('startsAt', { type: DateTimeScalar }),
    endsAt: t.expose('endsAt', { type: DateTimeScalar }),
    location: t.exposeString('location'),
    visibility: t.expose('visibility', { type: VisibilityEnum }),
    managers: t.relation('managers'),
    tickets: t.field({
      type: [TicketType],
      async resolve({ id }, _, { user }) {
        const allTickets = await prisma.ticket.findMany({
          where: { event: { id } },
          include: {
            openToGroups: {
              include: {
                school: true,
                studentAssociation: true,
              },
            },
            openToSchools: true,
            event: {
              include: {
                group: {
                  include: {
                    studentAssociation: true,
                    school: true,
                  },
                },
              },
            },
            openToMajors: true,
            group: true,
          },
        });
        const userWithContributesTo = user
          ? await prisma.user.findUniqueOrThrow({
              where: { id: user.id },
              include: {
                contributions: {
                  include: {
                    studentAssociation: {
                      include: {
                        school: true,
                      },
                    },
                  },
                },
                groups: {
                  include: {
                    group: true,
                  },
                },
                managedEvents: {
                  include: {
                    event: true,
                  },
                },
                major: {
                  include: {
                    schools: true,
                  },
                },
              },
            })
          : undefined;
        return allTickets.filter((ticket) => userCanSeeTicket(ticket, userWithContributesTo));
      },
    }),
    ticketGroups: t.relation('ticketGroups'),
    articles: t.relation('articles'),
    group: t.relation('group'),
    links: t.relation('links'),
    author: t.relation('author', { nullable: true }),
    pictureFile: t.exposeString('pictureFile'),
    registrationsCount: t.int({
      async resolve({ id }) {
        const results = await prisma.registration.findMany({
          where: { ticket: { event: { id } } },
        });
        return results.length;
      },
    }),
  }),
});

builder.queryField('event', (t) =>
  t.prismaField({
    type: EventType,
    args: {
      uid: t.arg.string(),
      groupUid: t.arg.string(),
    },
    async authScopes(_, { uid, groupUid }, { user }) {
      const event = await prisma.event.findFirstOrThrow({
        where: { uid, group: { uid: groupUid } },
        include: { managers: { include: { user: true } } },
      });
      return eventAccessibleByUser(event, user);
    },
    resolve: async (query, _, { uid }) =>
      prisma.event.findFirstOrThrow({ ...query, where: { uid } }),
  })
);

builder.queryField('events', (t) =>
  t.prismaConnection({
    type: EventType,
    cursor: 'id',
    args: {
      future: t.arg.boolean({ required: false }),
    },
    async resolve(query, _, { future }, { user }) {
      future = future ?? false;
      if (!user) {
        return prisma.event.findMany({
          ...query,
          where: {
            visibility: VisibilityPrisma.Public,
            startsAt: future ? { gte: new Date() } : undefined,
          },
        });
      }

      return prisma.event.findMany({
        ...query,
        where: {
          startsAt: future ? { gte: new Date() } : undefined,
          ...visibleEventsPrismaQuery(user),
        },
        orderBy: { startsAt: 'desc' },
      });
    },
  })
);

builder.queryField('eventsInWeek', (t) =>
  t.prismaField({
    type: [EventType],
    args: {
      today: t.arg({ type: DateTimeScalar }),
    },
    async resolve(query, _, { today }, { user }) {
      // dateCondition is used to filter events that start in the week or end in the week

      if (!user) {
        return prisma.event.findMany({
          ...query,
          where: {
            startsAt: {
              lte: endOfWeek(today),
              gte: startOfWeek(today),
            },
            visibility: VisibilityPrisma.Public,
          },
        });
      }

      return prisma.event.findMany({
        ...query,
        where: {
          startsAt: {
            lte: endOfWeek(today),
            gte: startOfWeek(today),
          },
          ...visibleEventsPrismaQuery(user),
        },
        orderBy: { startsAt: 'desc' },
      });
    },
  })
);

builder.queryField('eventsOfGroup', (t) =>
  t.prismaConnection({
    type: EventType,
    cursor: 'id',
    args: {
      groupUid: t.arg.string(),
    },
    async resolve(query, _, { groupUid }, { user }) {
      if (!user) {
        return prisma.event.findMany({
          ...query,
          where: { visibility: VisibilityPrisma.Public, group: { uid: groupUid } },
          orderBy: { startsAt: 'desc' },
        });
      }

      return prisma.event.findMany({
        ...query,
        where: visibleEventsPrismaQuery(user),
        orderBy: { startsAt: 'desc' },
      });
    },
  })
);

builder.mutationField('deleteEvent', (t) =>
  t.field({
    type: 'Boolean',
    args: {
      id: t.arg.id(),
    },
    authScopes(_, { id }, { user }) {
      return Boolean(
        user?.admin || user?.managedEvents.some(({ event, canEdit }) => event.id === id && canEdit)
      );
    },
    async resolve(_, { id }, { user }) {
      await prisma.event.delete({
        where: { id },
      });
      await prisma.logEntry.create({
        data: {
          area: 'event',
          action: 'delete',
          target: id,
          message: `Deleted event ${id}`,
          user: { connect: { id: user?.id ?? '' } },
        },
      });
      return true;
    },
  })
);

builder.mutationField('upsertEvent', (t) =>
  t.prismaField({
    type: EventType,
    errors: {},
    args: {
      id: t.arg.string({ required: false }),
      ticketGroups: t.arg({ type: [TicketGroupInput] }),
      tickets: t.arg({ type: [TicketInput] }),
      description: t.arg.string(),
      groupId: t.arg.string(),
      contactMail: t.arg.string(),
      links: t.arg({ type: [LinkInput] }),
      lydiaAccountId: t.arg.string({ required: false }),
      location: t.arg.string(),
      title: t.arg.string(),
      visibility: t.arg({ type: VisibilityEnum }),
      startsAt: t.arg({ type: DateTimeScalar }),
      endsAt: t.arg({ type: DateTimeScalar }),
      managers: t.arg({ type: [ManagerOfEventInput] }),
    },
    authScopes(_, { id, groupId }, { user }) {
      const creating = !id;
      if (user?.admin) return true;

      if (creating) {
        return Boolean(
          user?.canEditGroups ||
            user?.groups.some(
              ({ group, canEditArticles }) => canEditArticles && group.id === groupId
            )
        );
      }

      return Boolean(user?.managedEvents.some(({ event, canEdit }) => event.id === id && canEdit));
    },
    async resolve(
      query,
      _,
      {
        id,
        ticketGroups,
        lydiaAccountId,
        managers,
        startsAt,
        endsAt,
        tickets,
        description,
        groupId,
        contactMail,
        links,
        location,
        title,
        visibility,
      },
      { user }
    ) {
      // TODO send only notifications to people that have canSeeTicket(..., people)  on tickets that changed the shotgun date, and say that the shotgun date changed in the notification
      const shotgunChanged = !id;

      const connectFromListOfUids = (uids: string[]) => uids.map((uid) => ({ uid }));

      const connectFromListOfIds = (ids: string[]) => ids.map((id) => ({ id }));
      // First, delete all the tickets and ticket groups that are not in the new list

      if (id) {
        await prisma.ticketGroup.deleteMany({
          where: {
            eventId: id,
            id: {
              notIn: ticketGroups.map(({ id }) => id ?? ''),
            },
          },
        });

        await prisma.ticket.deleteMany({
          where: {
            eventId: id,
            id: {
              notIn: tickets.map(({ id }) => id ?? ''),
            },
          },
        });
      }

      // First, create or update the event without any tickets
      const upsertData = {
        group: {
          connect: {
            id: groupId,
          },
        },
        author: {
          connect: {
            id: user!.id,
          },
        },
        description,
        contactMail,
        location,
        title,
        visibility,
        startsAt,
        endsAt,
        beneficiary: lydiaAccountId
          ? {
              connect: {
                id: lydiaAccountId,
              },
            }
          : undefined,
      };
      const event = await prisma.event.upsert({
        ...query,
        where: { id: id ?? '' },
        create: {
          ...upsertData,
          uid: await createUid({ title, groupId }),
          links: { create: links },
          managers: {
            create: managers.map((m) => ({
              user: { connect: { uid: m.userUid } },
              canEdit: m.canEdit,
              canEditPermissions: m.canEditPermissions,
              canVerifyRegistrations: m.canVerifyRegistrations,
            })),
          },
        },
        update: {
          ...upsertData,
          links: {
            deleteMany: {},
            createMany: {
              data: links,
            },
          },
          managers:
            user?.admin || user?.managedEvents.find((m) => m.event.id === id)?.canEditPermissions
              ? {
                  deleteMany: {},
                  create: managers.map((m) => ({
                    user: { connect: { uid: m.userUid } },
                    canEdit: m.canEdit,
                    canEditPermissions: m.canEditPermissions,
                    canVerifyRegistrations: m.canVerifyRegistrations,
                  })),
                }
              : {},
        },
      });
      // Update the existing tickets
      await Promise.all(
        tickets
          .filter((t) => Boolean(t.id))
          .map(async (ticket) => {
            const ticketUpdated = await prisma.ticket.update({
              where: { id: ticket.id! },
              data: {
                ...ticket,
                id: ticket.id!,
                allowedPaymentMethods: {
                  set: ticket.allowedPaymentMethods,
                },
                links: {
                  deleteMany: {},
                  createMany: {
                    data: ticket.links,
                  },
                },
                openToGroups: {
                  set: connectFromListOfUids(ticket.openToGroups),
                },
                openToSchools: {
                  set: connectFromListOfUids(ticket.openToSchools),
                },
                openToMajors: {
                  set: connectFromListOfIds(ticket.openToMajors),
                },
                autojoinGroups: {
                  set: connectFromListOfUids(ticket.autojoinGroups),
                },
              },
            });
            return ticketUpdated;
          })
      );

      // Create the new tickets
      for (const [i, ticket] of Object.entries(tickets.filter((t) => !t.id))) {
        const newTicket = await prisma.ticket.create({
          data: {
            ...ticket,
            links: {
              create: ticket.links,
            },
            id: undefined,
            openToGroups: { connect: connectFromListOfUids(ticket.openToGroups) },
            openToSchools: { connect: connectFromListOfUids(ticket.openToSchools) },
            openToMajors: { connect: connectFromListOfIds(ticket.openToMajors) },
            autojoinGroups: { connect: connectFromListOfUids(ticket.autojoinGroups) },
            eventId: event.id,
            uid: await createTicketUid(ticket.name),
            allowedPaymentMethods: {
              set: ticket.allowedPaymentMethods,
            },
          },
        });

        tickets[Number.parseInt(i, 10)] = { ...ticket, id: newTicket.id };
      }

      // Create the group's new tickets
      for (const [i, ticketGroup] of Object.entries(ticketGroups)) {
        for (const [j, ticket] of Object.entries(ticketGroup.tickets.filter((t) => !t.id))) {
          const newTicket = await prisma.ticket.create({
            data: {
              ...ticket,
              links: {
                create: ticket.links,
              },
              id: undefined,
              openToGroups: { connect: connectFromListOfUids(ticket.openToGroups) },
              openToSchools: { connect: connectFromListOfUids(ticket.openToSchools) },
              openToMajors: { connect: connectFromListOfIds(ticket.openToMajors) },
              autojoinGroups: { connect: connectFromListOfUids(ticket.autojoinGroups) },
              eventId: event.id,
              uid: await createTicketUid(ticket.name),
              allowedPaymentMethods: {
                set: ticket.allowedPaymentMethods,
              },
            },
          });

          ticketGroups[Number.parseInt(i, 10)]!.tickets[Number.parseInt(j, 10)] = {
            ...ticket,
            id: newTicket.id,
          };
        }
      }

      // Update the existing ticket groups
      await Promise.all(
        ticketGroups
          .filter((t) => Boolean(t.id))
          .map(async (ticketGroup) => {
            const ticketGroupUptaded = await prisma.ticketGroup.update({
              where: { id: ticketGroup.id! },
              data: {
                capacity: ticketGroup.capacity,
                name: ticketGroup.name,
                tickets: {
                  set: ticketGroup.tickets.map(({ id }) => ({ id: id! })),
                },
              },
            });
            return ticketGroupUptaded;
          })
      );

      // Create the new ticket groups
      for (const [i, ticketGroup] of Object.entries(ticketGroups.filter((t) => !t.id))) {
        const newTicketGroup = await prisma.ticketGroup.create({
          data: {
            ...ticketGroup,
            id: undefined,
            eventId: event.id,
            tickets: {
              connect: ticketGroup.tickets.map(({ id }) => ({ id: id! })),
            },
          },
        });
        ticketGroups[Number.parseInt(i, 10)] = { ...ticketGroup, id: newTicketGroup.id };
      }

      const result = await prisma.event.findUniqueOrThrow({
        ...query,
        where: { id: event.id },
      });

      const finalEvent = await prisma.event.findUniqueOrThrow({
        where: { id: event.id },
        include: {
          tickets: true,
          group: true,
          ticketGroups: {
            include: {
              tickets: true,
            },
          },
        },
      });

      await prisma.logEntry.create({
        data: {
          area: 'event',
          action: id ? 'update' : 'create',
          target: event.id,
          message: `${id ? 'Updated' : 'Created'} event ${event.id}: ${JSON.stringify(finalEvent)}`,
          user: { connect: { id: user?.id ?? '' } },
        },
      });

      if (shotgunChanged) await scheduleShotgunNotifications(finalEvent);

      return result;
    },
  })
);

export async function eventAccessibleByUser(
  event:
    | (EventPrisma & {
        managers: Array<{
          user: { uid: string };

          canEdit: boolean;
          canEditPermissions: boolean;
          canVerifyRegistrations: boolean;
        }>;
      })
    | null,
  user: Context['user']
): Promise<boolean> {
  if (user?.admin) return true;

  switch (event?.visibility) {
    case Visibility.Public:
    case Visibility.Unlisted: {
      return true;
    }

    case Visibility.Restricted: {
      if (!user) return false;
      // All managers can see the event, no matter their permissions
      if (
        eventManagedByUser(event, user, {
          canEdit: false,
          canEditPermissions: false,
          canVerifyRegistrations: false,
        })
      )
        return true;

      const ancestors = await prisma.group
        .findMany({
          where: { familyId: { in: user.groups.map(({ group }) => group.familyId ?? group.id) } },
          select: { id: true, parentId: true },
        })
        .then((groups) => mappedGetAncestors(groups, user.groups, { mappedKey: 'groupId' }))
        .then((groups) => groups.flat());

      return Boolean(ancestors.some(({ id }) => id === event.groupId));
    }

    case Visibility.Private: {
      // All managers can see the event, no matter their permissions
      return eventManagedByUser(event, user, {
        canEdit: false,
        canEditPermissions: false,
        canVerifyRegistrations: false,
      });
    }

    default: {
      return false;
    }
  }
}

export function eventManagedByUser(
  event: EventPrisma & {
    managers: Array<{
      user: { uid: string };

      canEdit: boolean;
      canEditPermissions: boolean;
      canVerifyRegistrations: boolean;
    }>;
  },
  user: Context['user'],
  { canEdit = true, canEditPermissions = false, canVerifyRegistrations = false }
) {
  if (!user) return false;
  return Boolean(
    event.managers.some(
      ({ user: { uid }, ...permissions }) =>
        uid === user.uid &&
        ((permissions.canEdit && canEdit) ||
          (permissions.canEditPermissions && canEditPermissions) ||
          (permissions.canVerifyRegistrations && canVerifyRegistrations))
    )
  );
}

builder.queryField('searchEvents', (t) =>
  t.prismaField({
    type: [EventType],
    args: {
      q: t.arg.string(),
      groupUid: t.arg.string({ required: false }),
    },
    async resolve(query, _, { q, groupUid }, { user }) {
      q = sanitizeOperators(q).trim();
      const { searchString: search, numberTerms } = splitSearchTerms(q);
      const fuzzyIDs: FuzzySearchResult = await prisma.$queryRaw`
      SELECT "id", levenshtein_less_equal(LOWER(unaccent("title")), LOWER(unaccent(${search})), 20) as changes
      FROM "Event"
      ORDER BY changes ASC
      LIMIT 30
      `;
      const fuzzyEvents = await prisma.event.findMany({
        ...query,
        where: {
          id: {
            in: fuzzyIDs.map(({ id }) => id),
          },
          ...(groupUid ? { group: { uid: groupUid } } : {}),
        },
        include: {
          managers: {
            include: {
              user: true,
            },
          },
        },
      });
      const results = await prisma.event.findMany({
        ...query,
        where: {
          ...(groupUid ? { group: { uid: groupUid } } : {}),
          OR: [
            { uid: { search } },
            { title: { search } },
            { description: { search } },
            numberTerms.length > 0
              ? {
                  AND: [
                    {
                      startsAt: {
                        gte: dateFromNumbers(numberTerms),
                      },
                    },
                    {
                      endsAt: { lte: dateFromNumbers(numberTerms) },
                    },
                  ],
                }
              : {},
            { location: { search } },
            { contactMail: { search } },
          ],
        },
        include: {
          managers: {
            include: {
              user: true,
            },
          },
        },
      });

      return [
        ...results.sort(levenshteinSorter(fuzzyIDs)),
        ...levenshteinFilterAndSort<
          Event & { managers: Array<EventManager & { user: { uid: string } }> }
        >(
          fuzzyIDs,
          10,
          results.map(({ id }) => id)
        )(fuzzyEvents),
        // fucking js does not allow promises for .filter
        // eslint-disable-next-line unicorn/no-array-reduce
      ].reduce(async (acc, event) => {
        if (await eventAccessibleByUser(event, user)) return [...(await acc), event];

        return acc;
      }, Promise.resolve([] as Event[]));
    },
  })
);

export async function createUid({ title, groupId }: { title: string; groupId: string }) {
  const base = slug(title);
  const n = await dichotomid(
    async (n) =>
      !(await prisma.event.findUnique({
        where: { groupId_uid: { groupId, uid: `${base}${n > 1 ? `-${n}` : ''}` } },
      }))
  );
  return `${base}${n > 1 ? `-${n}` : ''}`;
}

builder.mutationField('updateEventPicture', (t) =>
  t.field({
    type: 'String',
    args: {
      id: t.arg.id(),
      file: t.arg({ type: FileScalar }),
    },
    async authScopes(_, { id }, { user }) {
      const event = await prisma.event.findUniqueOrThrow({
        where: { id },
      });

      return Boolean(
        // Who can edit this event?
        // The author
        user?.id === event.authorId ||
          // Other authors of the group
          user?.groups.some(
            ({ groupId, canEditArticles }) => canEditArticles && groupId === event.groupId
          )
      );
    },
    async resolve(_, { id, file }) {
      return updatePicture({
        resource: 'event',
        folder: 'events',
        extension: 'jpg',
        file,
        identifier: id,
      });
    },
  })
);

builder.mutationField('deleteEventPicture', (t) =>
  t.field({
    type: 'Boolean',
    args: {
      id: t.arg.id(),
    },
    async authScopes(_, { id }, { user }) {
      const event = await prisma.event.findUniqueOrThrow({
        where: { id },
      });

      return Boolean(
        // Who can edit this event?
        // The author
        user?.id === event.authorId ||
          // Other authors of the group
          user?.groups.some(
            ({ groupId, canEditArticles }) => canEditArticles && groupId === event.groupId
          )
      );
    },
    async resolve(_, { id }) {
      const { pictureFile } = await prisma.event.findUniqueOrThrow({
        where: { id },
        select: { pictureFile: true },
      });

      const root = new URL(process.env.STORAGE).pathname;

      if (pictureFile) await unlink(join(root, pictureFile));
      await prisma.event.update({ where: { id }, data: { pictureFile: '' } });
      return true;
    },
  })
);
