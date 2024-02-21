import { builder } from '#lib';

export const ContributionOptionType = builder.prismaObject('ContributionOption', {
  fields: (t) => ({
    id: t.exposeID('id'),
    name: t.exposeString('name'),
    price: t.exposeFloat('price'),
    description: t.exposeString('description'),
    paysFor: t.relation('paysFor'),
    offeredIn: t.relation('offeredIn'),
  }),
});
